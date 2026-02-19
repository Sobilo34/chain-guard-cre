/**
 * ChainGuard Bridge API Type Definitions
 * 
 * Aligned with OpenAPI schema and CRE patterns
 */

// ============================================================================
// Core Domain Types
// ============================================================================

export interface MonitoredContract {
  address: string;
  name: string;
  protocol: string;
  chain?: string;
  riskThresholds: RiskThresholds;
  priceFeeds?: PriceFeed[];
  alertChannels?: AlertChannel[];
  addedAt?: Date;
}

export interface RiskThresholds {
  volatility: number;
  liquidity: number;
  concentration: number;
  overall?: number;
}

export interface PriceFeed {
  asset: string;
  feedAddress: string;
  decimals?: number;
}

export type AlertChannel = 'email' | 'slack' | 'webhook';

export interface ContractStatus {
  address: string;
  riskLevel: RiskLevel;
  riskScore?: number;
  lastChecked: Date;
  metrics?: RiskMetrics;
  activeAlerts?: number;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskMetrics {
  volatility?: number;
  liquidity?: number;
  concentration?: number;
  tvl?: number;
  volume24h?: number;
  price?: number;
}

export interface ContractDetails extends ContractStatus {
  name: string;
  chain: string;
  history?: {
      volatility: { time: string; value: number }[];
      riskScore: { time: string; score: number }[];
  };
  aiSuggestions?: { title: string; description: string }[];
}

export interface Alert {
  id: string;
  contractAddress: string;
  severity: RiskLevel;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  resolved?: boolean;
  resolvedAt?: Date;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface AddContractRequest {
  address: string;
  name: string;
  protocol: string;
  chain?: string;
  riskThresholds?: RiskThresholds;
  priceFeeds?: PriceFeed[];
  alertChannels?: AlertChannel[];
}

export interface UpdateContractRequest {
  name?: string;
  riskThresholds?: RiskThresholds;
  priceFeeds?: PriceFeed[];
  alertChannels?: AlertChannel[];
}

export interface ScanRequest {
  addresses?: string[];
  priority?: 'low' | 'normal' | 'high';
}

export interface ScanResponse {
  scanId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  estimatedCompletion?: Date;
  contractsQueued?: number;
}

export interface ApiSuccessResponse {
  success: boolean;
  message: string;
  data?: Record<string, any>;
}

export interface ErrorResponse {
  error: string;
  details?: string;
  code?: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  version?: string;
  uptime?: number;
}

// ============================================================================
// CRE-Specific Types (Normal HTTP)
// ============================================================================

export interface CREHttpTriggerPayload {
  action: 'scan' | 'monitor' | 'evaluate';
  contractAddress?: string;
  parameters?: Record<string, any>;
  signature?: string; // EVM signature for authorization
}

export interface CRETriggerResponse {
  workflowId: string;
  status: 'accepted' | 'running' | 'completed';
  result?: Record<string, any>;
}

export interface CREReportSubmission {
  reportType: 'risk_assessment' | 'alert' | 'status_update';
  data: Record<string, any>;
  signatures?: string[]; // DON node signatures
  timestamp?: number; // Unix timestamp
}

// ============================================================================
// CRE-Specific Types (Confidential HTTP - Experimental)
// ============================================================================

export interface CREConfidentialTriggerPayload {
  action: 'analyze' | 'evaluate';
  contractAddress?: string;
  enclaveConfig: EnclaveConfig;
  parameters?: Record<string, any>;
}

export interface EnclaveConfig {
  secretsRequired?: string[]; // e.g., ["GEMINI_API_KEY", "SLACK_WEBHOOK"]
  encryptResponse?: boolean;
}

export interface CREConfidentialResponse {
  workflowId: string;
  status: 'accepted' | 'running' | 'completed';
  encrypted: boolean;
  encryptedData?: string; // Base64-encoded if encrypted=true
  result?: Record<string, any>; // Plaintext if encrypted=false
}

// ============================================================================
// CRE Authorization Types
// ============================================================================

export interface AuthorizedKey {
  type: 'KEY_TYPE_ECDSA_EVM';
  publicKey: string; // 0x-prefixed Ethereum address
}

export interface CREHttpTriggerConfig {
  authorizedKeys: AuthorizedKey[];
}

// For simulation mode
export const SIMULATION_CONFIG: CREHttpTriggerConfig = {
  authorizedKeys: [] // Empty for simulation
};

// ============================================================================
// Internal Service Types
// ============================================================================

export interface WorkflowExecution {
  id: string;
  type: 'normal' | 'confidential';
  payload: CREHttpTriggerPayload | CREConfidentialTriggerPayload;
  status: 'queued' | 'running' | 'accepted' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
}

export interface SimulationResult {
  success: boolean;
  output: any;
  duration: number;
  logs: string[];
}

// ============================================================================
// Utility Types
// ============================================================================

export type Awaitable<T> = T | Promise<T>;

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// Validation Helpers
// ============================================================================

export const isValidEthereumAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

export const isValidRiskLevel = (level: string): level is RiskLevel => {
  return ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(level);
};

export const isValidAlertChannel = (channel: string): channel is AlertChannel => {
  return ['email', 'slack', 'webhook'].includes(channel);
};
