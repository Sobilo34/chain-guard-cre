// evm.ts
// On-chain data fetching module for reading smart contract state.
// Uses CRE EVM Client to read contract data across multiple chains.

import {
  EVMClient,
  type Runtime,
  getNetwork,
  bytesToHex,
} from "@chainlink/cre-sdk";
import {
  type Address,
  encodeFunctionData,
  decodeFunctionResult,
  parseAbi,
  type Abi,
  formatUnits,
} from "viem";
import type { Config, MonitoredContract, ContractStateData } from "./types";

/*********************************
 * Standard ERC20 Token ABI
 *********************************/

const getErc20Abi = () => parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
]);

/*********************************
 * Common DeFi Protocol ABIs
 *********************************/

// Uniswap V2 Pair ABI (for liquidity monitoring)
const getUniswapV2PairAbi = () => parseAbi([
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function totalSupply() view returns (uint256)",
]);

// Aave V3 Pool ABI (for collateral monitoring)
const getAaveV3PoolAbi = () => parseAbi([
  "function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)",
]);

// Compound V3 Comet ABI
const getCompoundV3Abi = () => parseAbi([
  "function getCollateralReserves(address asset) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function totalBorrow() view returns (uint256)",
]);

/*********************************
 * Main Contract State Fetching
 *********************************/

/**
 * Fetches current state data from a monitored smart contract.
 * Reads on-chain data using CRE EVM Client and decodes responses.
 * 
 * @param runtime - CRE runtime instance
 * @param contract - Monitored contract configuration
 * @returns Contract state data including balances and function results
 */
export function fetchContractState(
  runtime: Runtime<Config>,
  contract: MonitoredContract
): ContractStateData {
  try {
    runtime.log(`Fetching state for contract: ${contract.name} (${contract.address})`);

    // Get network configuration
    const network = getNetwork({
      chainFamily: "evm",
      chainSelectorName: contract.chainSelectorName,
      isTestnet: contract.chainSelectorName.includes("testnet"),
    });

    if (!network) {
      throw new Error(`Network not found for chain: ${contract.chainSelectorName}`);
    }

    const evmClient = new EVMClient(network.chainSelector.selector);

    // Initialize result structure
    const stateData: ContractStateData = {
      contractAddress: contract.address,
      chainSelectorName: contract.chainSelectorName,
      timestamp: new Date(runtime.now()).toISOString(),
      functionResults: [],
    };

    // Fetch native balance (ETH/MATIC etc.)
    const nativeBalance = fetchNativeBalance(runtime, evmClient, contract.address);
    stateData.nativeBalance = nativeBalance;
    runtime.log(`Native balance: ${formatUnits(nativeBalance, 18)} ETH`);

    // If custom ABI and functions are provided, call them
    if (contract.abi && contract.monitoredFunctions && contract.monitoredFunctions.length > 0) {
      const functionResults = fetchCustomFunctions(
        runtime,
        evmClient,
        contract.address as Address,
        contract.abi as Abi,
        contract.monitoredFunctions
      );
      stateData.functionResults.push(...functionResults);
    }

    // Auto-detect contract type and fetch relevant data
    const detectedData = detectAndFetchProtocolData(
      runtime,
      evmClient,
      contract.address as Address
    );
    
    if (detectedData) {
      stateData.customState = detectedData;
    }

    runtime.log(`Successfully fetched state for ${contract.name}`);
    return stateData;

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    runtime.log(`Error fetching contract state: ${msg}`);
    throw new Error(`Failed to fetch state for ${contract.name}: ${msg}`);
  }
}

/*********************************
 * Native Balance Fetching
 *********************************/

/**
 * Fetches native token balance (ETH, MATIC, etc.) for an address.
 */
