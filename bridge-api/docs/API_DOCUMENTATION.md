# ChainGuard Bridge API - Complete Documentation

## Overview

The ChainGuard Bridge API is a professional REST API that serves as a bridge between frontend applications and ChainGuard's CRE (Chainlink Runtime Environment) workflows. It provides comprehensive endpoints for smart contract monitoring, risk assessment, and alert management.

## 🎯 Key Features

### 1. Dual Request Types

#### Normal HTTP Requests

Standard REST API endpoints for:

- Contract management (CRUD operations)
- Alert retrieval and filtering
- On-demand risk scanning
- Status monitoring

#### CRE HTTP Triggers

Special endpoints that simulate Chainlink Runtime Environment workflows:

- **Normal CRE Triggers** - Standard workflow execution
- **Confidential CRE Triggers** - Secure enclave execution (experimental)

### 2. CRE Confidential Requests (Experimental)

Confidential HTTP is an experimental CRE feature that provides:

- **Secure Enclave Execution**: Runs in Trusted Execution Environment (TEE)
- **Secret Injection**: Use template syntax `{{.secretName}}` in requests
- **Response Encryption**: Optional AES-256-GCM encryption
- **Simulation Only**: Not yet available in deployed workflows

**Example Secret Injection:**

```json
{
  "action": "analyze",
  "enclaveConfig": {
    "secretsRequired": ["GEMINI_API_KEY", "SLACK_WEBHOOK"],
    "encryptResponse": false
  },
  "parameters": {
    "apiUrl": "https://api.gemini.com",
    "authHeader": "Bearer {{.GEMINI_API_KEY}}",
    "webhookUrl": "{{.SLACK_WEBHOOK}}"
  }
}
```

The CRE runtime will inject secrets from your `secrets.yaml`:

```yaml
secrets:
  GEMINI_API_KEY: "your-api-key"
  SLACK_WEBHOOK: "https://hooks.slack.com/..."
```

## 📡 API Endpoints

### Health & Status

#### GET /health

