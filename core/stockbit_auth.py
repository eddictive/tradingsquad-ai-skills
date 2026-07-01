import os
import requests
import json
import sys
import time
from datetime import datetime

class StockbitClient:
    """
    Shared Authentication Client for Stockbit API.
    Uses 'Bring Your Own Token' (BYOT) architecture to bypass Cloudflare/Recaptcha.
    """
    def __init__(self):
        self.exodus_url = "https://exodus.stockbit.com"
        
        cwd_path = os.path.join(os.getcwd(), ".stockbit_token.json")
        local_path = os.path.join(os.path.dirname(__file__), "../.stockbit_token.json")
        
        if os.path.exists(cwd_path):
            self.token_file = cwd_path
        elif os.path.exists(local_path):
            self.token_file = local_path
        else:
            self.token_file = cwd_path  # Default to workspace root
        
        self.access_token = None
        self.refresh_token = None
        self.access_expired_at = None
        self.refresh_expired_at = None
        self.username = None
        
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Origin": "https://stockbit.com",
            "Referer": "https://stockbit.com/"
        })

        self._response_cache = {}
        env_ttl = os.environ.get("STOCKBIT_CACHE_TTL_MS")
        try:
            ttl_ms = int(env_ttl) if env_ttl is not None else 30_000
        except ValueError:
            ttl_ms = 30_000
        self._cache_ttl_sec = max(0, ttl_ms) / 1000.0
        self._cache_enabled = self._cache_ttl_sec > 0
        self._max_retries = 3
        self._retry_base_sec = 0.5

    def clear_cache(self):
        self._response_cache.clear()

    def get_cache_stats(self):
        now = time.time()
        active = sum(1 for e in self._response_cache.values() if e["expires_at"] > now)
        return {
            "enabled": self._cache_enabled,
            "ttlMs": int(self._cache_ttl_sec * 1000),
            "entries": len(self._response_cache),
            "activeEntries": active,
        }

    def _cache_key(self, method, url):
        return f"{method}:{url}"

    def _get_cached(self, key):
        entry = self._response_cache.get(key)
        if not entry:
            return None
        if time.time() > entry["expires_at"]:
            del self._response_cache[key]
            return None
        return entry["data"]

    def _set_cache(self, key, data):
        self._response_cache[key] = {
            "data": data,
            "expires_at": time.time() + self._cache_ttl_sec,
        }

    def _retry_delay(self, attempt, status=None):
        base = self._retry_base_sec * 4 if status == 429 else self._retry_base_sec
        return base * (2 ** attempt)

    def _request_with_retry(self, method, url, **kwargs):
        cache_key = self._cache_key(method, url)
        if method.upper() == "GET" and self._cache_enabled:
            cached = self._get_cached(cache_key)
            if cached is not None:
                return cached

        last_error = None
        for attempt in range(self._max_retries):
            try:
                response = self.session.request(method, url, **kwargs)
                if response.status_code == 429 or response.status_code >= 500:
                    if attempt < self._max_retries - 1:
                        time.sleep(self._retry_delay(attempt, response.status_code))
                        continue
                    response.raise_for_status()
                response.raise_for_status()
                data = response.json()
                if method.upper() == "GET" and self._cache_enabled:
                    self._set_cache(cache_key, data)
                return data
            except Exception as e:
                last_error = e
                if attempt < self._max_retries - 1:
                    time.sleep(self._retry_delay(attempt))
        raise last_error or Exception("Request failed after retries")

    def _is_expired(self, iso_date_string):
        if not iso_date_string:
            return True
        try:
            # Handle 'Z' suffix for UTC
            iso_str = iso_date_string.replace('Z', '+00:00')
            expiry = datetime.fromisoformat(iso_str)
            now = datetime.now(expiry.tzinfo)
            # Expired if within 5 minutes of expiration
            return (expiry - now).total_seconds() < 300
        except Exception:
            return True

    def _save_token(self, access, refresh, user_obj=None):
        current_user = user_obj
        if not current_user and os.path.exists(self.token_file):
            try:
                with open(self.token_file, "r") as f:
                    existing = json.load(f)
                    if existing.get("state") and existing["state"].get("user"):
                        current_user = existing["state"]["user"]
            except Exception:
                pass

        data = {
            "state": {
                "access": {
                    "token": access.get("token"),
                    "expired_at": access.get("expired_at") or access.get("expires_at")
                },
                "refresh": {
                    "token": refresh.get("token"),
                    "expired_at": refresh.get("expired_at") or refresh.get("expires_at")
                }
            },
            "version": 0
        }
        
        if current_user:
            data["state"]["user"] = current_user
            self.username = current_user.get("username")

        with open(self.token_file, "w") as f:
            json.dump(data, f, indent=2)
            
        self.access_token = access.get("token")
        self.refresh_token = refresh.get("token")
        self.access_expired_at = access.get("expired_at") or access.get("expires_at")
        self.refresh_expired_at = refresh.get("expired_at") or refresh.get("expires_at")
        self.session.headers["Authorization"] = f"Bearer {self.access_token}"

    def _refresh_access_token(self):
        if not self.refresh_token or self._is_expired(self.refresh_expired_at):
            raise Exception("Refresh token is missing or expired. Please login manually to Stockbit again and grab a new token.")
        
        print("🔄 Access token expired. Refreshing token via exodus...")
        headers = dict(self.session.headers)
        headers["Authorization"] = f"Bearer {self.refresh_token}"
        
        res = requests.post(f"{self.exodus_url}/login/refresh", headers=headers)
        res.raise_for_status()
        
        json_data = res.json()
        if not json_data.get("data") or not json_data["data"].get("access"):
            raise Exception("Invalid response format during token refresh.")
            
        self._save_token(json_data["data"]["access"], json_data["data"]["refresh"])
        return True

    def _load_cached_token(self):
        if not os.path.exists(self.token_file):
            return False
            
        try:
            import urllib.parse
            with open(self.token_file, "r") as f:
                content = f.read().strip()
                
            # Auto-decode URL-encoded cookie string if user pasted it directly
            if content.startswith('%7B') or '%22' in content:
                content = urllib.parse.unquote(content)
                
            data = json.loads(content)
                
            # Support backwards compatibility or flattened tokens
            access_obj = None
            refresh_obj = None
            
            if data.get("state") and data["state"].get("access") and data["state"].get("refresh"):
                access_obj = data["state"]["access"]
                refresh_obj = data["state"]["refresh"]
            elif data.get("access_token") and data.get("refresh_token"):
                access_obj = {"token": data["access_token"], "expired_at": data.get("access_expired_at")}
                refresh_obj = {"token": data["refresh_token"], "expired_at": data.get("refresh_expired_at")}
            else:
                return False

            self.access_token = access_obj.get("token")
            self.refresh_token = refresh_obj.get("token")
            self.access_expired_at = access_obj.get("expired_at") or access_obj.get("expires_at")
            self.refresh_expired_at = refresh_obj.get("expired_at") or refresh_obj.get("expires_at")
            self.session.headers["Authorization"] = f"Bearer {self.access_token}"

            if data.get("state") and data["state"].get("user") and data["state"]["user"].get("username"):
                self.username = data["state"]["user"]["username"]

            if self._is_expired(self.access_expired_at):
                self._refresh_access_token()
            else:
                # If it was in the old format, upgrade it to the new format by saving
                if not data.get("state"):
                    self._save_token(access_obj, refresh_obj)
                
            return True
        except Exception as e:
            self.access_token = None
            if "Authorization" in self.session.headers:
                del self.session.headers["Authorization"]
            raise Exception(f"Failed to load or refresh token: {e}")

    def login(self):
        if self._load_cached_token():
            return True
        
        error_msg = (
            "🚨 NO STOCKBIT TOKEN FOUND OR INVALID!\n"
            "Please log in to Stockbit on your web browser, open Developer Tools (F12) -> Application -> Local Storage.\n"
            "Look for the auth object and copy the entire JSON.\n"
            f"Paste it into: {os.path.abspath(self.token_file)}"
        )
        print(error_msg, file=sys.stderr)
        raise Exception("Authentication required.")

    def _get_exodus(self, endpoint, params=None):
        if not self.access_token or self._is_expired(self.access_expired_at):
            self.login()
        url = f"{self.exodus_url}{endpoint}"
        return self._request_with_retry("GET", url, params=params)

    def _post_exodus(self, endpoint, payload=None):
        if not self.access_token or self._is_expired(self.access_expired_at):
            self.login()
        url = f"{self.exodus_url}{endpoint}"
        return self._request_with_retry("POST", url, json=payload)

    def get_profile(self):
        username = self.username or os.environ.get("STOCKBIT_USERNAME")
        if not username:
            try:
                with open(os.path.join(os.getcwd(), '.env'), 'r') as f:
                    for line in f:
                        if line.startswith("STOCKBIT_USERNAME="):
                            username = line.split("=", 1)[1].strip()
                            break
            except Exception:
                pass
                
        if not username:
            raise Exception("Username is required to fetch profile. Missing in token and .env (STOCKBIT_USERNAME)")
        
        return self._get_exodus(f"/user/profile/{username}")

if __name__ == "__main__":
    client = StockbitClient()
    try:
        client.login()
        print("✅ Stockbit BYOT Authentication Successful! Your token is valid.")
        profile = client.get_profile()
        print(f"👤 Profile Found: {profile.get('data', {}).get('profile', {}).get('fullname')} (@{profile.get('data', {}).get('profile', {}).get('username')})")
        sys.exit(0)
    except Exception as e:
        print(f"❌ {e}")
        sys.exit(1)
