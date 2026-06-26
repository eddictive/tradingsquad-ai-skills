import os
import requests
import json
import sys
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
        
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Origin": "https://stockbit.com",
            "Referer": "https://stockbit.com/"
        })

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

    def _save_token(self, access, refresh):
        data = {
            "access_token": access.get("token"),
            "access_expired_at": access.get("expired_at") or access.get("expires_at"),
            "refresh_token": refresh.get("token"),
            "refresh_expired_at": refresh.get("expired_at") or refresh.get("expires_at")
        }
        with open(self.token_file, "w") as f:
            json.dump(data, f, indent=2)
            
        self.access_token = data["access_token"]
        self.refresh_token = data["refresh_token"]
        self.access_expired_at = data["access_expired_at"]
        self.refresh_expired_at = data["refresh_expired_at"]
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
                
            # Auto-migrate raw JSON payload from LocalStorage (if provided by user)
            if data.get("state") and data["state"].get("access"):
                self._save_token(data["state"]["access"], data["state"]["refresh"])
                return True
                
            if not data.get("access_token"):
                return False

            self.access_token = data["access_token"]
            self.refresh_token = data["refresh_token"]
            self.access_expired_at = data["access_expired_at"]
            self.refresh_expired_at = data["refresh_expired_at"]
            self.session.headers["Authorization"] = f"Bearer {self.access_token}"

            if self._is_expired(self.access_expired_at):
                self._refresh_access_token()
                
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
        response = self.session.get(url, params=params)
        response.raise_for_status()
        return response.json()

    def _post_exodus(self, endpoint, payload=None):
        if not self.access_token or self._is_expired(self.access_expired_at):
            self.login()
        url = f"{self.exodus_url}{endpoint}"
        response = self.session.post(url, json=payload)
        response.raise_for_status()
        return response.json()

if __name__ == "__main__":
    client = StockbitClient()
    try:
        client.login()
        print("✅ Stockbit BYOT Authentication Successful! Your token is valid.")
    except Exception as e:
        print(f"❌ {e}")
