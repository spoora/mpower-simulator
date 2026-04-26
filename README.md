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