function fetchNativeBalance(
  runtime: Runtime<Config>,
  evmClient: any,
  address: string
): bigint {
  try {
    // Prefer explicit native-balance APIs when available on the SDK client.
    if (typeof evmClient.getBalance === "function") {
      const balanceResult = evmClient.getBalance({
        address: address as Address,
      }).result();

      if (typeof balanceResult === "bigint") return balanceResult;
      if (typeof balanceResult?.value === "bigint") return balanceResult.value;
    }

    // Fallback: skip native balance when capability is unavailable.
    return 0n;
  } catch (err) {
    runtime.log(`Error fetching native balance: ${err}`);
    return 0n;
  }
}

/*********************************
 * Custom Function Calls
 *********************************/

/**
 * Calls specified functions on a contract and decodes results.
 */
function fetchCustomFunctions(
  runtime: Runtime<Config>,
  evmClient: any,
  contractAddress: Address,
  abi: Abi,
  functionNames: string[]
): { functionName: string; returnValue: any; decoded?: any }[] {
  const results: { functionName: string; returnValue: any; decoded?: any }[] = [];

  for (const functionName of functionNames) {
    try {
      // Find function in ABI
      const abiFunction = abi.find(
        (item: any) => item.type === "function" && item.name === functionName
      );

      if (!abiFunction) {
        runtime.log(`Function ${functionName} not found in ABI`);
        continue;
      }

      // Encode function call
      const callData = encodeFunctionData({
        abi: [abiFunction],
        functionName: functionName,
        args: [], // Assuming view functions with no arguments
      });

      // Execute call
      const callResult = evmClient.read({
        to: contractAddress,
        data: callData as `0x${string}`,
      }).result();

      // Decode result
      const decoded = decodeFunctionResult({
        abi: [abiFunction],
        functionName: functionName,
        data: bytesToHex(callResult.data || new Uint8Array()),
      });

      results.push({
        functionName,
        returnValue: callResult.data,
        decoded,
      });

    } catch (err) {
      runtime.log(`Error calling function ${functionName}: ${err}`);
    }
  }

  return results;
}

/*********************************
 * Protocol-Specific Data Fetching
 *********************************/

/**
 * Auto-detects contract type and fetches relevant protocol data.
 * Attempts to identify if contract is ERC20, Uniswap pair, Aave pool, etc.
 */
function detectAndFetchProtocolData(
  runtime: Runtime<Config>,
  evmClient: any,
  address: Address
): Record<string, any> | undefined {
  try {
    // Try Uniswap V2
    const reserves = evmClient.read({
      to: address,
      data: encodeFunctionData({
        abi: getUniswapV2PairAbi(),
        functionName: "getReserves",
      }),
    }).result();

    if (reserves && reserves.data) {
      const decoded = decodeFunctionResult({
        abi: getUniswapV2PairAbi(),
        functionName: "getReserves",
        data: bytesToHex(reserves.data),
      }) as [bigint, bigint, number];

      return {
        reserve0: decoded[0].toString(),
        reserve1: decoded[1].toString(),
        lastUpdate: decoded[2],
      };
    }

  } catch (err) {
    // Ignore errors, return undefined
  }
}

/**
 * Attempts to fetch ERC20 token data.
 */
