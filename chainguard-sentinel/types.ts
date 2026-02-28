// types.ts
// Type definitions and schemas for ChainGuard Sentinel workflow.
// Includes configuration validation, risk assessment structures, and alert payloads.

import { z } from "zod";

/*********************************
 * Configuration Schemas
 *********************************/

/**
 * Alert channel types supported by the notification system.
 */
export const AlertChannelSchema = z.enum([
  "email",
  "slack",
  "telegram",
  "discord",
  "onchain",
]);

export type AlertChannel = z.infer<typeof AlertChannelSchema>;

/**
 * Risk threshold configuration for a monitored contract.
 * Defines acceptable limits for various market risk indicators.
 */
export const RiskThresholdsSchema = z.object({
  // Maximum allowed price deviation for stablecoins (e.g., 0.02 = 2%)
  depegTolerance: z.number().min(0).max(1).optional(),

  // Maximum 24-hour volatility (e.g., 0.10 = 10%)
  volatilityMax: z.number().min(0).max(10).optional(),

  // Maximum liquidity drop percentage (e.g., 0.20 = 20%)
  liquidityDropMax: z.number().min(0).max(1).optional(),

  // Minimum collateralization ratio (e.g., 1.5 = 150%)
  collateralRatioMin: z.number().min(0).optional(),

  // Maximum gas price threshold in Gwei for transaction alerts
  gasPriceMax: z.number().min(0).optional(),

  // Custom threshold for protocol-specific metrics
  customThreshold: z.number().optional(),
});

export type RiskThresholds = z.infer<typeof RiskThresholdsSchema>;

/**
 * Chainlink Price Feed configuration for fetching market data.
 */
export const PriceFeedConfigSchema = z.object({
  // Address of the Chainlink Price Feed aggregator
  feedAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/u),

  // Asset pair name (e.g., "ETH/USD", "USDC/USD")
  pairName: z.string(),

  // Expected number of decimals in the feed
  decimals: z.number().int().min(0).max(18),

  // Optional: Heartbeat interval in seconds (how often feed updates)
  heartbeat: z.number().int().min(0).optional(),
});

export type PriceFeedConfig = z.infer<typeof PriceFeedConfigSchema>;

/**
 * Configuration for a single monitored smart contract.
 */
export const MonitoredContractSchema = z.object({
  // Contract address to monitor
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/u, "Must be valid Ethereum address"),

  // User-friendly name for the contract
  name: z.string().min(1),

  // Chain selector name (e.g., "ethereum-testnet-sepolia")
  chainSelectorName: z.string().min(1),

  // Risk thresholds specific to this contract
  riskThresholds: RiskThresholdsSchema,

  // Alert channels to use for this contract
  alertChannels: z.array(AlertChannelSchema).min(1),

  // Optional: Specific price feeds to monitor for this contract
  priceFeeds: z.array(PriceFeedConfigSchema).optional(),

  // Optional: Contract ABI for reading specific functions
  abi: z.array(z.any()).optional(),

  // Optional: Specific functions to call for state reading
  monitoredFunctions: z.array(z.string()).optional(),

  // Optional: Owner/admin addresses to notify
  ownerAddresses: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/u)).optional(),

  // Optional: Custom metadata for the contract
  metadata: z.record(z.string(), z.any()).optional(),
});

export type MonitoredContract = z.infer<typeof MonitoredContractSchema>;

/**
 * Email notification configuration.
 */
export const EmailConfigSchema = z.object({
  from: z.string().email(),
  to: z.array(z.string().email()).min(1),
  subject: z.string().optional(),
  apiEndpoint: z.string().url().optional(),
});

export type EmailConfig = z.infer<typeof EmailConfigSchema>;

/**
 * Main workflow configuration schema.
 * Validates all runtime settings for ChainGuard Sentinel.
 */
export const configSchema = z.object({
  // OpenRouter model for risk analysis (e.g. google/gemini-2.0-flash-001)
  openRouterModel: z.string().optional(),
  geminiModel: z.string().optional(), // legacy alias

  // Cron schedule for monitoring (e.g., "*/5 * * * *" = every 5 minutes)
  cronSchedule: z.string().optional(),

  // List of contracts to monitor
  monitoredContracts: z.array(MonitoredContractSchema).min(1),

  // Gas limit for EVM transactions
  gasLimit: z.string().regex(/^\d+$/).optional(),

  // Optional: Email notification settings
  emailConfig: EmailConfigSchema.optional(),

  // Optional: Enable verbose logging
  verboseLogging: z.boolean().optional(),

  // Optional: Maximum number of contracts to process per run
  maxContractsPerRun: z.number().int().min(1).max(100).optional(),

  // Optional: Timeout for AI API calls in milliseconds
  aiTimeoutMs: z.number().int().min(1000).optional(),
  geminiTimeoutMs: z.number().int().min(1000).optional(), // legacy
}).passthrough();

export type Config = z.infer<typeof configSchema>;

/*********************************
 * Risk Assessment Types
 *********************************/

/**
 * Types of risks that can be detected.
 */
export const RiskTypeSchema = z.enum([
  "DEPEG",           // Stablecoin price deviation
  "VOLATILITY",      // High price volatility
  "LIQUIDITY",       // Liquidity pool issues
  "COLLATERAL",      // Under-collateralization
  "GAS_SPIKE",       // Gas price anomalies
  "MANIPULATION",    // Potential market manipulation
  "EXPLOIT",         // Potential exploit detected
  "CUSTOM",          // Protocol-specific risk
]);

export type RiskType = z.infer<typeof RiskTypeSchema>;

/**
 * Risk severity levels.
 */
