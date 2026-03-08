# ChainGuard Sentinel – CRE Workflow

**The Chainlink CRE workflow that powers ChainGuard’s decentralized risk analysis.**

This repository contains the **Chainlink Runtime Environment (CRE)** workflow used by [ChainGuard Sentinel](https://github.com/Sobilo34/chain-guard). It is triggered by on-chain events from the **ChainGuardCREConsumer** contract, pulls contract and market data, runs AI risk analysis, and writes the report back on-chain—so the frontend never needs a custom backend.

---

## The problem we address

Smart contract owners need **continuous, trustworthy** risk monitoring: contract state plus market data (e.g. prices, volatility) and AI-driven assessment, with results they can trust. Doing this with a central server creates a single point of failure and opacity. ChainGuard runs this entire pipeline as a **CRE workflow**: one blockchain (EVM) is integrated with external systems (Chainlink Data Feeds, OpenRouter/Gemini AI), and the workflow is simulated locally or deployed on a Chainlink DON for decentralized execution.

---

## How we use CRE

- **EVM log trigger**  
  The workflow is triggered by the `RiskAnalysisRequested` event emitted by the consumer contract when a user (or the frontend’s interval job) calls `requestRiskAnalysis(contractAddress, chainSelectorName)`.

- **Blockchain + external API / data / LLM**  
  The workflow:
  1. **Blockchain:** Reads the target contract’s state on the specified chain (e.g. balances, token holdings) via EVM.
  2. **External data:** Fetches market data (e.g. Chainlink Price Feeds) for volatility and context.
  3. **LLM / AI:** Optionally uses OpenRouter/Gemini for risk analysis and summary.
  4. **Blockchain:** Writes the risk report (risk level, score, summary) back to the consumer contract so the frontend can read it with `getAssessment(requestId)`.

This meets the hackathon requirement: **integrate at least one blockchain with an external API, system, data source, LLM, or AI agent**, demonstrated via CRE CLI simulation or live deployment on the CRE network.

---

## Project structure

```
chain-guard-cre/
├── project.yaml              # CRE project and RPC (e.g. Alchemy for Sepolia)
├── secrets.yaml              # API keys (DO NOT COMMIT; use CRE secrets in prod)
├── README.md                 # This file
└── chainguard-sentinel/
    ├── workflow.yaml         # CRE targets (local-simulation, evm-triggered, etc.)
    ├── evm-triggered-workflow.ts   # EVM log trigger entrypoint (used by listener/DON)
    ├── main.ts               # Cron-triggered entrypoint (optional)
    ├── evm.ts                # EVM reads (contract state)
    ├── chainlink-feeds.ts    # Chainlink Data Feeds integration
    ├── gemini.ts             # AI risk analysis (Gemini/OpenRouter)
    ├── risk-evaluator.ts     # Risk scoring and thresholds
    ├── notifications.ts      # Alert delivery (email, Slack, etc.)
    ├── types.ts              # Config and types
    ├── config.json           # Local config
    ├── config.evm-triggered.json   # EVM trigger config (consumer address, chain)
    └── package.json
```

---

## Link to all files that use Chainlink

| File                                                                                           | Purpose                                                                                                           |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [chainguard-sentinel/evm-triggered-workflow.ts](chainguard-sentinel/evm-triggered-workflow.ts) | EVM log trigger; decodes `RiskAnalysisRequested`, fetches state + market data, runs AI, writes report on consumer |
| [chainguard-sentinel/chainlink-feeds.ts](chainguard-sentinel/chainlink-feeds.ts)               | Chainlink Data Feeds / price feed integration                                                                     |
| [chainguard-sentinel/evm.ts](chainguard-sentinel/evm.ts)                                       | EVM reads for contract state (used by workflow)                                                                   |
| [chainguard-sentinel/gemini.ts](chainguard-sentinel/gemini.ts)                                 | AI risk analysis (Gemini/OpenRouter)                                                                              |
| [chainguard-sentinel/risk-evaluator.ts](chainguard-sentinel/risk-evaluator.ts)                 | Risk scoring and threshold checks                                                                                 |
| [chainguard-sentinel/main.ts](chainguard-sentinel/main.ts)                                     | Cron-triggered workflow (optional path)                                                                           |
| [chainguard-sentinel/workflow.yaml](chainguard-sentinel/workflow.yaml)                         | CRE workflow targets and artifact paths                                                                           |
| [project.yaml](project.yaml)                                                                   | CRE project settings and RPC (e.g. Sepolia via Alchemy)                                                           |

---

## Setup

### 1. Prerequisites

- [Bun](https://bun.sh) or Node.js
- [Chainlink CRE CLI](https://github.com/smartcontractkit/cre-cli) installed
- Alchemy (or other) RPC for Sepolia (and mainnet if you read mainnet contracts)
- OpenRouter or Gemini API key for AI analysis (optional but recommended)

### 2. Install dependencies

```bash
cd chainguard-sentinel
bun install   # or npm install
```

### 3. Configure RPC (required for “write report on-chain”)

CRE does not expand env vars in `project.yaml`. Edit `project.yaml` in the repo root and replace the literal `ALCHEMY_API_KEY` (or placeholder) in each RPC URL with your Alchemy key so the workflow can write the report to the consumer contract on Sepolia without timeouts.

### 4. Configure secrets

Use `secrets.yaml` (local, do not commit) or CRE secrets (production) for:

- `OPENROUTER_API_KEY` or `GEMINI_API_KEY` – for AI risk analysis
- Any notification keys (e.g. email, Slack) if you use those

### 5. EVM trigger config

Ensure `chainguard-sentinel/config.evm-triggered.json` (or the config used by your target) has:

- `creConsumerAddress` – ChainGuardCREConsumer contract address (from [chain-guard-smart-contract](https://github.com/Sobilo34/chain-guard-smart-contract) deploy)
- `chainSelectorName` – e.g. `ethereum-testnet-sepolia` for the consumer chain

---

## Running the workflow

### Local simulation (with frontend listener)

The [chain-guard](https://github.com/Sobilo34/chain-guard) app runs a listener script that watches for `RiskAnalysisRequested` and executes:

```bash
cre workflow simulate ./chainguard-sentinel --target evm-triggered --evm-tx-hash <txHash> --broadcast
```

So you don’t run this repo manually for normal “Run Full Analysis” flows; you run `npm run script:cre-listener` in the chain-guard repo, which points at this repo and invokes the CRE CLI.

### Manual simulation (no tx)

To test the workflow without a real tx, you can run a local simulation with a mock trigger (see CRE docs). For a full end-to-end test, use the frontend + listener.

### Deploy to a Chainlink DON

For production, deploy the workflow so the DON listens for `RiskAnalysisRequested` and writes reports:

```bash
cre workflow deploy chainguard-sentinel -T evm-triggered
```

(Exact target name may depend on your `workflow.yaml`. Use the target that uses `evm-triggered-workflow.ts` and your consumer address.)

---

## Architecture (EVM-triggered path)

```
RiskAnalysisRequested(event) on consumer contract
    ↓
CRE workflow (evm-triggered-workflow.ts)
    ↓
EVM reads (evm.ts) – contract state on target chain
    ↓
Chainlink Data Feeds (chainlink-feeds.ts) – market data
    ↓
AI risk analysis (gemini.ts) – OpenRouter/Gemini
    ↓
Risk evaluation (risk-evaluator.ts)
    ↓
Write report on consumer contract (Sepolia)
    ↓
Frontend reads getAssessment(requestId)
```

---

## Related repositories

- **[chain-guard](https://github.com/Sobilo34/chain-guard)** – Frontend and API; calls consumer contract and runs the CRE listener for local dev.
- **[chain-guard-smart-contract](https://github.com/Sobilo34/chain-guard-smart-contract)** – ChainGuardCREConsumer and ChainGuardRegistry (Sepolia).

---

## License

MIT.
