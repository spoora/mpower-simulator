# OpenSky Proxy Setup

The mPOWER MEO Constellation Simulator's **REAL FLIGHT** feature pulls live ADS-B data from the [OpenSky Network](https://opensky-network.org). OpenSky requires OAuth2 authentication and rejects browser requests for CORS reasons, so the simulator cannot call OpenSky directly. A small personal proxy bridges the gap.

This document describes the architecture and the steps to set up your own proxy. If you don't intend to use the REAL FLIGHT feature, you can ignore this entirely — the synthetic FLIGHT SIM mode (great-circle paths between cities) needs no external services.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (mPOWER simulator)                                     │
│  https://spoora.github.io/mpower-simulator/                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              │ (CORS-enabled, plain HTTP requests)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Cloudflare Edge                                                │
│  opensky.spoormaker.io  (custom domain on Cloudflare DNS)       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Cloudflare Tunnel (cloudflared)
                              │ Reverse-proxies to local laptop
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Personal laptop (always on)                                    │
│  localhost:3001  →  local-proxy.js  (Node.js HTTP server)       │
│                                                                  │
│  Responsibilities:                                              │
│    • Adds CORS headers (browser can call across origins)        │
│    • Caches OAuth token (refreshes every ~30 min)               │
│    • Forwards GET requests to opensky-network.org with auth     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS, OAuth2 Bearer token
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  opensky-network.org/api/...                                    │
│  /flights/departure   /tracks/all   /states/all                 │
└─────────────────────────────────────────────────────────────────┘
```

## Why the proxy is needed

The simulator runs entirely in the browser and would prefer to call OpenSky directly. Three things block that:

1. **CORS** — OpenSky's API does not include `Access-Control-Allow-Origin` headers, so any browser fetch from a third-party origin (e.g. github.io) is blocked before it reaches the network.
2. **OAuth2** — OpenSky's `/api/flights/*` and `/api/tracks/*` endpoints require an OAuth2 access token in the `Authorization` header. Tokens last 30 minutes and must be refreshed using a `client_id` + `client_secret`. Putting credentials in browser code would expose them to anyone who views the page source.
3. **Rate limit accounting** — OpenSky tracks per-OAuth-credential limits. A central proxy means the entire app counts against one quota rather than each user's IP separately.

The proxy solves all three: it's a thin server-side relay that adds CORS, does the OAuth dance once, caches the token, and forwards GET requests with the bearer token attached.

## Why a Cloudflare Tunnel

Putting `local-proxy.js` directly on the public internet would require:
- Opening a port through your home router/firewall
- A static IP or dynamic DNS service
- A TLS certificate (Let's Encrypt or similar)
- Hardening against the random scanners that probe every public IP

Cloudflare Tunnel (`cloudflared`) sidesteps all of that. The tunnel daemon makes an outbound connection from your laptop to Cloudflare's edge. Cloudflare then routes traffic from the public hostname (`opensky.spoormaker.io`) through that tunnel to your laptop's `localhost:3001`. No inbound port, no router config, no certificate management — Cloudflare handles TLS at the edge.

The trade-off: your laptop must be running for the proxy to be reachable. For occasional personal use this is fine. For a service that needs 24/7 uptime, you'd deploy the proxy as a Cloudflare Worker or a cheap VPS instead.

## Setting up your own proxy

If you want to run REAL FLIGHT mode against your own credentials, follow these steps. The result is a proxy at `https://your-subdomain.your-domain.com` that you'd then point the simulator's `OPENSKY_PROXY` constant at.

### Prerequisites

- A laptop or always-on machine (instructions below assume macOS with Apple Silicon; Linux is similar)
- Homebrew installed
- Node.js 18 or later (built-in `fetch` API is required)
- A domain registered through Cloudflare (or transferred to Cloudflare DNS)
- An OpenSky account with API credentials

### Step 1 — Get OpenSky API credentials

1. Sign up at https://opensky-network.org (free)
2. Go to your account page
3. Create an API client — you'll get a `client_id` and `client_secret`
4. Note: the free tier allows ~4000 credit-points per day. `/flights/departure` costs 4 credits per call, `/tracks/all` costs 4. Plenty for personal use.

### Step 2 — Write the proxy

Create `~/opensky-proxy/local-proxy.js`:

```javascript
const http = require('http');

const CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET_HERE';
const TOKEN_URL = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const OPENSKY_BASE = 'https://opensky-network.org';

let cachedToken = null;
let tokenExpiry = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  console.log('[token] Fetching new token...');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`
  });
  const data = await res.json();
  cachedToken = data.access_token;
  // Refresh 60s before actual expiry to avoid race condition
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  console.log('[token] Token cached, expires in', data.expires_in, 'seconds');
  return cachedToken;
}

const server = http.createServer(async (req, res) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'opensky-local-proxy' }));
    return;
  }
  try {
    const token = await getToken();
    const upstreamUrl = OPENSKY_BASE + req.url;
    console.log('[proxy]', req.method, upstreamUrl);
    const upstream = await fetch(upstreamUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    });
    const body = await upstream.text();
    res.writeHead(upstream.status, { ...cors, 'Content-Type': 'application/json' });
    res.end(body);
  } catch (e) {
    console.error('[error]', e.message);
    res.writeHead(502, { ...cors, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(3001, () => console.log('[proxy] Listening on http://localhost:3001'));
```

Replace `YOUR_CLIENT_ID_HERE` and `YOUR_CLIENT_SECRET_HERE` with your actual OpenSky credentials. (For a more secure setup, load these from a `.env` file using `node --env-file=.env local-proxy.js`.)

Test it:

```bash
node ~/opensky-proxy/local-proxy.js
```

In another terminal:

```bash
curl http://localhost:3001/health
# → {"ok":true,"service":"opensky-local-proxy"}
```

### Step 3 — Set up the Cloudflare Tunnel

Install cloudflared:

```bash
brew install cloudflared
```

Authenticate (opens a browser):

```bash
cloudflared tunnel login
```

Pick the domain you want to use. This downloads a certificate to `~/.cloudflared/cert.pem`.

Create a tunnel (replace `mytunnel` with whatever name you prefer):

```bash
cloudflared tunnel create mytunnel
```

This prints a UUID and creates `~/.cloudflared/<UUID>.json` (the credentials file).

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: <PASTE-UUID-HERE>
credentials-file: /Users/YOU/.cloudflared/<UUID>.json

ingress:
  - hostname: opensky.your-domain.com
    service: http://localhost:3001
  - service: http_status:404
```

Route the public hostname to the tunnel:

```bash
cloudflared tunnel route dns mytunnel opensky.your-domain.com
```

Validate the config:

```bash
cloudflared tunnel --config ~/.cloudflared/config.yml ingress validate
# → OK
```

Run the tunnel:

```bash
cloudflared tunnel run mytunnel
```

Test from anywhere:

```bash
curl https://opensky.your-domain.com/health
# → {"ok":true,"service":"opensky-local-proxy"}
```

### Step 4 — Make both services persistent (launchd)

You don't want to leave a terminal open running these. Two launchd plists keep them alive across reboots, terminal closes, and crashes.

**Proxy plist** (`~/Library/LaunchAgents/com.yourname.opensky-proxy.plist`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTD/PropertyLists-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.yourname.opensky-proxy</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/node</string>
    <string>/Users/YOU/opensky-proxy/local-proxy.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/Users/YOU/opensky-proxy</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/Users/YOU/opensky-proxy/proxy.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/YOU/opensky-proxy/proxy.err.log</string>
</dict>
</plist>
```

**Tunnel plist** (`~/Library/LaunchAgents/com.yourname.cloudflared.plist`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTD/PropertyLists-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.yourname.cloudflared</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/cloudflared</string>
    <string>tunnel</string>
    <string>--no-autoupdate</string>
    <string>run</string>
    <string>mytunnel</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/Users/YOU</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>30</integer>
  <key>StandardOutPath</key>
  <string>/Users/YOU/opensky-proxy/cloudflared.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/YOU/opensky-proxy/cloudflared.err.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
```

Replace `YOU` with your username, `yourname` with whatever namespace you like, and `mytunnel` with your tunnel name.

For Intel Macs, replace `/opt/homebrew/bin/` with `/usr/local/bin/`.

Load both:

```bash
launchctl load ~/Library/LaunchAgents/com.yourname.opensky-proxy.plist
launchctl load ~/Library/LaunchAgents/com.yourname.cloudflared.plist
```

Verify:

```bash
launchctl list | grep -E "opensky|cloudflared"
# Should show both with PIDs
```

### Step 5 — Point the simulator at your proxy

In `mpower_simulator.jsx`, find the line:

```javascript
const OPENSKY_PROXY = "https://opensky.spoormaker.io";
```

and change it to your domain:

```javascript
const OPENSKY_PROXY = "https://opensky.your-domain.com";
```

Rebuild and deploy as usual.

## Operating the proxy day-to-day

You shouldn't need to think about it. Here are the commands for when you do:

```bash
# Health check (local — bypasses Cloudflare)
curl http://localhost:3001/health

# Health check (end-to-end through tunnel)
curl https://opensky.your-domain.com/health

# Are the services running under launchd?
launchctl list | grep -E "opensky|cloudflared"

# Live logs
tail -f ~/opensky-proxy/proxy.log
tail -f ~/opensky-proxy/cloudflared.log

# Restart proxy (e.g. after editing local-proxy.js)
launchctl unload ~/Library/LaunchAgents/com.yourname.opensky-proxy.plist && \
launchctl load   ~/Library/LaunchAgents/com.yourname.opensky-proxy.plist

# Restart tunnel (e.g. after editing config.yml)
launchctl unload ~/Library/LaunchAgents/com.yourname.cloudflared.plist && \
launchctl load   ~/Library/LaunchAgents/com.yourname.cloudflared.plist

# Stop a service permanently
launchctl unload ~/Library/LaunchAgents/com.yourname.opensky-proxy.plist
```

## Troubleshooting

**"Failed to fetch" in the simulator's REAL FLIGHT search**

Most common cause: corporate or ISP-level DNS filter blocking the proxy domain (often categorized as "Newly Revived Domain" for new subdomains). Test from a phone on cellular — if it works there, it's a network filter on your current network.

**"HTTP 404" on a flight search**

That's OpenSky's way of saying "no flights found for this airport on this date" — not an error in the proxy. Try a larger hub (KJFK, EGLL, OMDB) or a date 2-7 days ago. The simulator translates this to a friendly message.

**"HTTP 403" on a flight search**

Either OpenSky has rate-limited your credentials (free tier limit hit — wait for the daily reset at 00:00 UTC) or the OAuth token itself was rejected. Check `tail ~/opensky-proxy/proxy.log` for `[error]` lines.

**Proxy stops responding**

Check whether either service died:

```bash
launchctl list | grep -E "opensky|cloudflared"
```

If a service shows status `-` instead of `0`, it crashed. Check the corresponding `*.err.log`. `KeepAlive` should auto-restart it within seconds.

**OAuth token never refreshes / requests fail with 401 after a while**

The proxy refreshes 60 seconds before token expiry on demand (whenever a request arrives). If no requests are made for hours, the cached token expires; the next request fetches a fresh one. There is no scheduled refresh — it's lazy. If you see `[token] Fetching new token...` in the log every 30 minutes during active use, refresh is working.

## Security notes

- Don't commit `local-proxy.js` with credentials in it to a public repo. Use a `.env` file and `.gitignore` it.
- The proxy as written has no authentication — anyone who finds the URL can hit it. For a personal-use proxy hidden behind an obscure subdomain this is acceptable; for anything more public, add a shared-secret header check.
- The proxy is GET-only and forwards to a fixed upstream base URL. It cannot be used to proxy arbitrary external requests.
