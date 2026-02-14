# HTTP API Implementation - TODO

## Status
The HTTP API for dynamic contract management is **temporarily disabled** due to CRE SDK limitations with the HTTPCapability in version 0.0.8-alpha.

## Current Workaround
Contracts can be added/removed by:
1. Editing `config.json` or `config.staging.json`
2. Adding/removing contracts in the `monitoredContracts` array
3. Redeploying the CRE workflow

## Planned Implementation
Once CRE SDK stabilizes HTTP support or a newer version is available, we will implement:

### Endpoints
- `POST /add` - Add contract for monitoring
- `POST /remove` - Remove contract from monitoring
- `GET /status` - Get contract status
- `GET /contracts` - List all monitored contracts

### Files Ready
- ✅ `api-handler.ts` - Core logic implemented (needs HTTP payload fixes)
- ✅ `contract-manager.ts` - Contract type detection working
- ✅ `API_DOCUMENTATION.md` - Complete API documentation

### Required Changes
1. Wait for CRE SDK to stabilize `HTTPCapability` or `HTTPClient` for inbound requests
2. Update `api-handler.ts` to use correct payload types
3. Re-enable HTTP handler in `main.ts`
4. Add authentication layer (API keys or wallet signatures)
5. Replace in-memory storage with persistent database

## Alternative Approach
Consider using:
- External API Gateway → Updates config file → Triggers CRE redeployment
- Chainlink Functions for inbound HTTP → Writes to contract → CRE reads from contract
- Direct database updates that CRE reads on each cron execution

## References
- CRE SDK Version: `@chainlink/cre-sdk@0.0.8-alpha`
- HTTPCapability Documentation: (Not yet available in alpha)
- Working Examples: Only Cron and EVM Log triggers available in reference implementations
