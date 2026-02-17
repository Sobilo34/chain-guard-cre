/**
 * ChainGuard Bridge API Configuration
 */

import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiVersion: '1.0.0',

  // CRE Workflow
  creWorkflowPath: process.env.CRE_WORKFLOW_PATH || '../chainguard-sentinel',
  creTarget: process.env.CRE_TARGET || 'local-simulation',
  
  // Chainlink
  chainlinkRpcUrl: process.env.CHAINLINK_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo',
  
  // Secrets
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  slackWebhook: process.env.SLACK_WEBHOOK || '',
  
  // Security
  enableAuth: process.env.ENABLE_AUTH === 'true',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  
  // CORS
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  
  // Rate Limiting
  rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
  rateLimitMaxRequests: 100,
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // CRE Simulation Settings
  simulation: {
    timeout: 60000, // 60 seconds
    maxRetries: 3,
    cacheMaxAge: 60000, // 1 minute (for cacheSettings)
  },
  
  // Database (for future implementation)
  database: {
    enabled: process.env.DB_ENABLED === 'true',
    url: process.env.DATABASE_URL || '',
  },
} as const;

// Validate required configuration
export function validateConfig(): void {
  const errors: string[] = [];

  if (config.nodeEnv === 'production') {
    if (!config.geminiApiKey) {
      errors.push('GEMINI_API_KEY is required in production');
    }
    if (config.jwtSecret === 'dev-secret-change-in-production') {
      errors.push('JWT_SECRET must be set in production');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

// Export individual constants for convenience
export const {
  port,
  nodeEnv,
  apiVersion,
  creWorkflowPath,
  creTarget,
  chainlinkRpcUrl,
  geminiApiKey,
  slackWebhook,
  enableAuth,
  jwtSecret,
  corsOrigins,
  rateLimitWindowMs,
  rateLimitMaxRequests,
  logLevel,
  simulation,
  database,
} = config;

export default config;
