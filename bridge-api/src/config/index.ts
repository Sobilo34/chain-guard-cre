/**
 * ChainGuard Bridge API Configuration
 */

import { config as dotenvConfig } from 'dotenv';
import {
  mainnet, sepolia, holesky,
  arbitrum, arbitrumSepolia,
  optimism, optimismSepolia,
  base, baseSepolia,
  polygon, polygonAmoy
} from 'viem/chains';

// Load environment variables
dotenvConfig();

export const NETWORKS: Record<string, { chain: any, rpcUrl: string, name: string, selector: string }> = {
  ethereumMainnet: {
    chain: mainnet,
    rpcUrl: 'https://ethereum-rpc.publicnode.com',
    name: 'Ethereum Mainnet',
    selector: 'ethereum-mainnet'
  },
  arbitrumMainnet: {
    chain: arbitrum,
    rpcUrl: 'https://arbitrum-one-rpc.publicnode.com',
    name: 'Arbitrum One',
    selector: 'arbitrum-mainnet'
  },
  optimismMainnet: {
    chain: optimism,
    rpcUrl: 'https://optimism-rpc.publicnode.com',
    name: 'Optimism Mainnet',
    selector: 'optimism-mainnet'
  },
  baseMainnet: {
    chain: base,
    rpcUrl: 'https://base-rpc.publicnode.com',
    name: 'Base Mainnet',
    selector: 'base-mainnet'
  },
  polygonMainnet: {
    chain: polygon,
    rpcUrl: 'https://polygon-bor-rpc.publicnode.com',
    name: 'Polygon Mainnet',
    selector: 'polygon-mainnet'
  },
  sepolia: {
    chain: sepolia,
    rpcUrl: 'https://rpc.ankr.com/eth_sepolia',
    name: 'Ethereum Sepolia',
    selector: 'ethereum-testnet-sepolia'
  },
  holesky: {
    chain: holesky,
    rpcUrl: 'https://ethereum-holesky-rpc.publicnode.com',
    name: 'Ethereum Holesky',
    selector: 'ethereum-testnet-holesky'
  },
  polygonAmoy: {
    chain: polygonAmoy,
    rpcUrl: 'https://polygon-amoy-bor-rpc.publicnode.com',
    name: 'Polygon Amoy',
    selector: 'polygon-testnet-amoy'
  },
  arbitrumSepolia: {
    chain: arbitrumSepolia,
    rpcUrl: 'https://arbitrum-sepolia-rpc.publicnode.com',
    name: 'Arbitrum Sepolia',
    selector: 'arbitrum-testnet-sepolia'
  },
  optimismSepolia: {
    chain: optimismSepolia,
    rpcUrl: 'https://optimism-sepolia-rpc.publicnode.com',
    name: 'Optimism Sepolia',
    selector: 'optimism-testnet-sepolia'
  },
  baseSepolia: {
    chain: baseSepolia,
    rpcUrl: 'https://base-sepolia-rpc.publicnode.com',
    name: 'Base Sepolia',
    selector: 'base-testnet-sepolia'
  }
};

export const config = {
  // Server
  port: parseInt(process.env.PORT || '4100', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiVersion: '1.0.0',

  // CRE Workflow
  creWorkflowPath: process.env.CRE_WORKFLOW_PATH || '../chainguard-sentinel',
  creTarget: process.env.CRE_TARGET || 'local-simulation',

  // Chainlink
  chainlinkRpcUrl: process.env.CHAINLINK_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',

  // Secrets
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  slackWebhook: process.env.SLACK_WEBHOOK || '',

  // Security
  enableAuth: process.env.ENABLE_AUTH === 'true',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',

  // CORS
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'],

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
