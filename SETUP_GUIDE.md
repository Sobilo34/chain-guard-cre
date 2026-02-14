# ChainGuard Sentinel - Complete Setup Guide

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Deployment](#deployment)
5. [Monitoring Setup](#monitoring-setup)
6. [Troubleshooting](#troubleshooting)
7. [Architecture Details](#architecture-details)

---

## Prerequisites

### Required Tools

- **Bun** runtime (v1.0+): [Install Bun](https://bun.sh)
- **Chainlink CRE CLI**: Install via `npm install -g @chainlink/cre-cli`
- **Git**: For version control

### Required API Keys

1. **Gemini API Key**: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. **Email Service API** (choose one):
   - [Resend](https://resend.com) - Recommended
   - [SendGrid](https://sendgrid.com)
   - [Mailgun](https://www.mailgun.com)
   - Any SMTP-compatible service
3. **Slack Webhook** (optional): [Create Slack App](https://api.slack.com/messaging/webhooks)
4. **Telegram Bot Token** (optional): [BotFather Guide](https://core.telegram.org/bots#botfather)
5. **Discord Webhook** (optional): [Discord Webhooks](https://support.discord.com/hc/en-us/articles/228383668)

---

## Installation

### Step 1: Clone Repository

```bash
cd /home/bilal/bilal_projects/Hackathons/chainlink/chainguard-cre-workflow
```

### Step 2: Install Dependencies

```bash
cd chainguard-sentinel
bun install
```

This will:

- Install all npm packages
- Run `cre-setup` post-install script
- Prepare the CRE environment

---

## Configuration

### Step 1: Configure Secrets

Edit `secrets.yaml` in the root directory:

```yaml
# Gemini API Key (REQUIRED)
GEMINI_API_KEY: "YOUR_ACTUAL_GEMINI_API_KEY_HERE"

# Email Service (REQUIRED if using email alerts)
EMAIL_API_KEY: "YOUR_RESEND_API_KEY_HERE"

# Slack (OPTIONAL)
SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# Telegram (OPTIONAL)
TELEGRAM_BOT_TOKEN: "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
TELEGRAM_CHAT_ID: "-1001234567890"

# Discord (OPTIONAL)
DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/YOUR/WEBHOOK"
```

**Security Note**: Never commit `secrets.yaml` to version control!

### Step 2: Configure Monitored Contracts

Edit `chainguard-sentinel/config.json`:

```json
{
  "geminiModel": "gemini-2.0-flash-exp",
  "cronSchedule": "*/5 * * * *",
  "monitoredContracts": [
    {
      "address": "0xYourContractAddress",
      "name": "My DeFi Protocol",
      "chainSelectorName": "ethereum-testnet-sepolia",
      "riskThresholds": {
        "depegTolerance": 0.02,
        "volatilityMax": 0.15,
        "liquidityDropMax": 0.25,
        "collateralRatioMin": 1.5
      },
      "alertChannels": ["email", "slack"],
      "priceFeeds": [
        {
          "feedAddress": "0x694AA1769357215DE4FAC081bf1f309aDC325306",
          "pairName": "ETH/USD",
          "decimals": 8,
          "heartbeat": 3600
        }
      ]
    }
  ],
  "emailConfig": {
    "from": "alerts@yourdomain.com",
    "to": ["admin@yourdomain.com"]
  }
}
```

#### Configuration Fields Explained

**Contract Configuration:**

- `address`: Ethereum address of the contract to monitor
- `name`: Human-readable name for reports
- `chainSelectorName`: Chain to monitor on
  - Testnets: `ethereum-testnet-sepolia`, `polygon-testnet-amoy`
  - Mainnets: `ethereum-mainnet`, `polygon-mainnet`

**Risk Thresholds:**

- `depegTolerance`: Max allowed stablecoin deviation (e.g., 0.02 = 2%)
- `volatilityMax`: Max 24h price volatility (e.g., 0.15 = 15%)
- `liquidityDropMax`: Max liquidity drop (e.g., 0.25 = 25%)
- `collateralRatioMin`: Min collateralization ratio (e.g., 1.5 = 150%)
- `gasPriceMax`: Max gas price in Gwei (optional)

**Alert Channels:**

- `email`: Email notifications
- `slack`: Slack webhook messages
- `telegram`: Telegram bot messages
- `discord`: Discord channel webhooks
- `onchain`: On-chain notifications (not yet implemented)

**Price Feeds:**
Use Chainlink Price Feed addresses for your chain:

- Sepolia: [Chainlink Sepolia Feeds](https://docs.chain.link/data-feeds/price-feeds/addresses?network=ethereum&page=1#sepolia-testnet)
- Polygon Amoy: [Chainlink Amoy Feeds](https://docs.chain.link/data-feeds/price-feeds/addresses?network=polygon&page=1#amoy-testnet)

### Step 3: Configure RPC Endpoints (Optional)

Edit `project.yaml` if you want to use custom RPC endpoints:

```yaml
local-simulation:
  rpcs:
    - chain-name: ethereum-testnet-sepolia
      url: https://your-custom-rpc-endpoint.com
```

---

## Deployment

### Local Simulation (Testing)

Test your configuration locally before deploying:

```bash
cd chainguard-sentinel
cre workflow run local-simulation
```

This will:

- Validate your configuration
- Run one monitoring cycle
- Show you exactly what would happen in production
- NOT send real alerts (simulated)

### Staging Deployment

Deploy to Chainlink's staging environment:

```bash
cre workflow deploy staging
```

You'll be prompted to:

1. Sign the deployment transaction
2. Confirm the workflow name
3. Wait for DON nodes to sync

### Production Deployment

**⚠️ Important**: Test thoroughly in staging first!

```bash
cre workflow deploy production
```

---

## Monitoring Setup

### Cron Schedule Format

The `cronSchedule` field uses standard cron syntax:

```
*/5 * * * *  = Every 5 minutes
*/15 * * * * = Every 15 minutes
0 * * * *    = Every hour
0 */6 * * *  = Every 6 hours
```

**Recommendation**: Start with `*/15 * * * *` (every 15 minutes) to avoid rate limits.

### Adding More Contracts

To monitor multiple contracts, add them to the `monitoredContracts` array:

```json
"monitoredContracts": [
  {
    "address": "0xContract1...",
    "name": "Protocol A",
    // ... config
  },
  {
    "address": "0xContract2...",
    "name": "Protocol B",
    // ... config
  }
]
```

### Alert Channel Setup

#### Email (Resend)

1. Sign up at [Resend](https://resend.com)
2. Create API key from your dashboard
3. Verify your domain (or use onboarding domain for testing)
4. Add to `secrets.yaml`:
   ```yaml
   EMAIL_API_KEY: "re_xxxxxxxxxxxxxxxxx"
   ```
5. Configure in `config.json`:
   ```json
   "emailConfig": {
     "from": "ChainGuard <alerts@yourdomain.com>",
     "to": ["recipient@example.com"]
   }
   ```

#### Slack

1. Create Slack App: https://api.slack.com/apps
2. Enable Incoming Webhooks
3. Add webhook to channel
4. Copy webhook URL to `secrets.yaml`:
   ```yaml
   SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/..."
   ```

#### Telegram

1. Create bot via [@BotFather](https://t.me/botfather)
2. Get bot token
3. Get chat ID:
   ```bash
   # Send a message to your bot, then:
   curl https://api.telegram.org/bot<TOKEN>/getUpdates
   ```
4. Add to `secrets.yaml`:
   ```yaml
   TELEGRAM_BOT_TOKEN: "your-token"
   TELEGRAM_CHAT_ID: "your-chat-id"
   ```

#### Discord

1. Go to Channel Settings → Integrations → Webhooks
2. Create webhook
3. Copy URL to `secrets.yaml`:
   ```yaml
   DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/..."
   ```

---

## Troubleshooting

### Common Issues

#### "GEMINI_API_KEY not found in secrets"

**Solution**: Ensure `secrets.yaml` exists and has the correct key:

```yaml
GEMINI_API_KEY: "your-actual-key-here"
```

#### "Network not found for chain selector"

**Solution**: Check `chainSelectorName` in config matches supported chains:

- `ethereum-testnet-sepolia`
- `ethereum-mainnet`
- `polygon-testnet-amoy`
- `polygon-mainnet`

#### "Failed to fetch price feed"

**Solutions**:

1. Verify price feed address is correct for your chain
2. Check RPC endpoint is responding
3. Ensure contract address in `priceFeeds` is valid

#### "Email API returned status 401"

**Solution**:

1. Verify EMAIL*API_KEY is correct (should start with "re*")
2. Ensure your domain is verified in Resend dashboard
3. Check API key is active and not revoked

#### "Slack webhook returned status 404"

**Solution**:

1. Regenerate webhook URL in Slack
2. Ensure webhook is for correct workspace/channel

### Debug Mode

Enable verbose logging in `config.json`:

```json
"verboseLogging": true
```

### View Workflow Logs

```bash
cre workflow logs staging
```

---

## Architecture Details

### Workflow Execution Flow

```
Cron Trigger (every 5 min)
    ↓
For each monitored contract:
    ↓
1. Fetch On-Chain State (evm.ts)
   - Read contract balances
   - Call view functions
   - Detect protocol type (ERC20, Uniswap, etc.)
    ↓
2. Fetch Market Data (chainlink-feeds.ts)
   - Query Chainlink Price Feeds
   - Calculate 24h volatility
   - Check for stablecoin depeg
    ↓
3. AI Risk Analysis (gemini.ts)
   - Send data to Gemini AI
   - Get risk assessment with confidence
   - Receive suggested actions
    ↓
4. Evaluate Thresholds (risk-evaluator.ts)
   - Check configured thresholds
   - Calculate overall risk score (0-100)
   - Determine if alert is needed
    ↓
5. Send Alerts (notifications.ts)
   - If risk score > threshold
   - Send via configured channels
   - Log delivery results
    ↓
Return execution summary
```

### Module Responsibilities

- **main.ts**: Orchestration, Cron handling
- **types.ts**: TypeScript definitions, Zod schemas
- **evm.ts**: On-chain data fetching via EVM reads
- **chainlink-feeds.ts**: Chainlink Price Feed integration
- **gemini.ts**: Gemini AI API calls for risk analysis
- **risk-evaluator.ts**: Threshold checking, risk scoring
- **notifications.ts**: Multi-channel alert delivery

### Data Flow

```
┌─────────────────┐
│  Smart Contract │ ────► evm.ts ────┐
└─────────────────┘                   │
                                      │
┌─────────────────┐                   ▼
│ Chainlink Feeds │ ──► chainlink    Combined
└─────────────────┘      -feeds.ts    Data
                             │         │
                             └─────────┘
                                  │
                                  ▼
                            ┌──────────┐
                            │ gemini.ts│
                            └──────────┘
                                  │
                                  ▼
                          ┌────────────────┐
                          │risk-evaluator  │
                          │   .ts          │
                          └────────────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │notifications.ts │
                         └─────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
                 Email         Slack       Telegram
```

---

## Advanced Configuration

### Custom Price Feeds

Add custom Chainlink feeds:

```json
"priceFeeds": [
  {
    "feedAddress": "0xYourFeedAddress",
    "pairName": "CUSTOM/USD",
    "decimals": 8,
    "heartbeat": 3600
  }
]
```

### Custom Contract ABIs

Monitor specific contract functions:

```json
{
  "address": "0x...",
  "abi": [
    {
      "type": "function",
      "name": "totalValueLocked",
      "outputs": [{ "type": "uint256" }]
    }
  ],
  "monitoredFunctions": ["totalValueLocked"]
}
```

### Rate Limiting

To avoid API rate limits:

```json
"maxContractsPerRun": 10,
"geminiTimeoutMs": 45000,
"cronSchedule": "*/10 * * * *"
```

---

## Best Practices

1. **Start Small**: Monitor 1-2 contracts first
2. **Test Thoroughly**: Use local simulation extensively
3. **Conservative Thresholds**: Start with wider tolerances
4. **Multiple Channels**: Use at least 2 alert channels
5. **Monitor Logs**: Check workflow logs regularly
6. **Update Regularly**: Keep CRE SDK updated
7. **Backup Secrets**: Store secrets.yaml securely offline

---

## Support & Resources

- **Chainlink Docs**: https://docs.chain.link
- **CRE Documentation**: https://docs.chain.link/cre
- **Chainlink Discord**: https://discord.gg/chainlink
- **GitHub Issues**: (Your repo URL)

---

## License

MIT License - see LICENSE file for details
