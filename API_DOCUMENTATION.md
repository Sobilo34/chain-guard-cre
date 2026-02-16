# ChainGuard Sentinel API Documentation

## Overview

ChainGuard Sentinel exposes HTTP endpoints for dynamic contract management. Your frontend can add, remove, and query contracts without redeploying the CRE workflow.

## Base URL

```
https://your-cre-workflow-endpoint.chainlink.com
```

(This will be provided after deploying to CRE staging/production)

---

## Endpoints

### 1. Add Contract for Monitoring

**POST** `/add`

Add a new smart contract for real-time monitoring of the smart-contract

#### Request Body

```json
{
  "contractAddress": "0x1234567890123456789012345678901234567890",
  "contractName": "My DeFi Protocol",
  "chainSelectorName": "ethereum-testnet-sepolia",
  "riskThresholds": {
    "depegTolerance": 0.02,
    "volatilityMax": 0.15,
    "liquidityDropMax": 0.25,
    "collateralRatioMin": 1.5,
    "gasPriceMax": 200
  },
  "alertChannels": ["email"],
  "priceFeeds": [
    {
      "feedAddress": "0x694AA1769357215DE4FAC081bf1f309aDC325306",
      "pairName": "ETH/USD",
      "decimals": 8,
      "heartbeat": 3600
    }
  ]
}
```

#### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `contractAddress` | string | Valid Ethereum address (0x...) |
| `chainSelectorName` | string | Chain identifier (see supported chains) |

#### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `contractName` | string | Auto-generated | Human-readable name |
| `riskThresholds` | object | Default values | Risk tolerance settings |
| `alertChannels` | array | `["email"]` | Notification channels |
| `priceFeeds` | array | `[]` | Chainlink price feeds to monitor |

#### Response

```json
{
  "success": true,
  "contract": {
    "address": "0x1234567890123456789012345678901234567890",
    "name": "My DeFi Protocol",
    "chainSelectorName": "ethereum-testnet-sepolia",
    "metadata": {
      "contractType": "UUPS_PROXY",
      "implementationAddress": "0x...",
      "detectedAt": "2026-02-14T10:30:00.000Z",
      "proxyType": "UUPS"
    }
  },
  "message": "Contract added for monitoring"
}
```

#### Contract Type Detection

The system automatically detects:
- ✅ **Normal contracts**
- ✅ **UUPS proxies** (EIP-1822)
- ✅ **Transparent proxies** (EIP-1967)
- ✅ **Beacon proxies** (EIP-1967)
- ✅ **Diamond proxies** (EIP-2535)

For upgradable contracts, both proxy and implementation addresses are monitored.

---

### 2. Remove Contract

**POST** `/remove`

Stop monitoring a specific contract.

#### Request Body

```json
{
  "contractAddress": "0x1234567890123456789012345678901234567890",
  "chainSelectorName": "ethereum-testnet-sepolia"
}
```

#### Response

```json
{
  "success": true,
  "message": "Contract removed from monitoring"
}
```

---

### 3. Get Contract Status

**GET** `/status?contractAddress=0x...&chainSelectorName=ethereum-testnet-sepolia`

Get monitoring status for a specific contract.

#### Query Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `contractAddress` | Yes | Contract address to query |
| `chainSelectorName` | No | Specific chain (omit to search all chains) |

#### Response (Single Contract)

```json
{
  "success": true,
  "contract": {
    "address": "0x1234567890123456789012345678901234567890",
    "name": "My DeFi Protocol",
    "chainSelectorName": "ethereum-testnet-sepolia",
    "riskThresholds": {
      "depegTolerance": 0.02,
      "volatilityMax": 0.15
    },
    "alertChannels": ["email"],
    "metadata": {
      "contractType": "NORMAL",
      "detectedAt": "2026-02-14T10:30:00.000Z"
    }
  }
}
```

#### Response (Multiple Chains)

If `chainSelectorName` is omitted, returns all matches:

```json
{
  "success": true,
  "contracts": [
    { "address": "0x...", "chainSelectorName": "ethereum-mainnet" },
    { "address": "0x...", "chainSelectorName": "polygon-mainnet" }
  ],
  "count": 2
}
```

