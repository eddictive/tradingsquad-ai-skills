const fs = require('fs');
const path = require('path');

class StockbitClient {
  constructor() {
    this.exodusUrl = "https://exodus.stockbit.com";
    
    const cwdPath = path.join(process.cwd(), '.stockbit_token.json');
    const localPath = path.join(__dirname, '../.stockbit_token.json');
    
    if (fs.existsSync(cwdPath)) {
      this.tokenFile = cwdPath;
    } else if (fs.existsSync(localPath)) {
      this.tokenFile = localPath;
    } else {
      this.tokenFile = cwdPath; // Default to workspace root
    }
    
    this.accessToken = null;
    this.refreshToken = null;
    this.accessExpiredAt = null;
    this.refreshExpiredAt = null;

    this.headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Origin": "https://stockbit.com",
      "Referer": "https://stockbit.com/"
    };
  }

  _isExpired(isoDateString) {
    if (!isoDateString) return true;
    const expiry = new Date(isoDateString).getTime();
    const now = Date.now();
    // Expired if within 5 minutes of expiration
    return (expiry - now) < (5 * 60 * 1000);
  }

  _saveToken(access, refresh) {
    const data = {
      access_token: access.token,
      access_expired_at: access.expired_at || access.expires_at,
      refresh_token: refresh.token,
      refresh_expired_at: refresh.expired_at || refresh.expires_at
    };
    fs.writeFileSync(this.tokenFile, JSON.stringify(data, null, 2));
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.accessExpiredAt = data.access_expired_at;
    this.refreshExpiredAt = data.refresh_expired_at;
    this.headers["Authorization"] = `Bearer ${this.accessToken}`;
  }

  async _refreshAccessToken() {
    if (!this.refreshToken || this._isExpired(this.refreshExpiredAt)) {
      throw new Error("Refresh token is missing or expired. Please login manually to Stockbit again and grab a new token.");
    }

    console.log("🔄 Access token expired. Refreshing token via exodus...");
    const refreshHeaders = { ...this.headers };
    refreshHeaders["Authorization"] = `Bearer ${this.refreshToken}`;
    
    const res = await fetch(`${this.exodusUrl}/login/refresh`, {
      method: 'POST',
      headers: refreshHeaders
    });

    if (!res.ok) {
      throw new Error(`Token refresh failed with HTTP ${res.status}`);
    }

    const json = await res.json();
    if (!json.data || !json.data.access || !json.data.refresh) {
      throw new Error("Invalid response format during token refresh.");
    }

    this._saveToken(json.data.access, json.data.refresh);
    return true;
  }

  async _loadCachedToken() {
    if (!fs.existsSync(this.tokenFile)) return false;

    try {
      let content = fs.readFileSync(this.tokenFile, 'utf8').trim();
      
      // Auto-decode URL-encoded cookie string if user pasted it directly
      if (content.startsWith('%7B') || content.includes('%22')) {
        content = decodeURIComponent(content);
      }
      
      const data = JSON.parse(content);
      
      // Auto-migrate raw JSON payload from LocalStorage (if provided by user)
      if (data.state && data.state.access && data.state.refresh) {
         this._saveToken(data.state.access, data.state.refresh);
         return true;
      }
      
      if (!data.access_token) return false;

      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      this.accessExpiredAt = data.access_expired_at;
      this.refreshExpiredAt = data.refresh_expired_at;
      this.headers["Authorization"] = `Bearer ${this.accessToken}`;

      if (this._isExpired(this.accessExpiredAt)) {
        await this._refreshAccessToken();
      }
      return true;
    } catch (e) {
      this.accessToken = null;
      delete this.headers["Authorization"];
      throw new Error(`Failed to load or refresh token: ${e.message}`);
    }
  }

  async login() {
    if (await this._loadCachedToken()) return true;

    const errorMsg = `🚨 NO STOCKBIT TOKEN FOUND OR INVALID!
Please log in to Stockbit on your web browser, open Developer Tools (F12) -> Application -> Local Storage.
Look for the auth object and copy the entire JSON.
Paste it into: ${path.resolve(this.tokenFile)}`;
    
    console.error(errorMsg);
    throw new Error("Authentication required.");
  }

  async _getExodus(endpoint, params = {}) {
    if (!this.accessToken || this._isExpired(this.accessExpiredAt)) {
      await this.login();
    }
    const url = new URL(`${this.exodusUrl}${endpoint}`);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    const response = await fetch(url.toString(), { headers: this.headers });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    return response.json();
  }
}

if (require.main === module) {
  (async () => {
    const client = new StockbitClient();
    try {
      await client.login();
      console.log("✅ Stockbit BYOT Authentication Successful! Your token is valid.");
    } catch (e) {
      console.error(`❌ ${e.message}`);
    }
  })();
}

module.exports = { StockbitClient };
