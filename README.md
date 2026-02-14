# ChainGuard Sentinel - CRE Workflow

AI-Powered Smart Contract Risk Monitoring using Chainlink Runtime Environment (CRE)

## Overview

ChainGuard Sentinel is a decentralized monitoring and alerting system for deployed smart contracts. It leverages:

- **Chainlink Runtime Environment (CRE)** for decentralized workflow orchestration
- **Chainlink Data Feeds** for real-time market data
- **Gemini AI** for predictive risk analysis
- **Multi-channel alerts** for instant notifications

## Features

### 🔍 Risk Detection

- **Depeg Monitoring**: Detect stablecoin price deviations
- **Volatility Alerts**: Track sudden price swings
- **Liquidity Warnings**: Monitor pool liquidity drops
- **Collateral Ratio Tracking**: Alert on under-collateralization
- **AI-Enhanced Predictions**: Use Gemini for forecasting risks

### 🔔 Alert Channels

- Email notifications
- Slack webhooks
- Telegram bot messages
- Discord webhooks
- On-chain notifications (optional)

### 🌐 Multi-Chain Support

- Ethereum (Mainnet & Sepolia)
- Polygon (Mainnet & Amoy)
- Easily extensible to other EVM chains

## Project Structure

```
chainguard-cre-workflow/
├── project.yaml                    # CRE project settings
├── secrets.yaml                    # API keys and credentials (DO NOT COMMIT)
├── README.md                       # This file
└── chainguard-sentinel/
    ├── workflow.yaml               # Workflow deployment settings
    ├── package.json                # Dependencies
    ├── tsconfig.json               # TypeScript config
    ├── config.json                 # Development config
    ├── config.staging.json         # Staging config
    ├── config.production.json      # Production config
    ├── main.ts                     # Main workflow orchestration
    ├── types.ts                    # TypeScript types and schemas
    ├── evm.ts                      # On-chain data fetching
    ├── chainlink-feeds.ts          # Chainlink Data Feeds integration
    ├── gemini.ts                   # AI risk analysis
    ├── notifications.ts            # Alert delivery system
    └── risk-evaluator.ts           # Risk scoring and threshold logic
```

## Setup

### 1. Prerequisites

- [Bun](https://bun.sh) runtime installed
- Chainlink CRE CLI installed
- API keys for:
  - Gemini AI
  - Email service (SendGrid/Mailgun)
  - Slack/Telegram/Discord (optional)

### 2. Install Dependencies

```bash
cd chainguard-sentinel
bun install
```

### 3. Configure Secrets

Edit `secrets.yaml` with your API keys:

```yaml
GEMINI_API_KEY: "your-actual-api-key"
EMAIL_API_KEY: "your-email-api-key"
SLACK_WEBHOOK_URL: "https://hooks.slack.com/..."
```

### 4. Configure Monitoring

Edit `config.json` to add contracts to monitor:

```json
{
  "monitoredContracts": [
    {
      "address": "0x1234...",
      "name": "My DeFi Protocol",
      "chainSelectorName": "ethereum-testnet-sepolia",
      "riskThresholds": {
        "depegTolerance": 0.02,
        "volatilityMax": 0.1,
        "liquidityDropMax": 0.2
      },
      "alertChannels": ["email", "slack"]
    }
  ]
}
```

## Deployment

### Local Simulation

```bash
cre workflow run local-simulation
```

### Staging Deployment

```bash
cre workflow deploy staging
```

### Production Deployment

```bash
cre workflow deploy production
```

## How It Works

1. **Cron Trigger**: Workflow runs every 5 minutes (configurable)
2. **Data Collection**:
   - Reads smart contract state via EVM calls
   - Fetches market data from Chainlink Price Feeds
3. **AI Analysis**:
   - Sends data to Gemini AI for risk assessment
   - Receives risk scores and predictions
4. **Risk Evaluation**:
   - Compares metrics against configured thresholds
   - Determines alert severity
5. **Alert Delivery**:
   - Sends notifications via configured channels
   - Includes actionable recommendations

## Configuration Reference

### Risk Thresholds

- `depegTolerance`: Max allowed stablecoin price deviation (e.g., 0.02 = 2%)
- `volatilityMax`: Max 24h price volatility (e.g., 0.10 = 10%)
- `liquidityDropMax`: Max liquidity decrease (e.g., 0.20 = 20%)
- `collateralRatioMin`: Min collateralization ratio (e.g., 1.5 = 150%)

### Alert Channels

- `email`: Email notifications
- `slack`: Slack workspace alerts
- `telegram`: Telegram chat messages
- `discord`: Discord channel webhooks

## Architecture

```
Cron Trigger (every 5 min)
    ↓
[Data Collection Layer]
├── EVM Reads (contract state)
└── Chainlink Feeds (market data)
    ↓
[AI Analysis Layer]
└── Gemini Risk Assessment
    ↓
[Risk Evaluation Layer]
└── Threshold Comparison
    ↓
[Alert Delivery Layer]
├── Email
├── Slack
├── Telegram
└── Discord
```

## Security Considerations

- **Decentralized Execution**: Runs on Chainlink DONs (no single point of failure)
- **Consensus Aggregation**: Multiple nodes verify data before alerts
- **Privacy-Preserving**: Sensitive data encrypted via CRE secrets
- **Audit Trails**: All executions logged for compliance

## Roadmap

- [x] Phase 1: Core monitoring engine
- [x] Phase 2: Chainlink Data Feeds integration
- [x] Phase 3: Gemini AI risk analysis
- [x] Phase 4: Multi-channel alerts
- [ ] Phase 5: Cross-chain monitoring via CCIP
- [ ] Phase 6: ACE integration for compliance
- [ ] Phase 7: On-chain governance notifications
- [ ] Phase 8: Mobile app integration

## Support

For issues or questions, please open an issue on GitHub or contact the team.

## License

MIT License - see LICENSE file for details
