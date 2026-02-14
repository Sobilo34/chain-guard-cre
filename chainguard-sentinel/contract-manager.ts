// contract-manager.ts
// Dynamic contract management for ChainGuard Sentinel
// Handles adding, removing, and detecting contract types (normal, UUPS, Diamond)

import { cre, type Runtime, bytesToHex } from "@chainlink/cre-sdk";
import {
  type Address,
  encodeFunctionData,
  decodeFunctionResult,
  parseAbi,
  zeroAddress,
} from "viem";
import type { Config, MonitoredContract } from "./types";

/*********************************
 * Contract Type Detection
 *********************************/

// EIP-1967 Proxy Storage Slots
const EIP1967_IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const EIP1967_BEACON_SLOT = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";

// Diamond Proxy Facets
const getDiamondLoupeAbi = () => parseAbi([
  "function facets() external view returns (tuple(address facetAddress, bytes4[] functionSelectors)[])",
  "function facetAddresses() external view returns (address[])",
]);

// UUPS Proxy ABI
const getUupsProxyAbi = () => parseAbi([
  "function implementation() external view returns (address)",
  "function proxiableUUID() external view returns (bytes32)",
]);

export enum ContractType {
  NORMAL = "NORMAL",
  UUPS_PROXY = "UUPS_PROXY",
  TRANSPARENT_PROXY = "TRANSPARENT_PROXY",
  BEACON_PROXY = "BEACON_PROXY",
  DIAMOND_PROXY = "DIAMOND_PROXY",
  UNKNOWN = "UNKNOWN",
}

export interface ContractDetectionResult {
  contractType: ContractType;
  implementationAddress?: Address;
  facets?: Address[];
  metadata: Record<string, any>;
}

/**
 * Detects the type of contract (normal, upgradable, diamond)
 */
export function detectContractType(
  runtime: Runtime<Config>,
  evmClient: any,
  contractAddress: Address
): ContractDetectionResult {
  runtime.log(`Detecting contract type for ${contractAddress}`);

  // 1. Try to detect UUPS proxy
  try {
    const callData = encodeFunctionData({
      abi: getUupsProxyAbi(),
      functionName: "proxiableUUID",
    });

    const result = evmClient.read({
      to: contractAddress,
      data: callData as `0x${string}`,
    }).result();

    const implementation = decodeFunctionResult({
      abi: getUupsProxyAbi(),
      functionName: "implementation",
      data: bytesToHex(result.data || new Uint8Array()),
    }) as Address;

    if (implementation && implementation !== zeroAddress) {
      runtime.log(`UUPS proxy detected, implementation: ${implementation}`);
      return {
        contractType: ContractType.UUPS_PROXY,
        implementationAddress: implementation,
        metadata: { proxyType: "UUPS" },
      };
    }
  } catch (err) {
    // Not a UUPS proxy
  }

  // 2. Try to detect Transparent Proxy (EIP-1967)
  try {
    // Read EIP-1967 implementation slot directly from storage
    const storageResult = evmClient.getStorageAt({
      address: contractAddress,
      slot: EIP1967_IMPLEMENTATION_SLOT as `0x${string}`,
    }).result();

    if (storageResult && storageResult.length > 0) {
      // Extract address from storage slot (last 20 bytes)
      const implementation = ("0x" + bytesToHex(storageResult).slice(-40)) as Address;
      
      if (implementation !== zeroAddress) {
        runtime.log(`Transparent proxy detected, implementation: ${implementation}`);
        return {
          contractType: ContractType.TRANSPARENT_PROXY,
          implementationAddress: implementation,
          metadata: { proxyType: "EIP-1967 Transparent" },
        };
      }
    }
  } catch (err) {
    // Not a transparent proxy
  }

  // 3. Try to detect Beacon Proxy
  try {
    // Read EIP-1967 beacon slot
    const storageResult = evmClient.getStorageAt({
      address: contractAddress,
      slot: EIP1967_BEACON_SLOT as `0x${string}`,
    }).result();

    if (storageResult && storageResult.length > 0) {
      const beaconAddress = ("0x" + bytesToHex(storageResult).slice(-40)) as Address;
      
      if (beaconAddress !== zeroAddress) {
        runtime.log(`Beacon proxy detected, beacon: ${beaconAddress}`);
        
        // Try to get implementation from beacon
        // Beacons typically have implementation() function
        try {
          const beaconAbi = parseAbi(["function implementation() external view returns (address)"]);
          const callData = encodeFunctionData({
            abi: beaconAbi,
            functionName: "implementation",
          });

          const result = evmClient.read({
            to: beaconAddress,
            data: callData as `0x${string}`,
          }).result();

          const implementation = decodeFunctionResult({
            abi: beaconAbi,
            functionName: "implementation",
            data: bytesToHex(result.data || new Uint8Array()),
          }) as Address;

          return { 
            contractType: ContractType.BEACON_PROXY,
            implementationAddress: implementation,
            metadata: { proxyType: "Beacon", beaconAddress },
          };
        } catch {
          return { 
            contractType: ContractType.BEACON_PROXY,
            metadata: { proxyType: "Beacon", beaconAddress },
          };
        }
      }
    }
  } catch (err) {
    // Not a beacon proxy
  }

  // 4. Try to detect Diamond Proxy (EIP-2535)
  try {
    const callData = encodeFunctionData({
      abi: getDiamondLoupeAbi(),
      functionName: "facetAddresses",
    });

    const result = evmClient.read({
      to: contractAddress,
      data: callData as `0x${string}`,
    }).result();

    const facets = decodeFunctionResult({
      abi: getDiamondLoupeAbi(),
      functionName: "facetAddresses",
      data: bytesToHex(result.data || new Uint8Array()),
    }) as Address[];

    if (facets && facets.length > 0) {
      runtime.log(`Diamond proxy detected with ${facets.length} facets`);
      return {
        contractType: ContractType.DIAMOND_PROXY,
        facets,
        metadata: { 
          proxyType: "Diamond (EIP-2535)",
          facetCount: facets.length,
        },
      };
    }
  } catch (err) {
    // Not a diamond proxy
  }

  // 5. Default to normal contract
  return {
    contractType: ContractType.NORMAL,
    metadata: { proxyType: "None" },
  };
}

