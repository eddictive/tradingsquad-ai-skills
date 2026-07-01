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
    this.username = null;

    this.headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Origin": "https://stockbit.com",
      "Referer": "https://stockbit.com/"
    };

    this._responseCache = new Map();
    const envTtl = Number(process.env.STOCKBIT_CACHE_TTL_MS);
    this._cacheTtlMs = Number.isFinite(envTtl) && envTtl >= 0 ? envTtl : 30_000;
    this._cacheEnabled = this._cacheTtlMs > 0;
    this._maxRetries = 3;
    this._retryBaseMs = 500;
  }

  clearCache() {
    this._responseCache.clear();
  }

  getCacheStats() {
    const now = Date.now();
    let active = 0;
    for (const entry of this._responseCache.values()) {
      if (entry.expiresAt > now) active += 1;
    }
    return {
      enabled: this._cacheEnabled,
      ttlMs: this._cacheTtlMs,
      entries: this._responseCache.size,
      activeEntries: active,
    };
  }

  _cacheKey(method, url) {
    return `${method}:${url}`;
  }

  _getCached(key) {
    const entry = this._responseCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this._responseCache.delete(key);
      return null;
    }
    return entry.data;
  }

  _setCache(key, data) {
    this._responseCache.set(key, { data, expiresAt: Date.now() + this._cacheTtlMs });
  }

  _retryDelayMs(attempt, status) {
    const base = status === 429 ? this._retryBaseMs * 4 : this._retryBaseMs;
    return base * Math.pow(2, attempt);
  }

  async _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async _fetchWithRetry(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const cacheKey = this._cacheKey(method, url);

    if (method === 'GET' && this._cacheEnabled) {
      const cached = this._getCached(cacheKey);
      if (cached) return cached;
    }

    let lastError;
    for (let attempt = 0; attempt < this._maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);
        if (response.status === 429 || response.status >= 500) {
          if (attempt < this._maxRetries - 1) {
            await this._sleep(this._retryDelayMs(attempt, response.status));
            continue;
          }
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        const json = await response.json();
        if (method === 'GET' && this._cacheEnabled) this._setCache(cacheKey, json);
        return json;
      } catch (err) {
        lastError = err;
        if (attempt < this._maxRetries - 1) {
          await this._sleep(this._retryDelayMs(attempt));
        }
      }
    }
    throw lastError || new Error('Request failed after retries');
  }

  _isExpired(isoDateString) {
    if (!isoDateString) return true;
    const expiry = new Date(isoDateString).getTime();
    const now = Date.now();
    // Expired if within 5 minutes of expiration
    return (expiry - now) < (5 * 60 * 1000);
  }

  _saveToken(access, refresh, userObj = null) {
    let currentUser = userObj;
    if (!currentUser && fs.existsSync(this.tokenFile)) {
       try {
         const existing = JSON.parse(fs.readFileSync(this.tokenFile, 'utf8'));
         if (existing.state && existing.state.user) {
            currentUser = existing.state.user;
         }
       } catch(e) {}
    }

    const data = {
      state: {
        access: {
          token: access.token,
          expired_at: access.expired_at || access.expires_at
        },
        refresh: {
          token: refresh.token,
          expired_at: refresh.expired_at || refresh.expires_at
        }
      },
      version: 0
    };
    
    if (currentUser) {
      data.state.user = currentUser;
      this.username = currentUser.username;
    }

    fs.writeFileSync(this.tokenFile, JSON.stringify(data, null, 2));
    
    this.accessToken = access.token;
    this.refreshToken = refresh.token;
    this.accessExpiredAt = access.expired_at || access.expires_at;
    this.refreshExpiredAt = refresh.expired_at || refresh.expires_at;
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
      
      // Support backwards compatibility or flattened tokens
      let accessObj, refreshObj;
      
      if (data.state && data.state.access && data.state.refresh) {
        accessObj = data.state.access;
        refreshObj = data.state.refresh;
      } else if (data.access_token && data.refresh_token) {
        accessObj = { token: data.access_token, expired_at: data.access_expired_at };
        refreshObj = { token: data.refresh_token, expired_at: data.refresh_expired_at };
      } else {
        return false;
      }

      this.accessToken = accessObj.token;
      this.refreshToken = refreshObj.token;
      this.accessExpiredAt = accessObj.expired_at || accessObj.expires_at;
      this.refreshExpiredAt = refreshObj.expired_at || refreshObj.expires_at;
      this.headers["Authorization"] = `Bearer ${this.accessToken}`;

      if (data.state && data.state.user && data.state.user.username) {
        this.username = data.state.user.username;
      }

      if (this._isExpired(this.accessExpiredAt)) {
        await this._refreshAccessToken();
      } else {
        // If it was in the old format, upgrade it to the new format by saving
        if (!data.state) {
            this._saveToken(accessObj, refreshObj);
        }
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
    Object.keys(params).forEach(key => {
      if (Array.isArray(params[key])) {
        params[key].forEach(val => url.searchParams.append(key, val));
      } else {
        url.searchParams.append(key, params[key]);
      }
    });
    return this._fetchWithRetry(url.toString(), { method: 'GET', headers: this.headers });
  }

  async _postExodus(endpoint, payload = {}) {
    if (!this.accessToken || this._isExpired(this.accessExpiredAt)) {
      await this.login();
    }
    return this._fetchWithRetry(`${this.exodusUrl}${endpoint}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
    });
  }

  async getProfile() {
    let username = this.username || process.env.STOCKBIT_USERNAME;
    if (!username) {
      try {
        const envContent = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
        const match = envContent.match(/^STOCKBIT_USERNAME=(.*)$/m);
        if (match) username = match[1].trim();
      } catch (e) {}
    }
    
    if (!username) {
      throw new Error("Username is required to fetch profile. Missing in token and .env (STOCKBIT_USERNAME)");
    }
    const res = await this._getExodus(`/user/profile/${username}`);
    return res;
  }
}

if (require.main === module) {
  (async () => {
    const client = new StockbitClient();
    try {
      await client.login();
      console.log("✅ Stockbit BYOT Authentication Successful! Your token is valid.");
      const profile = await client.getProfile();
      console.log(`👤 Profile Found: ${profile.data.profile.fullname} (@${profile.data.profile.username})`);
    } catch (e) {
      console.error(`❌ ${e.message}`);
    }
  })();
}

module.exports = { StockbitClient };