export const RiskLevelSchema = z.enum([
  "LOW",       // Informational, no immediate action needed
  "MEDIUM",    // Monitor closely, prepare mitigation
  "HIGH",      // Take action soon, risk is significant
  "CRITICAL",  // Immediate action required, potential exploit/loss
]);

export type RiskLevel = z.infer<typeof RiskLevelSchema>;

/**
 * Market data snapshot for a specific asset or contract.
 */
export interface MarketDataSnapshot {
  timestamp: string;
  contractAddress: string;
  chainSelectorName: string;

  // Price data
  currentPrice?: number;
  priceChange24h?: number;
  priceDeviationFromPeg?: number;

  // Volatility metrics
  volatility24h?: number;
  volatility7d?: number;

  // Liquidity data
  totalLiquidity?: number;
  liquidityChange24h?: number;

  // Contract-specific metrics
  totalValueLocked?: number;
  collateralRatio?: number;
  reserveRatio?: number;

  // Gas metrics
  currentGasPrice?: number;
  averageGasPrice24h?: number;

  // Custom metrics
  customMetrics?: Record<string, number>;
}

/**
 * Schema for Gemini AI risk analysis response.
 */
export const GeminiRiskResponseSchema = z.object({
  riskLevel: RiskLevelSchema,
  riskType: RiskTypeSchema,
  confidence: z.number().int().min(0).max(10000),
  reasoning: z.string(),
  cause: z.string(),
  consequences: z.string(),
  nextSteps: z.array(z.string()),
  suggestedActions: z.array(z.string()),
  affectedMetrics: z.array(z.string()).optional(),
  estimatedImpact: z.string().optional(),
  mitigationStrategy: z.string().optional(),
});

export type GeminiRiskResponse = z.infer<typeof GeminiRiskResponseSchema>;

/**
 * Complete risk assessment result for a contract.
 */
export interface RiskAssessment {
  contractAddress: string;
  contractName: string;
  chainSelectorName: string;
  timestamp: string;

  // Market data used for assessment
  marketData: MarketDataSnapshot;

  // AI-generated risk analysis
  aiAnalysis: GeminiRiskResponse;

  // Threshold violations detected
  thresholdViolations: {
    type: keyof RiskThresholds;
    currentValue: number;
    thresholdValue: number;
    severity: RiskLevel;
  }[];

  // Overall risk score (0-100)
  overallRiskScore: number;

  // Whether alerts should be triggered
  shouldAlert: boolean;
}

/*********************************
 * Alert & Notification Types
 *********************************/

/**
 * Alert payload sent to notification channels.
 */
export interface AlertPayload {
  // Alert metadata
  alertId: string;
  timestamp: string;

  // Contract information
  contractAddress: string;
  contractName: string;
  chainSelectorName: string;

  // Risk details
  riskLevel: RiskLevel;
  riskType: RiskType;
  riskScore: number;

  // Analysis summary
  summary: string;
  reasoning: string;
  cause: string;
  consequences: string;
  nextSteps: string[];
  mitigationStrategy?: string;

  // Specific metrics that triggered the alert
  triggeredMetrics: {
    name: string;
    currentValue: number;
    threshold: number;
    unit?: string;
  }[];

  // Recommended actions
  suggestedActions: string[];

  // Raw data for advanced users
  rawMarketData?: MarketDataSnapshot;

  // Links and resources
  explorerLink?: string;
  dashboardLink?: string;
}

/**
 * Result of sending an alert to a channel.
 */
export interface AlertDeliveryResult {
  channel: AlertChannel;
  success: boolean;
  timestamp: string;
  messageId?: string;
  error?: string;
}

/*********************************
 * Gemini API Types
 *********************************/

/**
 * Request payload for Gemini API.
 */
export interface GeminiApiRequest {
  system_instruction: {
    parts: { text: string }[];
  };
  tools?: any[];
  contents: {
    parts: { text: string }[];
  }[];
}

/**
 * Response from Gemini API.
 */
export interface GeminiApiResponse {
  candidates: {
    content: {
      parts: { text: string }[];
    };
  }[];
  responseId?: string;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

/**
 * Parsed Gemini response with metadata.
 */
export interface GeminiResponse {
  statusCode: number;
  geminiResponse: string; // Raw JSON string from Gemini
  responseId: string;
  rawJsonString: string;
  tokensUsed?: number;
}

/*********************************
 * Chainlink Data Feed Types
 *********************************/

/**
 * Data from a Chainlink Price Feed.
 */
export interface ChainlinkPriceFeedData {
  feedAddress: string;
  pairName: string;
  price: bigint;
  decimals: number;
  roundId: bigint;
  updatedAt: bigint;
  answeredInRound: bigint;

  // Computed values
  priceFormatted: number;
  lastUpdateAgo: number; // seconds since last update
  isStale: boolean; // true if older than heartbeat
}

/*********************************
 * EVM Contract State Types
 *********************************/

/**
 * Generic contract state reading result.
 */
export interface ContractStateData {
  contractAddress: string;
  chainSelectorName: string;
  timestamp: string;

  // Function call results
  functionResults: {
    functionName: string;
    returnValue: any;
    decoded?: any;
  }[];

  // Token balances if applicable
  tokenBalances?: {
    token: string;
    balance: bigint;
    balanceFormatted: number;
  }[];

  // Native balance
  nativeBalance?: bigint;

  // Custom state variables
  customState?: Record<string, any>;
}

/*********************************
 * Utility Types
 *********************************/

/**
 * CRE workflow execution context.
 */
export interface WorkflowContext {
  executionId: string;
  startTime: string;
  contractsProcessed: number;
  alertsTriggered: number;
  errors: string[];
}

/**
 * Consensus aggregation result wrapper.
 */
export interface ConsensusResult<T> {
  value: T;
  consensus: boolean;
  nodeCount: number;
  agreementPercentage: number;
}
