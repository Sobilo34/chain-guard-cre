# ChainGuard Bridge API

Realtime bridge between the `chain-guard` frontend and the CRE workflow (`chainguard-sentinel`) with Gemini-assisted scan endpoints.

## Endpoints

- `GET /health`
- `GET /api/system-status`
- `GET /api/contracts`
- `POST /api/contracts`
- `GET /api/overview`
- `GET /api/alerts`
- `POST /api/scan`
- `POST /api/cre/simulate`

## Run

```bash
cd /home/bilal/bilal_projects/Hackathons/chainlink/chain-guard-cre/bridge-api
cp .env.example .env
npm install
npm run dev
```

## Notes

- `POST /api/scan` uses Gemini if `GEMINI_API_KEY` is set, otherwise returns deterministic fallback analysis.
- `POST /api/cre/simulate` invokes `bunx cre workflow simulate` from project root and returns captured output.
