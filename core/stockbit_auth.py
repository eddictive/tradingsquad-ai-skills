import os
import requests
import json

class StockbitClient:
    """
    Shared Authentication Client for Stockbit API.
    Handles Login, Token Extraction, Caching, and requests.
    """
    def __init__(self, username=None, password=None):
        self.username = username or os.getenv("STOCKBIT_USERNAME")
        self.password = password or os.getenv("STOCKBIT_PASSWORD")
        self.base_url = "https://stockbit.com"
        self.exodus_url = "https://exodus.stockbit.com"
        self.token_file = os.path.join(os.path.dirname(__file__), "../.stockbit_token.json")
        
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
            "Content-Type": "application/json"
        })
        self.access_token = None

    def _load_cached_token(self):
        if os.path.exists(self.token_file):
            try:
                with open(self.token_file, "r") as f:
                    data = json.load(f)
                    self.access_token = data.get("access_token")
                    if self.access_token:
                        self.session.headers["Authorization"] = f"Bearer {self.access_token}"
                        return True
            except:
                pass
        return False

    def login(self):
        if self._load_cached_token():
            try:
                # Test the token lightly
                self.session.get(f"{self.exodus_url}/emitten/BBCA/info").raise_for_status()
                return True
            except:
                self.access_token = None
                if "Authorization" in self.session.headers:
                    del self.session.headers["Authorization"]

        print(f"Logging in to Stockbit as {self.username}...")
        res = self.session.get(f"{self.base_url}/login")
        if "XSRF-TOKEN" in self.session.cookies:
            self.session.headers["X-XSRF-TOKEN"] = self.session.cookies["XSRF-TOKEN"]
            
        payload = {"username": self.username, "password": self.password}
        response = self.session.post(f"{self.base_url}/api/login/email", json=payload)
        
        if response.status_code == 200 and response.json().get("message") == "You have been successfully logged in":
            self.access_token = response.json()["data"]["access"]["token"]
            self.session.headers["Authorization"] = f"Bearer {self.access_token}"
            with open(self.token_file, "w") as f:
                json.dump({"access_token": self.access_token}, f)
            return True
        raise Exception("Login failed. Check credentials or 2FA.")

    def _get_exodus(self, endpoint, params=None):
        if not self.access_token:
            self.login()
        url = f"{self.exodus_url}{endpoint}"
        response = self.session.get(url, params=params)
        response.raise_for_status()
        return response.json()

# Allow standalone execution to verify auth
if __name__ == "__main__":
    client = StockbitClient()
    try:
        client.login()
        print("✅ Stockbit Shared Authentication Successful! Token is cached.")
    except Exception as e:
        print(f"❌ Stockbit Authentication Failed: {e}")
