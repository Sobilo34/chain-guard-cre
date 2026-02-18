# ChainGuard Bridge API

REST API bridge for interacting with ChainGuard CRE workflows with **interactive Swagger documentation**.

## 🚀 Quick Start

```bash
cd /home/bilal/bilal_projects/Hackathons/chainlink/chain-guard-cre/bridge-api
npm install
npm run dev
```

**Access the API:**

- 📚 **Interactive Swagger UI:** http://localhost:4100/docs
- 🏥 **Health Check:** http://localhost:4100/health
- 📄 **OpenAPI Spec:** http://localhost:4100/openapi.yaml

## 📋 Interactive Documentation

### Swagger UI Features

The API now includes **full Swagger UI** with clickable endpoint testing:

- ✅ **Try it out** button on every endpoint
- ✅ Pre-filled example requests
- ✅ Real-time request/response inspection
- ✅ Filter endpoints by tag
- ✅ Clear CRE pattern indicators (Normal vs Confidential HTTP)

### How to Use

1. **Open Swagger UI:** Navigate to http://localhost:4100/docs
2. **Browse endpoints:** Expand any endpoint to see details
3. **Click "Try it out":** Interactive form appears
4. **Fill parameters:** Use examples or customize
5. **Execute:** Click "Execute" button to send request
6. **View response:** See real-time response with status code and body

## 📡 API Endpoints

### Contract Management (Normal HTTP)

- `GET /api/contracts` - List monitored contracts
- `POST /api/contracts` - Add new contract
- `GET /api/contracts/{address}` - Get contract details
- `PUT /api/contracts/{address}` - Update contract
- `DELETE /api/contracts/{address}` - Remove contract
- `GET /api/contracts/{address}/status` - Get risk status

### Alerts (Normal HTTP)

- `GET /api/alerts` - Get alert history with filtering

### Scanning (Normal HTTP)

- `POST /api/scan` - Trigger on-demand risk scan

### CRE Workflow Triggers

#### Normal HTTP

- `POST /cre/trigger` - Standard CRE HTTP trigger
- `POST /cre/report` - Submit monitoring report

#### Confidential HTTP (Experimental)

- `POST /cre/confidential/trigger` - Secure enclave trigger with secret injection

## 🎯 CRE Pattern Guide

### Normal HTTP (Standard CRE)

**Used by:** Contract management, alerts, standard scans, reports

- ✅ Works in simulation **and** production
- ✅ Standard REST patterns
- ✅ Environment-based secrets

**Example:**

```bash
curl -X POST http://localhost:4100/api/scan \
  -H "Content-Type: application/json" \
  -d '{
    "addresses": ["0x1234567890123456789012345678901234567890"],
    "priority": "high"
  }'
```

### Confidential HTTP (Experimental TEE)

**Used by:** Operations requiring secret injection

- 🔐 Secret injection: `{{.secretName}}`
- 🔐 Response encryption (AES-256-GCM)
- ⚠️ **Simulation-only**

**Example:**

```bash
curl -X POST http://localhost:4100/cre/confidential/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api.gemini.com/v1/analyze",
    "headers": {
      "Authorization": "Bearer {{.GEMINI_API_KEY}}"
    },
    "body": {"data": "analysis-request"},
    "enclaveConfig": {"returnEncrypted": true}
  }'
```

**See full guide:** [docs/CRE_PATTERNS_GUIDE.md](docs/CRE_PATTERNS_GUIDE.md)

## 🛠️ Configuration

Create `.env` file:

```env
PORT=4100
NODE_ENV=development
LOG_LEVEL=info
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
CRE_WORKFLOW_PATH=/path/to/chainguard-sentinel
CRE_TARGET=local-simulation
GEMINI_API_KEY=your-gemini-api-key-here
```

## 📚 Documentation

- **Swagger UI:** http://localhost:4100/docs (clickable endpoints!)
- **OpenAPI Spec:** http://localhost:4100/openapi.yaml
- **Architecture Guide:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **API Reference:** [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)
- **CRE Patterns:** [docs/CRE_PATTERNS_GUIDE.md](docs/CRE_PATTERNS_GUIDE.md)
- **Quick Start:** [QUICK_START.md](QUICK_START.md)

## 🏗️ Architecture

```
bridge-api/
├── src/
│   ├── config/           # Configuration management
│   ├── controllers/      # Request handlers
│   ├── services/         # Business logic
│   ├── routes/           # Route definitions
│   ├── middleware/       # Validation, errors, logging
│   ├── types/            # TypeScript definitions
│   └── server.ts         # Express app + Swagger UI
├── docs/
│   ├── openapi.yaml      # OpenAPI 3.0 specification
│   ├── API_DOCUMENTATION.md
│   ├── ARCHITECTURE.md
│   └── CRE_PATTERNS_GUIDE.md
└── package.json
```

## 🧪 Testing

### Test via Swagger UI (Recommended)

1. Open http://localhost:4100/docs
2. Click any endpoint
3. Click "Try it out"
4. Execute and view response

### Test via cURL

```bash
# Health check
curl http://localhost:4100/health

# List contracts
curl http://localhost:4100/api/contracts

# Add contract
curl -X POST http://localhost:4100/api/contracts \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x1234567890123456789012345678901234567890",
    "name": "Test Contract",
    "protocol": "Aave",
    "riskThresholds": {
      "volatility": 0.15,
      "liquidity": 0.1,
      "concentration": 0.2
    }
  }'

# Trigger scan
curl -X POST http://localhost:4100/api/scan \
  -H "Content-Type: application/json" \
  -d '{
    "addresses": ["0x1234567890123456789012345678901234567890"],
    "priority": "high"
  }'
```

## 📦 Scripts

```bash
npm run dev      # Start development server with watch mode
npm run start    # Start production server
npm run build    # Compile TypeScript
npm run check    # Type check without emitting
```

## 🔍 Features

- ✅ **Interactive Swagger UI** with clickable endpoint testing
- ✅ **OpenAPI 3.0** specification
- ✅ **TypeScript** with strict type checking
- ✅ **MVC Architecture** (Models, Views, Controllers)
- ✅ **Request Validation** with Zod schemas
- ✅ **Error Handling** with custom error classes
- ✅ **Structured Logging** with configurable levels
- ✅ **CORS Support** with configurable origins
- ✅ **CRE Integration** (Normal & Confidential HTTP patterns)
- ✅ **In-memory Storage** (easily replaceable with database)

## 🔐 CRE Request Types

| Pattern               | Endpoints                               | Use Cases                                              |
| --------------------- | --------------------------------------- | ------------------------------------------------------ |
| **Normal HTTP**       | `/api/*`, `/cre/trigger`, `/cre/report` | CRUD operations, standard workflows, report submission |
| **Confidential HTTP** | `/cre/confidential/trigger`             | Secret injection, encrypted responses, TEE execution   |

## 🚦 Response Status Codes

- `200` - Success
- `201` - Created
- `202` - Accepted (async operation)
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid auth)
- `404` - Not Found
- `409` - Conflict (duplicate)
- `500` - Internal Server Error
- `501` - Not Implemented (confidential in production)

## 📝 Notes

- **Confidential HTTP** is experimental and **simulation-only**
- Secret injection uses template syntax: `{{.secretName}}`
- All endpoints documented with clear CRE pattern indicators
- Use Swagger UI for the easiest testing experience!

## 🤝 Contributing

1. Follow TypeScript strict mode
2. Add validation middleware to new routes
3. Update OpenAPI spec for new endpoints
4. Document CRE pattern usage
5. Run `npm run check` before committing

## 📄 License

MIT