/*********************************
 * Contract Management
 *********************************/

/**
 * Validates and enriches a contract configuration
 */
export function enrichContractConfig(
  runtime: Runtime<Config>,
  evmClient: any,
  contractAddress: Address,
  chainSelectorName: string,
  userProvidedName?: string
): Partial<MonitoredContract> {
  // Detect contract type
  const detection = detectContractType(runtime, evmClient, contractAddress);

  // Build enriched config
  const enrichedConfig: Partial<MonitoredContract> = {
    address: contractAddress,
    name: userProvidedName || `Contract ${contractAddress.slice(0, 10)}...`,
    chainSelectorName,
    metadata: {
      contractType: detection.contractType,
      detectedAt: new Date(runtime.now()).toISOString(),
      ...detection.metadata,
    },
  };

  // Add implementation address for proxies
  if (detection.implementationAddress) {
    enrichedConfig.metadata!.implementationAddress = detection.implementationAddress;
  }

  // Add facets for diamond proxies
  if (detection.facets) {
    enrichedConfig.metadata!.facets = detection.facets;
  }

  runtime.log(`Contract enriched: ${JSON.stringify(enrichedConfig.metadata)}`);

  return enrichedConfig;
}

/**
 * Gets the actual contract address to monitor
 * For proxies, returns implementation address
 * For diamonds, returns all facet addresses
 */
export function getMonitoringTargets(
  detection: ContractDetectionResult,
  proxyAddress: Address
): Address[] {
  const targets: Address[] = [proxyAddress]; // Always monitor the proxy itself

  switch (detection.contractType) {
    case ContractType.UUPS_PROXY:
    case ContractType.TRANSPARENT_PROXY:
    case ContractType.BEACON_PROXY:
      if (detection.implementationAddress) {
        targets.push(detection.implementationAddress);
      }
      break;

    case ContractType.DIAMOND_PROXY:
      if (detection.facets) {
        targets.push(...detection.facets);
      }
      break;

    default:
      // Normal contract - only monitor itself
      break;
  }

  return targets;
}
