# mPOWER MEO Constellation Simulator

**Version:** v4.5.4
**Stack:** React 18 · D3 v7 · Recharts · Vite

A browser-based orbital analysis and flight-route simulation tool modelling the **SES O3b mPOWER** Ka-band MEO satellite constellation.

## Quick start

```bash
npm install
npm run dev
```

Then open http://localhost:5173

## Build for production

```bash
npm run build
```

Output goes to `dist/` — deployable to any static host.

## Features

- Coverage Map with equirectangular world projection
- Flight Summary with TX/RX link quality ribbon
- Gateway management (12 standard sites + custom)
- Gateway weather risk (Open-Meteo API)
- Spot-beam projection with KML export
- Handover analysis
- Elevation/time charts
- Ka-band link budget with DVB-S2X modcods

## License

MIT


## REAL FLIGHT mode and the OpenSky proxy

The simulator's **REAL FLIGHT (OpenSky)** feature replays live ADS-B flight tracks alongside the constellation simulation. This requires a small personal proxy that handles OAuth2 authentication and CORS for OpenSky Network's API.

### For users of the live demo

The deployed version (`https://spoora.github.io/mpower-simulator/`) talks to a personal proxy at `https://opensky.spoormaker.io`, which routes through a Cloudflare Tunnel to the maintainer's laptop. Two implications:

- **The proxy is best-effort, not always-on.** If the maintainer's laptop is offline, REAL FLIGHT searches will fail with "Failed to fetch" or HTTP errors. The synthetic FLIGHT SIM mode (great-circle paths) always works regardless.
- **Some corporate networks block it.** New subdomains may be categorized as "Newly Revived Domains" by web filters. If you see "Failed to fetch" specifically on REAL FLIGHT requests on a work network, try from a phone on cellular — if it works there, it's a network-level filter at your end.

### For people running their own deployment

If you fork this repo and want REAL FLIGHT to work for your deployment, you must run your own proxy with your own OpenSky credentials. The proxy bridges three problems:

- **CORS** — OpenSky's API doesn't include `Access-Control-Allow-Origin` headers
- **OAuth2** — `/api/flights/*` and `/api/tracks/*` require a Bearer token refreshed every 30 minutes
- **Credentials** — your `client_id` / `client_secret` cannot live in browser code

See **OPENSKY_PROXY_SETUP.md** for the complete architecture and step-by-step setup instructions:

- Architecture diagram (browser → Cloudflare → tunnel → laptop → OpenSky)
- Why each layer exists
- The proxy code itself (Node.js, ~50 lines, no dependencies)
- Cloudflare Tunnel setup with `cloudflared`
- macOS `launchd` plists for auto-restart and reboot survival
- Day-to-day operation, troubleshooting, and security notes

Once your proxy is running at e.g. `https://opensky.your-domain.com`, change the `OPENSKY_PROXY` constant in `mpower_simulator.jsx`:

```javascript
const OPENSKY_PROXY = "https://opensky.your-domain.com";
```

Rebuild and deploy as usual.
