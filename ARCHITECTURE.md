# ChainGuard Sentinel - Architecture Diagram

## High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CHAINGUARD SENTINEL                              │
│                  AI-Powered Smart Contract Risk Monitor                  │
│                   Running on Chainlink Runtime Environment               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CRON TRIGGER (Every 5 min)                       │
│                         main.ts: onCronTrigger()                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │  For Each Monitored Contract  │
                    └───────────────┬───────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌──────────────┐          ┌──────────────────┐       ┌─────────────────┐
│   STEP 1     │          │     STEP 2       │       │    STEP 3       │
│ On-Chain Data│          │  Market Data     │       │  AI Analysis    │
│              │          │                  │       │                 │
│  evm.ts      │          │ chainlink-feeds  │       │   gemini.ts     │
└──────────────┘          │      .ts         │       └─────────────────┘
        │                 └──────────────────┘                 │
        │                          │                           │
        ▼                          ▼                           ▼
┌──────────────┐          ┌──────────────────┐       ┌─────────────────┐
│• Read balances│         │• Query Chainlink │       │• Send to Gemini │
│• Call functions│        │  Price Feeds     │       │• Get risk score │
│• Detect protocol│       │• Calculate       │       │• Get reasoning  │
│  type (ERC20) │         │  volatility      │       │• Get actions    │
│• Get reserves │         │• Check depeg     │       │                 │
└──────────────┘          └──────────────────┘       └─────────────────┘
        │                          │                           │
        └──────────────┬───────────┴───────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────┐
        │          STEP 4                      │
        │     Risk Evaluation                  │
        │                                      │
        │     risk-evaluator.ts                │
        └──────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────┐
        │• Check threshold violations           │
        │• Calculate rule-based score (0-100)  │
        │• Combine with AI confidence          │
        │• Overall Score = (Rules×0.7 + AI×0.3)│
        │• Determine if alert needed           │
        └──────────────────────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │ Should Alert?  │
              └────────┬───────┘
                       │
            ┌──────────┴──────────┐
            │                     │
        NO  │                     │  YES
            ▼                     ▼
    ┌──────────────┐    ┌──────────────────────┐
    │ Log & Skip   │    │      STEP 5          │
    └──────────────┘    │  Send Alerts         │
                        │                      │
                        │  notifications.ts    │
                        └──────────────────────┘
                                 │
                ┌────────────────┼────────────────┐
                │                │                │
                ▼                ▼                ▼
        ┌────────────┐   ┌────────────┐  ┌────────────┐
        │   Email    │   │   Slack    │  │ Telegram   │
        │            │   │            │  │            │
        │ SendGrid   │   │  Webhook   │  │  Bot API   │
        └────────────┘   └────────────┘  └────────────┘
                                 │
                                 ▼
                        ┌────────────┐
                        │  Discord   │
                        │            │
                        │  Webhook   │
                        └────────────┘
```

---

## Data Flow Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       DATA SOURCES                               │
└──────────────────────────────────────────────────────────────────┘
         │                          │                        │
         ▼                          ▼                        ▼
┌─────────────────┐      ┌─────────────────┐      ┌──────────────┐
│ Smart Contracts │      │ Chainlink Feeds │      │ Google Search│
│  (On-Chain)     │      │  (Off-Chain)    │      │ (Real-Time)  │
│                 │      │                 │      │              │
│ • Balances      │      │ • ETH/USD       │      │ • Market news│
│ • Reserves      │      │ • BTC/USD       │      │ • Events     │
│ • Positions     │      │ • USDC/USD      │      │ • Trends     │
│ • TVL           │      │ • Volatility    │      │              │
└─────────────────┘      └─────────────────┘      └──────────────┘
         │                          │                        │
         └──────────────┬───────────┴────────────────────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │   DATA PROCESSING     │
            │                       │
            │  • Normalize formats  │
            │  • Calculate metrics  │
            │  • Detect anomalies   │
            └───────────────────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │    AI ANALYSIS        │
            │                       │
            │  Gemini 2.0 Flash     │
            │  • Risk Assessment    │
            │  • Confidence Score   │
            │  • Action Suggestions │
            └───────────────────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │  RISK EVALUATION      │
            │                       │
            │  • Threshold checks   │
            │  • Score calculation  │
            │  • Alert decision     │
            └───────────────────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │  ALERT DELIVERY       │
            │                       │
            │  Multi-channel output │
            └───────────────────────┘
```

---

## Module Interaction Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                            main.ts                                 │
│                  (Workflow Orchestration)                          │
│                                                                    │
│  • Cron trigger handler                                           │
│  • Multi-contract loop                                            │
│  • Error isolation                                                │
│  • Execution metrics                                              │
└────────────────────────────────────────────────────────────────────┘
         │         │         │         │         │
         │         │         │         │         │
    ┌────┘    ┌────┘    ┌────┘    ┌────┘    ┌────┘
    │         │         │         │         │
    ▼         ▼         ▼         ▼         ▼
┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐
│evm.ts│  │feeds │  │gemini│  │risk- │  │notify│
│      │  │.ts   │  │.ts   │  │eval  │  │.ts   │
└──────┘  └──────┘  └──────┘  └──────┘  └──────┘
    │         │         │         │         │
    │         │         │         │         │
    └─────────┴─────────┴─────────┴─────────┘
                    │
                    ▼
            ┌──────────────┐
            │   types.ts   │
            │              │
            │  • Config    │
            │  • Schemas   │
            │  • Interfaces│
            └──────────────┘
