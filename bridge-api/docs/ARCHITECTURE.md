# ChainGuard Bridge API Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend / Client                        │
│                  (React, Next.js, CLI, etc.)                    │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ HTTP/HTTPS Requests
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                   ChainGuard Bridge API                          │
│                    (Express + TypeScript)                        │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                      Routes Layer                          │ │
│  │  /api/contracts  /api/alerts  /api/scan  /cre/*          │ │
│  └──────────────────────┬─────────────────────────────────────┘ │
│                         │                                         │
│  ┌──────────────────────▼───────────────────────────────────┐   │
│  │                 Middleware Layer                          │   │
│  │  • Validation  • Error Handling  • Logging  • Auth      │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         │                                         │
│  ┌──────────────────────▼───────────────────────────────────┐   │
│  │                Controllers Layer                          │   │
│  │  contract.controller  alert.controller  cre.controller   │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         │                                         │
│  ┌──────────────────────▼───────────────────────────────────┐   │
│  │                  Services Layer                           │   │
│  │  • Contract Service  • CRE Workflow Service              │   │
│  │  • Business Logic    • External Integrations             │   │
│  └──────────────┬───────────────────┬───────────────────────┘   │
│                 │                   │                             │
└─────────────────┼───────────────────┼─────────────────────────────┘
                  │                   │
        ┌─────────▼──────┐   ┌────────▼────────┐
        │  In-Memory DB  │   │  CRE CLI        │
        │  (Contracts,   │   │  (Workflow      │
        │   Alerts)      │   │   Simulation)   │
        └────────────────┘   └────────┬────────┘
                                      │
                             ┌────────▼────────────┐
                             │ ChainGuard Sentinel │
                             │   CRE Workflow      │
                             │  (TypeScript)       │
                             └─────────────────────┘
```

## Request Flow

### Normal HTTP Request (Contract Management)

```
Client
  │
  │ POST /api/contracts
  │ { address: "0x...", name: "..." }
  │
  ▼
Express Router (/api/contracts)
  │
  │ Validation Middleware
  │ • validateEthereumAddress()
  │ • validateBody(['address', 'name', 'protocol'])
  │ • validateRiskThresholds()
  │
  ▼
Contract Controller (addContract)
  │
  │ asyncHandler wrapper
  │
  ▼
Contract Service (contractService.addContract)
  │
  │ Business Logic:
  │ • Check if exists
  │ • Create contract object
  │ • Store in memory
  │ • Initialize status
  │
  ▼
Response
  │
  │ { success: true, message: "...", data: {...} }
  │
  ▼
Client
```

### CRE Normal HTTP Trigger

```
Client
  │
  │ POST /cre/trigger
  │ { action: "scan", contractAddress: "0x..." }
  │
  ▼
Express Router (/cre/trigger)
  │
  │ Validation Middleware
  │ • validateBody(['action'])
  │ • validateEnum('action', ['scan', 'monitor', 'evaluate'])
  │ • validateCRESignature() [optional in simulation]
  │
  ▼
CRE Controller (httpTrigger)
  │
  │ asyncHandler wrapper
  │ logger.info('CRE HTTP trigger received')
  │
  ▼
CRE Workflow Service (executeNormalWorkflow)
  │
  │ • Generate workflow ID
  │ • Create execution record
  │ • runCRESimulation()
  │   ├─ Build CRE command
  │   ├─ Execute: cre workflow simulate
  │   ├─ Parse output
  │   └─ Extract metrics
  │ • Update execution status
  │
  ▼
Response
  │
  │ { workflowId: "wf_...", status: "completed", result: {...} }
  │
  ▼
Client
```

### CRE Confidential HTTP Trigger

```
Client
  │
  │ POST /cre/confidential/trigger
  │ {
  │   action: "analyze",
  │   enclaveConfig: {
  │     secretsRequired: ["GEMINI_API_KEY"],
  │     encryptResponse: false
  │   }
  │ }
  │
  ▼
Express Router (/cre/confidential/trigger)
  │
  │ Validation Middleware
  │ • validateBody(['action', 'enclaveConfig'])
  │ • validateEnum('action', ['analyze', 'evaluate'])
  │ • validateCRESignature()
  │
  ▼
CRE Controller (confidentialTrigger)
  │
  │ asyncHandler wrapper
  │ logger.info('CRE confidential trigger received')
  │
  ▼
CRE Workflow Service (executeConfidentialWorkflow)
  │
  │ • Check simulation mode (throw if production)
  │ • Generate workflow ID
  │ • Create execution record
  │ • runConfidentialSimulation()
  │   ├─ Log: 'Confidential execution in secure enclave'
  │   ├─ Log: Secrets required
  │   ├─ Run CRE simulation (simulated TEE)
  │   └─ Simulate secret injection
  │ • Handle encryption if requested
  │   ├─ encryptResponse() [base64 for simulation]
  │   └─ Return encrypted data
  │
  ▼
Response (Encrypted)
  │
  │ {
  │   workflowId: "wf_...",
  │   status: "completed",
  │   encrypted: true,
  │   encryptedData: "base64-encoded..."
  │ }
  │
  ▼
Client
```

## Component Interactions

```
┌───────────────────────────────────────────────────────────────┐
│                      API Components                            │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────┐      ┌──────────────┐    ┌──────────────┐  │
│  │   Routes     │─────▶│ Controllers  │───▶│  Services    │  │
│  │              │      │              │    │              │  │
│  │ • Define     │      │ • Handle     │    │ • Business   │  │
│  │   endpoints  │      │   requests   │    │   logic      │  │
│  │ • Apply      │      │ • Validate   │    │ • External   │  │
│  │   middleware │      │   data       │    │   calls      │  │
│  │              │      │ • Return     │    │ • State      │  │
│  │              │      │   responses  │    │   management │  │
│  └──────────────┘      └──────────────┘    └──────────────┘  │
│         │                      │                    │          │
│         │                      │                    │          │
│  ┌──────▼──────────────────────▼────────────────────▼───────┐ │
│  │                    Middleware                             │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │ │
│  │  │  Validation  │  │ Error Handler│  │    Logger    │  │ │
│  │  │              │  │              │  │              │  │ │
│  │  │ • Address    │  │ • ApiError   │  │ • Request    │  │ │
│  │  │ • Body       │  │ • Global     │  │ • Response   │  │ │
│  │  │ • Enum       │  │ • HTTP codes │  │ • Duration   │  │ │
│  │  │ • Numeric    │  │              │  │              │  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │ │
│  └───────────────────────────────────────────────────────────┘ │
│         │                      │                    │          │
│  ┌──────▼──────────────────────▼────────────────────▼───────┐ │
│  │                     Types Layer                           │ │
│  │  • TypeScript interfaces                                  │ │
│  │  • Validation helpers                                     │ │
│  │  • Type guards                                            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Contract Management Flow

```
1. Client Request
   │
   ▼
2. Route Matching (/api/contracts)
   │
   ▼
3. Middleware Chain
   │ ├─ Validation (address, body, thresholds)
   │ ├─ Authentication (if enabled)
   │ └─ Logging
   │
   ▼
4. Controller Layer
   │ ├─ Extract request data
   │ ├─ Call service method
   │ └─ Format response
   │
   ▼
5. Service Layer
   │ ├─ Business logic
   │ ├─ Data validation
   │ ├─ State management
   │ └─ Error handling
   │
   ▼
6. Data Storage (In-Memory)
   │ ├─ contracts: Map<address, Contract>
   │ ├─ statuses: Map<address, Status>
   │ └─ alerts: Alert[]
   │
   ▼
7. Response
   │ ├─ Success: { success: true, data: {...} }
   │ └─ Error: { error: "...", code: "..." }
```

### CRE Workflow Execution Flow

```
1. Client Request (/cre/trigger or /cre/confidential/trigger)
   │
   ▼
2. Route + Middleware
   │ ├─ Validate action enum
   │ ├─ Validate signature (if production)
   │ └─ Log request
   │
   ▼
3. Controller
   │ ├─ Determine request type (normal/confidential)
   │ └─ Delegate to workflow service
   │
   ▼
4. CRE Workflow Service
   │ ├─ Generate workflow ID
   │ ├─ Create execution record
   │ │
   │ ├─ [Normal] runCRESimulation()
   │ │   ├─ Build command: cre workflow simulate
   │ │   ├─ Execute with timeout
   │ │   ├─ Parse stdout/stderr
   │ │   └─ Extract metrics
   │ │
   │ └─ [Confidential] runConfidentialSimulation()
   │     ├─ Check simulation mode
   │     ├─ Log secret requirements
   │     ├─ Run simulation (simulated TEE)
   │     └─ Encrypt response (if requested)
   │
   ▼
5. ChainGuard Sentinel (CRE Workflow)
   │ ├─ Fetch contract state
   │ ├─ Get Chainlink price feeds
   │ ├─ Analyze with Gemini AI
   │ ├─ Evaluate risk
   │ └─ Generate alerts
   │
   ▼
6. Response to Client
   │ ├─ workflowId
   │ ├─ status (accepted/running/completed)
   │ ├─ result (if completed)
   │ └─ encrypted data (if confidential + encrypted)
```

## Security Architecture

```
┌────────────────────────────────────────────────────────────┐
│                   Security Layers                          │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  1. CORS Protection                                        │
│     • Configured origins                                   │
│     • Credentials support                                  │
│                                                            │
│  2. Request Validation                                     │
│     • Ethereum address format                              │
│     • Required fields                                      │
│     • Enum values                                          │
│     • Numeric ranges                                       │
│                                                            │
│  3. Authentication (Optional)                              │
│     • JWT tokens                                           │
│     • EVM signatures                                       │
│                                                            │
│  4. Error Handling                                         │
│     • No sensitive info in production                      │
│     • Structured error responses                           │
│     • HTTP status codes                                    │
│                                                            │
│  5. Secret Management (CRE)                                │
│     • Environment variables                                │
│     • Secret injection ({{.secretName}})                   │
│     • Enclave execution (simulation)                       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## Deployment Architecture

```
Development:
  Bridge API (localhost:3001)
      ↓
  CRE Workflow (local-simulation)
      ↓
  ChainGuard Sentinel

Production:
  Load Balancer
      ↓
  Bridge API Cluster (Docker/K8s)
      ↓
  CRE Workflow (production)
      ↓
  ChainGuard Sentinel (DON)
      ↓
  Chainlink Network
```

## Technology Stack

```
┌─────────────────────────────────────────┐
│          Frontend Layer                 │
│  • React / Next.js / Vue.js            │
│  • Fetch API / Axios                    │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│          API Layer                      │
│  • Express.js (Web Framework)          │
│  • TypeScript (Type Safety)            │
│  • CORS (Security)                     │
│  • dotenv (Configuration)              │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│       CRE Integration Layer             │
│  • CRE CLI (Chainlink)                 │
│  • Child Process Execution             │
│  • Workflow Simulation                 │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│       ChainGuard Sentinel               │
│  • TypeScript Workflow                  │
│  • EVM Client (viem)                    │
│  • Chainlink Price Feeds               │
│  • Gemini AI Integration               │
└─────────────────────────────────────────┘
```

## File Organization

```
bridge-api/
│
├── src/                      # Source code
│   ├── config/              # Configuration management
│   │   └── index.ts         # Environment variables, validation
│   │
│   ├── controllers/         # Request handlers
│   │   ├── contract.controller.ts
│   │   ├── alert.controller.ts
│   │   ├── scan.controller.ts
│   │   └── cre.controller.ts
│   │
│   ├── services/            # Business logic
│   │   ├── creWorkflow.service.ts
│   │   └── contract.service.ts
│   │
│   ├── routes/              # Endpoint definitions
│   │   ├── contract.routes.ts
│   │   ├── alert.routes.ts
│   │   ├── scan.routes.ts
│   │   └── cre.routes.ts
│   │
│   ├── middleware/          # Request processing
│   │   ├── errorHandler.ts
│   │   ├── validation.ts
│   │   └── logger.ts
│   │
│   ├── types/               # TypeScript definitions
│   │   └── index.ts
│   │
│   ├── utils/               # Helper functions
│   │   └── helpers.ts
│   │
│   └── server.ts            # Main application
│
├── docs/                    # Documentation
│   ├── openapi.yaml        # OpenAPI 3.0 spec
│   └── API_DOCUMENTATION.md # Complete guide
│
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
├── .env.example             # Environment template
├── README.md                # Main documentation
├── QUICK_START.md           # Quick start guide
└── IMPLEMENTATION_SUMMARY.md # What was built
```

---

**Legend:**

- `│` = Connection/Flow
- `▼` = Direction of flow
- `─►` = Direct relationship
- `┌─┐` = Component boundary
- `├─┤` = Section boundary