---

### 4. List All Contracts

**GET** `/contracts`

Get all contracts currently being monitored.

#### Response

```json
{
  "success": true,
  "contracts": [
    {
      "address": "0x...",
      "name": "Contract A",
      "chainSelectorName": "ethereum-testnet-sepolia"
    },
    {
      "address": "0x...",
      "name": "Contract B",
      "chainSelectorName": "polygon-mainnet"
    }
  ],
  "count": 2
}
```

---

## Supported Chains

### Testnets

| Chain | `chainSelectorName` | RPC Required |
|-------|---------------------|--------------|
| Ethereum Sepolia | `ethereum-testnet-sepolia` | ✅ |
| Polygon Amoy | `polygon-testnet-amoy` | ✅ |

### Mainnets

| Chain | `chainSelectorName` | RPC Required |
|-------|---------------------|--------------|
| Ethereum | `ethereum-mainnet` | ✅ |
| Polygon | `polygon-mainnet` | ✅ |

---

## Frontend Integration Example

### React/Next.js

```typescript
// lib/chainguard-api.ts
const CHAINGUARD_API = process.env.NEXT_PUBLIC_CHAINGUARD_ENDPOINT;

export async function addContract(
  contractAddress: string,
  chain: string,
  name?: string
) {
  const response = await fetch(`${CHAINGUARD_API}/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contractAddress,
      contractName: name,
      chainSelectorName: chain,
      alertChannels: ["email"],
    }),
  });

  return response.json();
}

export async function removeContract(
  contractAddress: string,
  chain: string
) {
  const response = await fetch(`${CHAINGUARD_API}/remove`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contractAddress,
      chainSelectorName: chain,
    }),
  });

  return response.json();
}

export async function getContractStatus(
  contractAddress: string,
  chain?: string
) {
  const params = new URLSearchParams({ contractAddress });
  if (chain) params.append("chainSelectorName", chain);

  const response = await fetch(
    `${CHAINGUARD_API}/status?${params}`
  );

  return response.json();
}

export async function getAllContracts() {
  const response = await fetch(`${CHAINGUARD_API}/contracts`);
  return response.json();
}
```

### Usage in Component

```typescript
// app/dashboard/contracts/page.tsx
import { addContract, getAllContracts } from "@/lib/chainguard-api";

export default function ContractsPage() {
  const [contracts, setContracts] = useState([]);

  const handleAddContract = async () => {
    const result = await addContract(
      contractAddress,
      selectedChain,
      contractName
    );

    if (result.success) {
      // Contract added successfully
      setContracts([...contracts, result.contract]);
    }
  };

  useEffect(() => {
    // Load all monitored contracts
    getAllContracts().then((data) => {
      if (data.success) {
        setContracts(data.contracts);
      }
    });
  }, []);

  // ...
}
```

---

## Error Handling

All endpoints return consistent error format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

### Common Errors

| Status Code | Error | Solution |
|-------------|-------|----------|
| 400 | Invalid contract address | Check address format (0x...) |
| 400 | Unknown chain | Use supported `chainSelectorName` |
| 404 | Contract not found | Contract not in monitoring system |
| 404 | Endpoint not found | Check API path |
| 500 | Internal server error | Contact support |

---

## Rate Limits

- **Contract additions**: Unlimited
- **Status queries**: Unlimited
- **Monitoring frequency**: Configurable via `cronSchedule`

---

## Security

- All API endpoints are public (authentication not yet implemented)
- **TODO**: Add API key authentication
- **TODO**: Add wallet signature verification
- Contracts are validated on-chain before acceptance

---

## Next Steps

1. **Deploy CRE workflow** to staging/production
2. **Get your API endpoint URL** from CRE dashboard
3. **Add endpoint to frontend** environment variables
4. **Test with sample contract** on testnet
5. **Enable monitoring** for production contracts

---

## Support

For issues or questions:
- GitHub Issues: [Your Repo]
- Discord: [Chainlink Discord](https://discord.gg/chainlink)
- Docs: [Chainlink CRE Docs](https://docs.chain.link/cre)