function tryFetchERC20Data(
  evmClient: any,
  tokenAddress: Address
): Record<string, any> | null {
  try {
    // Try to call balanceOf with zero address
    const balanceOfData = encodeFunctionData({
      abi: getErc20Abi(),
      functionName: "balanceOf",
      args: ["0x0000000000000000000000000000000000000000" as Address],
    });

    evmClient.read({
      to: tokenAddress,
      data: balanceOfData as `0x${string}`,
    }).result();

    // If successful, fetch more data
    const totalSupplyData = encodeFunctionData({
      abi: getErc20Abi(),
      functionName: "totalSupply",
    });

    const totalSupplyResult = evmClient.read({
      to: tokenAddress,
      data: totalSupplyData as `0x${string}`,
    }).result();

    const totalSupply = decodeFunctionResult({
      abi: getErc20Abi(),
      functionName: "totalSupply",
      data: bytesToHex(totalSupplyResult.data || new Uint8Array()),
    }) as bigint;

    // Fetch decimals
    const decimalsData = encodeFunctionData({
      abi: getErc20Abi(),
      functionName: "decimals",
    });

    const decimalsResult = evmClient.read({
      to: tokenAddress,
      data: decimalsData as `0x${string}`,
    }).result();

    const decimals = decodeFunctionResult({
      abi: getErc20Abi(),
      functionName: "decimals",
      data: bytesToHex(decimalsResult.data || new Uint8Array()),
    }) as number;

    return {
      totalSupply: totalSupply.toString(),
      totalSupplyFormatted: parseFloat(formatUnits(totalSupply, decimals)),
      decimals,
    };

  } catch (err) {
    return null; // Not an ERC20 or call failed
  }
}

/**
 * Attempts to fetch Uniswap V2 Pair data (for liquidity monitoring).
 */
function tryFetchUniswapPairData(
  evmClient: any,
  pairAddress: Address
): Record<string, any> | null {
  try {
    // Try to call getReserves
    const getReservesData = encodeFunctionData({
      abi: getUniswapV2PairAbi(),
      functionName: "getReserves",
    });

    const reservesResult = evmClient.read({
      to: pairAddress,
      data: getReservesData as `0x${string}`,
    }).result();

    const reserves = decodeFunctionResult({
      abi: getUniswapV2PairAbi(),
      functionName: "getReserves",
      data: bytesToHex(reservesResult.data || new Uint8Array()),
    }) as any;

    return {
      reserve0: reserves[0].toString(),
      reserve1: reserves[1].toString(),
      lastUpdate: reserves[2],
    };

  } catch (err) {
    return null; // Not a Uniswap pair or call failed
  }
}

/*********************************
 * Helper Functions
 *********************************/

/**
 * Fetches token balance for a specific address.
 */
export function fetchTokenBalance(
  runtime: Runtime<Config>,
  evmClient: any,
  tokenAddress: Address,
  holderAddress: Address
): bigint {
  try {
    const callData = encodeFunctionData({
      abi: getErc20Abi(),
      functionName: "balanceOf",
      args: [holderAddress],
    });

    const result = evmClient.read({
      to: tokenAddress,
      data: callData as `0x${string}`,
    }).result();

    const balance = decodeFunctionResult({
      abi: getErc20Abi(),
      functionName: "balanceOf",
      data: bytesToHex(result.data || new Uint8Array()),
    }) as bigint;

    return balance;
  } catch (err) {
    runtime.log(`Error fetching token balance: ${err}`);
    return 0n;
  }
}

/**
 * Batch fetch multiple token balances for gas efficiency.
 */
export function batchFetchTokenBalances(
  runtime: Runtime<Config>,
  evmClient: any,
  tokenAddresses: Address[],
  holderAddress: Address
): Map<Address, bigint> {
  const balances = new Map<Address, bigint>();

  for (const tokenAddress of tokenAddresses) {
    const balance = fetchTokenBalance(runtime, evmClient, tokenAddress, holderAddress);
    balances.set(tokenAddress, balance);
  }

  return balances;
}

/**
 * Calculates Total Value Locked (TVL) for a contract.
 * This is a simplified example - actual TVL calculation varies by protocol.
 */
export function calculateTVL(
  tokenBalances: Map<Address, bigint>,
  tokenPrices: Map<Address, number>,
  decimalsMap: Map<Address, number>
): number {
  let tvl = 0;

  for (const [tokenAddress, balance] of tokenBalances) {
    const price = tokenPrices.get(tokenAddress) || 0;
    const decimals = decimalsMap.get(tokenAddress) || 18;
    const balanceFormatted = parseFloat(formatUnits(balance, decimals));
    tvl += balanceFormatted * price;
  }

  return tvl;
}
