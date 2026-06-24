const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (!process.env[key]) process.env[key] = value;
      }
    });
  }
}
loadEnv();

class StockbitClient {
  constructor(username, password) {
    this.username = username || process.env.STOCKBIT_USERNAME;
    this.password = password || process.env.STOCKBIT_PASSWORD;
    this.baseUrl = "https://stockbit.com";
    this.exodusUrl = "https://exodus.stockbit.com";
    this.tokenFile = path.join(__dirname, "../.stockbit_token.json");
    
    this.accessToken = null;
    this.headers = {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json",
      "Content-Type": "application/json"
    };
  }

  async _loadCachedToken() {
    if (fs.existsSync(this.tokenFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.tokenFile, 'utf8'));
        if (data.access_token) {
          this.accessToken = data.access_token;
          this.headers["Authorization"] = `Bearer ${this.accessToken}`;
          try {
            const res = await fetch(`${this.exodusUrl}/emitten/BBCA/info`, { headers: this.headers });
            if (!res.ok) throw new Error("Expired");
            return true;
          } catch (e) {
            this.accessToken = null;
            delete this.headers["Authorization"];
          }
        }
      } catch (e) {}
    }
    return false;
  }

  async login() {
    if (await this._loadCachedToken()) return true;
    if (!this.username || !this.password) throw new Error("Username/password required.");

    try {
      const res1 = await fetch(`${this.baseUrl}/login`, { headers: this.headers });
      const cookies = res1.headers.get("set-cookie");
      if (cookies) {
        const match = cookies.match(/XSRF-TOKEN=([^;]+)/);
        if (match) {
          this.headers["X-XSRF-TOKEN"] = decodeURIComponent(match[1]);
          this.headers["Cookie"] = `XSRF-TOKEN=${match[1]}`;
        }
      }
    } catch(e) {}

    const payload = { username: this.username, password: this.password };
    const response = await fetch(`${this.baseUrl}/api/login/email`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (response.ok && data.message === "You have been successfully logged in") {
      this.accessToken = data.data.access.token;
      this.headers["Authorization"] = `Bearer ${this.accessToken}`;
      fs.writeFileSync(this.tokenFile, JSON.stringify({ access_token: this.accessToken }));
      return true;
    }
    throw new Error(`Login failed: ${data.message || response.statusText}`);
  }

  async _getExodus(endpoint, params = {}) {
    if (!this.accessToken) await this.login();
    const url = new URL(`${this.exodusUrl}${endpoint}`);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    const response = await fetch(url.toString(), { headers: this.headers });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    return response.json();
  }
}

// Allow standalone execution to verify auth
if (require.main === module) {
  (async () => {
    const client = new StockbitClient();
    try {
      await client.login();
      console.log("✅ Stockbit Shared Authentication Successful! Token is cached.");
    } catch (e) {
      console.error(`❌ Stockbit Authentication Failed: ${e.message}`);
    }
  })();
}

module.exports = { StockbitClient };
