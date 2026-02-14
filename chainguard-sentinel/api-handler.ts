// api-handler.ts
// Contract management functions for ChainGuard Sentinel
// Provides programmatic contract addition/removal functionality

import {
  cre,
  type Runtime,
  getNetwork,
} from "@chainlink/cre-sdk";
import { type Address } from "viem";
import type { Config, MonitoredContract } from "./types";
import { enrichContractConfig } from "./contract-manager";

/*********************************
 * In-Memory Contract Storage
 * NOTE: This is initialized from config.json on startup
 * For truly dynamic management, replace with persistent database
 *********************************/

// Simulated database - populated from config on init
const contractDatabase: Map<string, MonitoredContract> = new Map();

function generateContractKey(address: Address, chainSelectorName: string): string {
  return `${chainSelectorName}:${address.toLowerCase()}`;
}

/*********************************
 * Contract Management Functions
 *********************************/

/**
 * Initialize contract database from config file
 * Called once at workflow startup
 */
export function initializeFromConfig(config: Config): void {
  console.log("Initializing contract database from config...");
  
  for (const contract of config.monitoredContracts) {
    const key = generateContractKey(contract.address as Address, contract.chainSelectorName);
    contractDatabase.set(key, contract);
    console.log(`Loaded contract: ${contract.name} (${key})`);
  }
  
  console.log(`Total contracts loaded: ${contractDatabase.size}`);
}

/**
 * Get all monitored contracts
 * Used by cron trigger to fetch current contract list
 */
export function getAllMonitoredContracts(): MonitoredContract[] {
  return Array.from(contractDatabase.values());
}

/**
 * Add a new contract to monitoring
 * (Programmatic addition - not via HTTP for now)
 */
export function addContract(
  runtime: Runtime<Config>,
  contractAddress: Address,
  chainSelectorName: string,
  options?: {
    contractName?: string;
    riskThresholds?: any;
    alertChannels?: Array<"email" | "slack" | "telegram" | "discord" | "onchain">;
    priceFeeds?: any[];
  }
): MonitoredContract {
  runtime.log(`Adding contract: ${contractAddress} on ${chainSelectorName}`);

  // Validate chain exists
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName,
    isTestnet: chainSelectorName.includes("testnet") || chainSelectorName.includes("sepolia") || chainSelectorName.includes("amoy"),
  });

  if (!network) {
    throw new Error(`Unknown chain: ${chainSelectorName}`);
  }

  const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);

  // Detect and enrich contract configuration
  const enrichedConfig = enrichContractConfig(
    runtime,
    evmClient,
    contractAddress,
    chainSelectorName,
    options?.contractName
  );

  // Build complete contract configuration
  const newContract: MonitoredContract = {
    address: contractAddress,
    name: enrichedConfig.name!,
    chainSelectorName,
    riskThresholds: options?.riskThresholds || {
      depegTolerance: 0.02,
      volatilityMax: 0.15,
      liquidityDropMax: 0.25,
      collateralRatioMin: 1.5,
    },
    alertChannels: options?.alertChannels || ["email"],
    priceFeeds: options?.priceFeeds,
    metadata: enrichedConfig.metadata,
  };

  // Store in database
  const key = generateContractKey(contractAddress, chainSelectorName);
  contractDatabase.set(key, newContract);

  runtime.log(`Contract added successfully: ${key}`);
  return newContract;
}

/**
 * Remove a contract from monitoring
 */
export function removeContract(
  runtime: Runtime<Config>,
  contractAddress: Address,
  chainSelectorName: string
): boolean {
  const key = generateContractKey(contractAddress, chainSelectorName);
  
  if (!contractDatabase.has(key)) {
    runtime.log(`Contract not found: ${key}`);
    return false;
  }

  contractDatabase.delete(key);
  runtime.log(`Contract removed: ${key}`);
  return true;
}

/**
 * Get contract status/details
 */
export function getContract(
  contractAddress: Address,
  chainSelectorName: string
): MonitoredContract | undefined {
  const key = generateContractKey(contractAddress, chainSelectorName);
  return contractDatabase.get(key);
}

/**
 * Get all contracts for a specific chain
 */
export function getContractsByChain(chainSelectorName: string): MonitoredContract[] {
  return Array.from(contractDatabase.values()).filter(
    (contract) => contract.chainSelectorName === chainSelectorName
  );
}
