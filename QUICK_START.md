# ChainGuard Sentinel - Quick Start

Get your AI-powered smart contract risk monitor running in 5 minutes!

## Prerequisites

- ✅ Bun installed ([bun.sh](https://bun.sh))
- ✅ Chainlink CRE CLI: `npm install -g @chainlink/cre-cli`
- ✅ Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

## 1. Install Dependencies (30 seconds)

```bash
cd chainguard-sentinel
bun install
```

## 2. Configure Secrets (1 minute)

Edit `../secrets.yaml`:

```yaml
GEMINI_API_KEY: "paste-your-gemini-api-key-here"
EMAIL_API_KEY: "your-sendgrid-key-if-using-email"
SLACK_WEBHOOK_URL: "your-slack-webhook-if-using-slack"
```

## 3. Add Your Contract (2 minutes)

Edit `config.json`:

```json
{
  "monitoredContracts": [
    {
      "address": "0xYOUR_CONTRACT_ADDRESS_HERE",
      "name": "My DeFi Protocol",
      "chainSelectorName": "ethereum-testnet-sepolia",
      "riskThresholds": {
        "depegTolerance": 0.02,
        "volatilityMax": 0.15
      },
      "alertChannels": ["slack"],
      "priceFeeds": [
        {
          "feedAddress": "0x694AA1769357215DE4FAC081bf1f309aDC325306",
          "pairName": "ETH/USD",
          "decimals": 8
        }
      ]
    }
  ]
}
```

## 4. Test Locally (1 minute)

```bash
in the cre chain-guard-cre directory
cre workflow simulate chainguard-sentinel -T local-simulation
```

You should see:

- ✅ Configuration validated
- ✅ Contract state fetched
- ✅ Market data retrieved
- ✅ AI analysis completed
- ✅ Risk assessment generated

## 5. Deploy to Staging (30 seconds)

```bash
cre workflow deploy staging
```

Sign the transaction when prompted.

## 🎉 Done!

Your contract is now being monitored every 5 minutes!

---

## What Happens Next?

Every 5 minutes, ChainGuard will:

1. 📊 Check your contract's on-chain state
2. 📈 Fetch latest market data from Chainlink
3. 🤖 Analyze risks with Gemini AI
4. ⚖️ Compare against your thresholds
5. 🚨 Send alerts if risks detected

---

## Example Alert (Slack)

```
🔴 ChainGuard Alert: HIGH Risk

Contract: My DeFi Protocol
Address: 0x1234...5678
Chain: ethereum-testnet-sepolia
Risk Type: VOLATILITY
Score: 78/100

Summary:
HIGH RISK DETECTED (Score: 78/100)
2 threshold violation(s) detected:
  • volatilityMax: 18.50% (23% over threshold) [HIGH]
  • priceChange24h: -12.30% [MEDIUM]

Reasoning:
Excessive price volatility detected in ETH/USD feed. 24h volatility
of 18.5% exceeds configured threshold of 15%. This could trigger
liquidations if positions are under-collateralized.

Suggested Actions:
• Review collateralization ratios immediately
• Consider pausing new deposits until volatility stabilizes
• Monitor liquidation queue for cascading effects
• Communicate with users about market conditions

Alert ID: abc123-1234
2026-02-14T10:30:00Z
```

---

## Customization

### Monitor Multiple Contracts

Just add more objects to the `monitoredContracts` array!

### Change Alert Channels

Available: `"email"`, `"slack"`, `"telegram"`, `"discord"`

### Adjust Monitoring Frequency

In `config.json`:

```json
"cronSchedule": "*/10 * * * *"  // Every 10 minutes instead of 5
```

### Fine-tune Risk Thresholds

```json
"riskThresholds": {
  "depegTolerance": 0.03,      // 3% instead of 2%
  "volatilityMax": 0.20,       // 20% instead of 15%
  "liquidityDropMax": 0.30,    // 30% drop allowed
  "collateralRatioMin": 1.3    // 130% minimum
}
```

---

## Troubleshooting

### "GEMINI_API_KEY not found"

→ Make sure `secrets.yaml` exists in the parent directory with your key

### "Network not found"

→ Check `chainSelectorName` matches exactly:

- `ethereum-testnet-sepolia`
- `polygon-testnet-amoy`

### No alerts received?

→ Check your contract actually has risk conditions!
→ Try lowering thresholds temporarily to test alerts

### Need help?

→ See `SETUP_GUIDE.md` for detailed troubleshooting
→ Check logs: `cre workflow logs staging`

---

## Next Steps

1. ✅ Read `IMPLEMENTATION_SUMMARY.md` for architecture details
2. ✅ Read `SETUP_GUIDE.md` for advanced configuration
3. ✅ Connect to frontend dashboard (see `chain-guard/` directory)
4. ✅ Deploy to production when ready

---

**Happy Monitoring! 🚀**

Your contracts are now protected by AI-powered risk detection running on Chainlink's decentralized infrastructure.