Check API server health status.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "uptime": 3600
}
```

### Contract Management

#### GET /api/contracts

List all monitored contracts.

**Response:**

```json
{
  "contracts": [
    {
      "address": "0x1234...",
      "name": "Aave V3 Pool",
      "protocol": "Aave",
      "chain": "ethereum",
      "riskThresholds": {
        "volatility": 0.15,
        "liquidity": 0.2,
        "concentration": 0.25
      }
    }
  ]
}
```

#### POST /api/contracts

Add a new contract to monitor.

**Request Body:**

```json
{
  "address": "0x1234567890123456789012345678901234567890",
  "name": "Test Contract",
  "protocol": "Aave",
  "chain": "ethereum",
  "riskThresholds": {
    "volatility": 0.15,
    "liquidity": 0.2,
    "concentration": 0.25
  },
  "priceFeeds": [
    {
      "asset": "ETH/USD",
      "feedAddress": "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"
    }
  ],
  "alertChannels": ["email", "slack"]
}
```

**Response:**

```json
{
  "success": true,
  "message": "Contract added successfully",
  "data": {
    "address": "0x1234...",
    "name": "Test Contract",
    "addedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

#### GET /api/contracts/:address

Get detailed information about a specific contract.

**Example:**

```bash
curl http://localhost:3001/api/contracts/0x1234567890123456789012345678901234567890
```

#### PUT /api/contracts/:address

Update contract configuration.

**Request Body:**

```json
{
  "name": "Updated Name",
  "riskThresholds": {
    "volatility": 0.2,
    "liquidity": 0.25,
    "concentration": 0.3
  }
}
```

#### DELETE /api/contracts/:address

Remove contract from monitoring.

#### GET /api/contracts/:address/status

Get current risk status for a contract.

**Response:**

```json
{
  "address": "0x1234...",
  "riskLevel": "HIGH",
  "riskScore": 0.75,
  "lastChecked": "2024-01-15T10:30:00.000Z",
  "metrics": {
    "volatility": 0.25,
    "liquidity": 0.15,
    "concentration": 0.3,
    "tvl": 1000000000
  },
  "activeAlerts": 2
}
```

### Alert Management

#### GET /api/alerts

Retrieve historical alerts with filtering.

**Query Parameters:**

- `address` - Filter by contract address
- `severity` - Filter by severity (LOW, MEDIUM, HIGH, CRITICAL)
- `limit` - Max results (default: 50, max: 100)
- `offset` - Pagination offset (default: 0)

**Example:**

```bash
curl "http://localhost:3001/api/alerts?severity=HIGH&limit=20"
```

**Response:**

```json
{
  "alerts": [
    {
      "id": "alert_123456789",
      "contractAddress": "0x1234...",
      "severity": "HIGH",
      "message": "High volatility detected",
      "details": {
        "volatility": 0.25,
        "threshold": 0.15
      },
      "timestamp": "2024-01-15T10:30:00.000Z",
      "resolved": false
    }
  ],
  "total": 45,
  "limit": 20,
  "offset": 0
}
```

### Scan Triggering

#### POST /api/scan

Trigger an immediate risk scan.

**Request Type:** Normal HTTP

**Request Body:**

```json
{
  "addresses": ["0x1234567890123456789012345678901234567890"],
  "priority": "high"
}
```

**Parameters:**

- `addresses` - Array of contract addresses (empty = scan all)
- `priority` - Scan priority: `low`, `normal`, `high`

**Response:**

```json
{
  "scanId": "wf_1234567890_abc123",
  "status": "running",
  "contractsQueued": 1,
  "estimatedCompletion": "2024-01-15T10:31:00.000Z"
}
```

## 🔐 CRE Workflow Endpoints

### Normal CRE HTTP Trigger

#### POST /cre/trigger

Execute CRE workflow with standard HTTP trigger.

**Request Type:** CRE Normal HTTP

**Request Body:**

```json
{
  "action": "scan",
  "contractAddress": "0x1234567890123456789012345678901234567890",
  "parameters": {
    "depth": "full",
    "includeHistorical": true
  },
  "signature": "0x..."
}
```

**Parameters:**

- `action` - Workflow action: `scan`, `monitor`, `evaluate`
- `contractAddress` - Target contract (optional)
- `parameters` - Additional parameters (optional)
- `signature` - EVM signature (required in production, optional in simulation)

**Response:**

```json
{
  "workflowId": "wf_1234567890_abc123",
  "status": "completed",
  "result": {
    "riskLevel": "LOW",
    "contractsProcessed": 1,
    "alertsGenerated": 0
  }
}
```

### Confidential CRE HTTP Trigger

#### POST /cre/confidential/trigger

Execute CRE workflow in secure enclave with secret injection.

**Request Type:** CRE Confidential HTTP (Experimental)

**⚠️ Important Notes:**

- Only available in simulation mode (`CRE_TARGET=local-simulation`)
- Not available in deployed workflows (yet)
- Supports secret injection via templates
- Optional response encryption

**Request Body:**

```json
{
  "action": "analyze",
  "contractAddress": "0x1234567890123456789012345678901234567890",
  "enclaveConfig": {
    "secretsRequired": ["GEMINI_API_KEY", "SLACK_WEBHOOK"],
    "encryptResponse": true
  },
  "parameters": {
    "analysisDepth": "comprehensive",
    "useAI": true
  }
}
```

**Parameters:**

- `action` - Workflow action: `analyze`, `evaluate`
- `contractAddress` - Target contract
- `enclaveConfig` - Enclave configuration
  - `secretsRequired` - Array of secret names to inject
  - `encryptResponse` - Whether to encrypt response (default: false)
- `parameters` - Additional parameters

**Response (Unencrypted):**

```json
{
  "workflowId": "wf_1234567890_abc123",
  "status": "completed",
  "encrypted": false,
  "result": {
    "riskLevel": "MEDIUM",
    "analysis": "AI-powered analysis results...",
    "recommendations": [...]
  }
}
```

**Response (Encrypted):**

```json
{
  "workflowId": "wf_1234567890_abc123",
  "status": "completed",
  "encrypted": true,
  "encryptedData": "base64-encoded-encrypted-response"
}
```

### CRE Report Submission

#### POST /cre/report

Submit reports from CRE workflow executions.

**Request Type:** CRE Normal HTTP

**Request Body:**

```json
{
  "reportType": "risk_assessment",
  "data": {
    "contractAddress": "0x1234567890123456789012345678901234567890",
    "riskLevel": "HIGH",
    "riskScore": 0.75,
    "metrics": {
      "volatility": 0.25,
      "liquidity": 0.15,
      "concentration": 0.3
    }
  },
  "signatures": ["0x...", "0x...", "0x..."],
  "timestamp": 1234567890
}
```

**Report Types:**

- `risk_assessment` - Update contract risk status
- `alert` - Create new alert
- `status_update` - General status update

**Parameters:**

- `reportType` - Type of report
- `data` - Report data (structure varies by type)
- `signatures` - DON node signatures (for consensus verification)
- `timestamp` - Unix timestamp

**Response:**

```json
{
  "success": true,
  "message": "Report submitted successfully"
}
```

### Workflow Execution Tracking

#### GET /cre/executions

List all workflow executions.

**Response:**

```json
{
  "executions": [
    {
      "id": "wf_1234567890_abc123",
      "type": "normal",
      "status": "completed",
      "startedAt": "2024-01-15T10:30:00.000Z",
      "completedAt": "2024-01-15T10:30:15.000Z",
      "result": {...}
    }
  ]
}
```

#### GET /cre/executions/:id

Get detailed information about a specific execution.

## 🔧 Configuration

### Environment Variables

Create `.env` file based on `.env.example`:

```env
# Server
NODE_ENV=development
PORT=3001

# CRE Configuration
CRE_WORKFLOW_PATH=../chainguard-sentinel
CRE_TARGET=local-simulation

# API Keys
GEMINI_API_KEY=your-api-key-here
SLACK_WEBHOOK=your-webhook-url

# Security
ENABLE_AUTH=false
JWT_SECRET=dev-secret-change-in-production

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Logging
LOG_LEVEL=info
```

## 🧪 Testing Examples

### Using cURL

**Add Contract:**

```bash
curl -X POST http://localhost:3001/api/contracts \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x1234567890123456789012345678901234567890",
    "name": "Test Contract",
    "protocol": "Aave",
    "riskThresholds": {
      "volatility": 0.15,
      "liquidity": 0.20,
      "concentration": 0.25
    }
  }'
```

**Trigger Normal Scan:**

```bash
curl -X POST http://localhost:3001/api/scan \
  -H "Content-Type: application/json" \
  -d '{
    "addresses": ["0x1234567890123456789012345678901234567890"],
    "priority": "high"
  }'
```

**CRE Normal Trigger:**

```bash
curl -X POST http://localhost:3001/cre/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "action": "scan",
    "contractAddress": "0x1234567890123456789012345678901234567890"
  }'
```

**CRE Confidential Trigger:**

```bash
curl -X POST http://localhost:3001/cre/confidential/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "action": "analyze",
    "contractAddress": "0x1234567890123456789012345678901234567890",
    "enclaveConfig": {
      "secretsRequired": ["GEMINI_API_KEY"],
      "encryptResponse": false
    }
  }'
```

**Get Alerts:**

```bash
curl "http://localhost:3001/api/alerts?severity=HIGH&limit=20"
```

### Using JavaScript/TypeScript

```typescript
// Add contract
const response = await fetch("http://localhost:3001/api/contracts", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    address: "0x1234567890123456789012345678901234567890",
    name: "Test Contract",
    protocol: "Aave",
    riskThresholds: {
      volatility: 0.15,
      liquidity: 0.2,
      concentration: 0.25,
    },
  }),
});

const data = await response.json();
console.log(data);
```

```typescript
// Trigger confidential workflow
const response = await fetch("http://localhost:3001/cre/confidential/trigger", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "analyze",
    contractAddress: "0x1234567890123456789012345678901234567890",
    enclaveConfig: {
      secretsRequired: ["GEMINI_API_KEY"],
      encryptResponse: false,
    },
  }),
});

const result = await response.json();
console.log("Workflow ID:", result.workflowId);
console.log("Status:", result.status);
console.log("Result:", result.result);
```

## 📊 Response Codes

| Code | Meaning               | Description                                              |
| ---- | --------------------- | -------------------------------------------------------- |
| 200  | OK                    | Request successful                                       |
| 201  | Created               | Resource created successfully                            |
| 202  | Accepted              | Request accepted for processing                          |
| 400  | Bad Request           | Invalid request parameters                               |
| 401  | Unauthorized          | Missing or invalid authentication                        |
| 404  | Not Found             | Resource not found                                       |
| 409  | Conflict              | Duplicate resource or cache hit                          |
| 500  | Internal Server Error | Server error occurred                                    |
| 501  | Not Implemented       | Feature not available (e.g., confidential in production) |

## 🔒 Security

### Authorization (Production)

In production CRE deployments, HTTP triggers require authorization:

1. Configure authorized keys in workflow:

```typescript
// workflow.yaml
http:
  authorizedKeys:
    - type: KEY_TYPE_ECDSA_EVM
      publicKey: "0xYourEthereumAddress"
```

2. Sign requests with private key:

```typescript
const signature = await wallet.signMessage(requestBody);
```

3. Include signature in header:

```bash
curl -X POST http://localhost:3001/cre/trigger \
  -H "X-EVM-Signature: 0x..." \
  -H "Content-Type: application/json" \
  -d '{...}'
```

### Secret Management

Confidential requests use CRE's secret management:

1. Define secrets in `secrets.yaml`:

```yaml
secrets:
  GEMINI_API_KEY: "your-api-key"
  SLACK_WEBHOOK: "https://hooks.slack.com/..."
```

2. Reference in workflow:

```typescript
const apiKey = await nodeRuntime.getSecret({ id: "GEMINI_API_KEY" });
```

3. Use templates in confidential requests:

```json
{
  "authHeader": "Bearer {{.GEMINI_API_KEY}}"
}
```

## 📚 Additional Resources

- [OpenAPI Specification](./docs/openapi.yaml)
- [CRE Documentation](https://docs.chain.link/chainlink-runtime-environment)
- [ChainGuard Sentinel Workflow](../chainguard-sentinel/README.md)
- [Frontend Integration Guide](./INTEGRATION_GUIDE.md)

## 🐛 Troubleshooting

### Workflow Execution Fails

**Problem:** CRE workflow execution returns error

**Solutions:**

1. Check CRE CLI is installed: `cre version`
2. Verify workflow path: `CRE_WORKFLOW_PATH=../chainguard-sentinel`
3. Check target setting: `CRE_TARGET=local-simulation`
4. Review workflow logs

### Confidential Trigger Returns 501

**Problem:** Confidential endpoint returns "Not Implemented"

**Solution:** Confidential HTTP is simulation-only:

```env
CRE_TARGET=local-simulation  # Required
```

### Invalid Ethereum Address

**Problem:** 400 error "Invalid Ethereum address format"

**Solution:** Ensure address is:

- 42 characters long (including '0x')
- Starts with '0x'
- Contains only hex characters (0-9, a-f, A-F)

Example: `0x1234567890123456789012345678901234567890`

### Missing Secrets

**Problem:** Confidential execution fails with missing secret

**Solution:** Add to `secrets.yaml`:

```yaml
secrets:
  GEMINI_API_KEY: "your-key-here"
```

## 📝 License

MIT