```

---

## Risk Scoring Engine

```
┌─────────────────────────────────────────────────────────────────┐
│                    RISK SCORING ENGINE                          │
└─────────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
┌───────────────────────┐       ┌─────────────────────┐
│   RULE-BASED SCORE    │       │   AI CONFIDENCE     │
│                       │       │                     │
│ Threshold Violations: │       │ Gemini Analysis:    │
│                       │       │                     │
│ ✓ Depeg >2%     ⚠️ 10│       │ • Risk Level        │
│ ✓ Volatility >15% ⚠️9│       │ • Confidence 0-10000│
│ ✓ Liquidity -25%  ⚠️7│       │ • Reasoning         │
│ ✓ Collateral <150%⚠️9│       │ • Actions           │
│ ✓ Gas >200 Gwei   ⚠️3│       │                     │
│                       │       │ Normalized to 0-100 │
│ Weighted + Severity   │       │                     │
│ = Score 0-100         │       │ = AI Score 0-100    │
└───────────────────────┘       └─────────────────────┘
            │                               │
            │  Weight: 70%                  │  Weight: 30%
            └───────────────┬───────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │   OVERALL RISK SCORE  │
                │                       │
                │ (Rules × 0.7) +       │
                │ (AI × 0.3) = 0-100    │
                └───────────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │   ALERT DECISION      │
                │                       │
                │ Trigger if:           │
                │ • Score ≥ 60          │
                │ • CRITICAL violations │
                │ • HIGH AI risk        │
                │ • Combined conditions │
                └───────────────────────┘
```

---

## Alert Routing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              ALERT PAYLOAD GENERATION                           │
│                                                                 │
│  {                                                              │
│    alertId: "uuid-1234",                                        │
│    contractName: "My DeFi Protocol",                            │
│    riskLevel: "HIGH",                                           │
│    riskScore: 78,                                               │
│    summary: "2 threshold violations...",                        │
│    reasoning: "Detailed analysis...",                           │
│    suggestedActions: ["Action 1", "Action 2"]                   │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
            ┌───────────────────────────┐
            │   CHANNEL ROUTER          │
            │                           │
            │ Configured channels:      │
            │ ["email", "slack"]        │
            └───────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
┌───────────────────────┐       ┌─────────────────────┐
│   EMAIL FORMATTER     │       │   SLACK FORMATTER   │
│                       │       │                     │
│ • Rich HTML template  │       │ • Block Kit format  │
│ • Inline metrics      │       │ • Color coding      │
│ • Risk-based colors   │       │ • Interactive       │
│ • Plain text fallback │       │                     │
└───────────────────────┘       └─────────────────────┘
            │                               │
            ▼                               ▼
┌───────────────────────┐       ┌─────────────────────┐
│  SENDGRID API         │       │  SLACK WEBHOOK      │
│  POST /v3/mail/send   │       │  POST webhook URL   │
└───────────────────────┘       └─────────────────────┘
            │                               │
            └───────────────┬───────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │  DELIVERY RESULTS     │
                │                       │
                │ Email: ✓ Success      │
                │ Slack: ✓ Success      │
                │                       │
                │ 2/2 delivered         │
                └───────────────────────┘
```

---

## CRE Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     DEVELOPER MACHINE                           │
│                                                                 │
│  chainguard-cre-workflow/                                       │
│  ├── chainguard-sentinel/                                       │
│  │   ├── main.ts                                               │
│  │   ├── config.json                                           │
│  │   └── ...                                                   │
│  ├── project.yaml                                              │
│  └── secrets.yaml                                              │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ cre workflow deploy staging
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  CHAINLINK DON (Decentralized Oracle Network)   │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Node 1     │  │   Node 2     │  │   Node 3     │  ...    │
│  │              │  │              │  │              │         │
│  │ • Run workflow│  │ • Run workflow│  │ • Run workflow│        │
│  │ • Execute Cron│  │ • Execute Cron│  │ • Execute Cron│        │
│  │ • Fetch data  │  │ • Fetch data  │  │ • Fetch data  │        │
│  │ • Consensus   │  │ • Consensus   │  │ • Consensus   │        │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│  Consensus Aggregation: Identical responses required           │
└─────────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ Blockchain   │ │ Chainlink    │ │ External APIs│
    │ (EVM Reads)  │ │ Data Feeds   │ │ (Gemini)     │
    └──────────────┘ └──────────────┘ └──────────────┘
```

---

## Security & Privacy Layer

```
┌─────────────────────────────────────────────────────────────────┐
│                     SECURITY MEASURES                           │
└─────────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Secrets Mgmt │    │  Consensus   │    │Input Validate│
│              │    │  Aggregation │    │              │
│• Encrypted   │    │              │    │• Zod schemas │
│  storage     │    │• Multi-node  │    │• Type safety │
│• Never in    │    │  verification│    │• Sanitization│
│  code        │    │• Tamper-proof│    │              │
└──────────────┘    └──────────────┘    └──────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │  SECURE EXECUTION     │
                │                       │
                │ • Decentralized DONs  │
                │ • No single point fail│
                │ • Audit trails        │
                │ • Error isolation     │
                └───────────────────────┘
```

This architecture demonstrates how ChainGuard Sentinel leverages Chainlink's CRE to create a fully decentralized, AI-powered smart contract monitoring system with enterprise-grade reliability and security.
