# ChainGuard Sentinel - CRE Workflow

Real-time smart contract risk monitoring powered by Chainlink Runtime Environment and Gemini AI.

## Setup

### 1. Environment Variables

Copy the example environment file and add your credentials:

```bash
cp .env.example .env
```

Edit `.env` and set your Gemini API key:

```env
GEMINI_API_KEY=your_actual_api_key_here
```

**Important:** Never commit `.env` to version control. The key is already in `.gitignore`.

### 2. Configuration

Edit `config.json`, `config.staging.json`, or `config.production.json` to configure:

- Monitored contracts
- Risk thresholds
- Alert channels
- Cron schedules

**Note:** The `geminiApiKey` field has been removed from config files for security. The workflow now loads the key from:

1. Environment variable `GEMINI_API_KEY`
2. `.env` file (via `tryLoadGeminiKeyFromLocalFiles()`)
3. CRE secrets (when available in production)

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Simulation

```bash
bunx cre workflow simulate chainguard-sentinel -T local-simulation --non-interactive --trigger-index 0
```

### 5. Deploy to Staging/Production

```bash
bunx cre workflow compile chainguard-sentinel
bunx cre workflow deploy chainguard-sentinel -T staging
```

## Architecture

- **main.ts**: Cron-triggered workflow orchestrator
- **gemini.ts**: Gemini AI integration with fallback logic
- **evm.ts**: On-chain data fetching via CRE capabilities
- **chainlink-feeds.ts**: Chainlink Data Feeds integration
- **risk-evaluator.ts**: Risk assessment logic
- **notifications.ts**: Alert delivery system
- **api-handler.ts**: HTTP API for runtime state

## Security Best Practices

- Store API keys in `.env` (local) or CRE secrets (production)
- Never hardcode credentials in config files
- Use separate keys for staging and production
- Rotate keys regularly
- Review `.gitignore` to ensure sensitive files are excluded
