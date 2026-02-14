// chainlink-feeds.ts
// Chainlink Data Feeds integration for fetching real-time market data.
// Reads price feeds, calculates volatility, and monitors data freshness.

import {
  cre,
  type Runtime,
  getNetwork,
  bytesToHex,
  encodeCallMsg,
  LAST_FINALIZED_BLOCK_NUMBER,
} from "@chainlink/cre-sdk";
import {
  type Address,
  encodeFunctionData,
  decodeFunctionResult,
  parseAbi,
  formatUnits,
  zeroAddress,
} from "viem";
import type {
  Config,
  ChainlinkPriceFeedData,
  PriceFeedConfig,
  MarketDataSnapshot,
  MonitoredContract,
} from "./types";

/*********************************
 * Chainlink Price Feed ABI
 *********************************/

const CHAINLINK_AGGREGATOR_V3_ABI = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() view returns (uint8)",
  "function description() view returns (string)",
  "function getRoundData(uint80 _roundId) view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
]);

/*********************************
 * Well-Known Chainlink Feed Addresses
 *********************************/

// Ethereum Sepolia Testnet
const SEPOLIA_FEEDS: Record<string, PriceFeedConfig> = {
  "ETH/USD": {
    feedAddress: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
    pairName: "ETH/USD",
    decimals: 8,
    heartbeat: 3600, // 1 hour
  },
  "USDC/USD": {
    feedAddress: "0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E",
    pairName: "USDC/USD",
    decimals: 8,
    heartbeat: 86400, // 24 hours
  },
  "BTC/USD": {
    feedAddress: "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43",
    pairName: "BTC/USD",
    decimals: 8,
    heartbeat: 3600,
  },
};

// Polygon Amoy Testnet
const AMOY_FEEDS: Record<string, PriceFeedConfig> = {
  "MATIC/USD": {
    feedAddress: "0x001382149eBa3441043c1c66972b4772963f5D43",
    pairName: "MATIC/USD",
    decimals: 8,
    heartbeat: 120, // 2 minutes
  },
};

/*********************************
 * Main Price Feed Functions
 *********************************/

/**
 * Fetches latest price data from a Chainlink Price Feed.
 * 
 * @param runtime - CRE runtime instance
 * @param feedConfig - Price feed configuration
 * @param chainSelectorName - Chain to query the feed on
 * @returns Price feed data with formatted values
 */
export function fetchPriceFeed(
  runtime: Runtime<Config>,
  feedConfig: PriceFeedConfig,
  chainSelectorName: string
): ChainlinkPriceFeedData {
  try {
    runtime.log(`Fetching price feed: ${feedConfig.pairName}`);

    // Get network configuration
    const network = getNetwork({
      chainFamily: "evm",
      chainSelectorName,
      isTestnet: chainSelectorName.includes("testnet"),
    });

    if (!network) {
      throw new Error(`Network not found for chain: ${chainSelectorName}`);
    }

    const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);

    // Encode latestRoundData call
    const callData = encodeFunctionData({
      abi: CHAINLINK_AGGREGATOR_V3_ABI,
      functionName: "latestRoundData",
    });

    // Execute call
    const result = evmClient.callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: feedConfig.feedAddress as Address,
        data: callData,
      }),
      blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
    }).result();

    // Decode response
    const decoded = decodeFunctionResult({
      abi: CHAINLINK_AGGREGATOR_V3_ABI,
      functionName: "latestRoundData",
      data: bytesToHex(result.data || new Uint8Array()),
    }) as any;

    const [roundId, answer, startedAt, updatedAt, answeredInRound] = decoded as [bigint, bigint, bigint, bigint, bigint];

    // Format price
    const priceFormatted = parseFloat(formatUnits(decoded.answer, feedConfig.decimals));
    
    // Calculate staleness
    const currentTime = Math.floor(Date.now() / 1000);
    const lastUpdateAgo = currentTime - Number(decoded.updatedAt);
    const isStale = feedConfig.heartbeat
      ? lastUpdateAgo > feedConfig.heartbeat * 2
      : false;

    const feedData: ChainlinkPriceFeedData = {
      feedAddress: feedConfig.feedAddress,
      pairName: feedConfig.pairName,
      price: answer,
      decimals: feedConfig.decimals,
      roundId: roundId,
      updatedAt: updatedAt,
      answeredInRound: answeredInRound,
      priceFormatted,
      lastUpdateAgo,
      isStale,
    };

    runtime.log(
      `${feedConfig.pairName}: $${priceFormatted.toFixed(2)} (updated ${lastUpdateAgo}s ago)${isStale ? " [STALE]" : ""}`
    );

    return feedData;

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    runtime.log(`Error fetching price feed ${feedConfig.pairName}: ${msg}`);
    throw new Error(`Failed to fetch ${feedConfig.pairName}: ${msg}`);
  }
}

/**
 * Fetches historical price data to calculate volatility.
 * 
 * @param runtime - CRE runtime instance
 * @param feedConfig - Price feed configuration
 * @param chainSelectorName - Chain to query
 * @param numRounds - Number of historical rounds to fetch (default: 24 for hourly feeds)
 * @returns Array of historical prices
 */
export function fetchHistoricalPrices(
  runtime: Runtime<Config>,
  feedConfig: PriceFeedConfig,
  chainSelectorName: string,
  numRounds: number = 24
): number[] {
  try {
    runtime.log(`Fetching ${numRounds} historical rounds for ${feedConfig.pairName}`);

    const network = getNetwork({
      chainFamily: "evm",
      chainSelectorName,
      isTestnet: chainSelectorName.includes("testnet"),
    });

    if (!network) {
      throw new Error(`Network not found for chain: ${chainSelectorName}`);
    }

    const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);

    // Get latest round ID first
    const latestData = fetchPriceFeed(runtime, feedConfig, chainSelectorName);
    const latestRoundId = latestData.roundId;

    const prices: number[] = [];

    // Fetch previous rounds
    for (let i = 0; i < numRounds; i++) {
      const roundId = latestRoundId - BigInt(i);

      try {
        const callData = encodeFunctionData({
          abi: CHAINLINK_AGGREGATOR_V3_ABI,
          functionName: "getRoundData",
          args: [roundId],
        });

        const result = evmClient.callContract(runtime, {
          call: encodeCallMsg({
            from: zeroAddress,
            to: feedConfig.feedAddress as Address,
            data: callData,
          }),
          blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
        }).result();

        const decoded = decodeFunctionResult({
          abi: CHAINLINK_AGGREGATOR_V3_ABI,
          functionName: "getRoundData",
          data: bytesToHex(result.data || new Uint8Array()),
        }) as any;

        const price = parseFloat(formatUnits(decoded[1], feedConfig.decimals));
        prices.push(price);

      } catch (err) {
        // Round might not exist, skip
        runtime.log(`Round ${roundId} not found, skipping`);
      }
    }

    runtime.log(`Fetched ${prices.length} historical prices for ${feedConfig.pairName}`);
    return prices;

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    runtime.log(`Error fetching historical prices: ${msg}`);
    return [];
  }
}

/*********************************
 * Volatility & Risk Calculations
 *********************************/

/**
 * Calculates 24-hour price volatility using standard deviation.
 * 
 * @param prices - Array of historical prices (newest first)
 * @returns Volatility as a percentage (e.g., 0.15 = 15% volatility)
 */
export function calculateVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;

  // Calculate returns
  const returns: number[] = [];
  for (let i = 0; i < prices.length - 1; i++) {
    const returnVal = (prices[i] - prices[i + 1]) / prices[i + 1];
    returns.push(returnVal);
  }

  // Calculate mean return
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;

  // Calculate variance
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;

  // Standard deviation (volatility)
  const volatility = Math.sqrt(variance);

  return volatility;
}

/**
 * Calculates price change percentage over a period.
 * 
 * @param currentPrice - Current price
 * @param previousPrice - Previous price
 * @returns Price change as decimal (e.g., 0.05 = 5% increase)
 */
export function calculatePriceChange(currentPrice: number, previousPrice: number): number {
  if (previousPrice === 0) return 0;
  return (currentPrice - previousPrice) / previousPrice;
}

/**
 * Checks if a stablecoin has depegged from its target.
 * 
 * @param currentPrice - Current stablecoin price
 * @param targetPrice - Target peg price (usually 1.0 for USD stablecoins)
 * @param tolerance - Acceptable deviation (e.g., 0.02 = 2%)
 * @returns Object with depeg status and deviation amount
 */
export function checkDepeg(
  currentPrice: number,
  targetPrice: number = 1.0,
  tolerance: number = 0.02
): { isDepegged: boolean; deviation: number } {
  const deviation = Math.abs(currentPrice - targetPrice) / targetPrice;
  const isDepegged = deviation > tolerance;

  return { isDepegged, deviation };
}

/*********************************
 * Market Data Snapshot Builder
 *********************************/

/**
 * Builds a comprehensive market data snapshot for a monitored contract.
 * Fetches current prices, calculates volatility, and checks for anomalies.
 * 
 * @param runtime - CRE runtime instance
 * @param contract - Monitored contract configuration
 * @returns Market data snapshot with all calculated metrics
 */
export function buildMarketDataSnapshot(
  runtime: Runtime<Config>,
  contract: MonitoredContract
): MarketDataSnapshot {
  const snapshot: MarketDataSnapshot = {
    timestamp: new Date().toISOString(),
    contractAddress: contract.address,
    chainSelectorName: contract.chainSelectorName,
  };

  try {
    // Fetch price feeds if configured
    if (contract.priceFeeds && contract.priceFeeds.length > 0) {
      const primaryFeed = contract.priceFeeds[0];
      
      // Get current price
      const currentPriceFeed = fetchPriceFeed(
        runtime,
        primaryFeed,
        contract.chainSelectorName
      );
      snapshot.currentPrice = currentPriceFeed.priceFormatted;

      // Get historical prices for volatility
      const historicalPrices = fetchHistoricalPrices(
        runtime,
        primaryFeed,
        contract.chainSelectorName,
        24 // Last 24 data points
      );

      if (historicalPrices.length > 0) {
        // Calculate 24h price change
        const oldestPrice = historicalPrices[historicalPrices.length - 1];
        snapshot.priceChange24h = calculatePriceChange(
          currentPriceFeed.priceFormatted,
          oldestPrice
        );

        // Calculate volatility
        snapshot.volatility24h = calculateVolatility(historicalPrices);

        runtime.log(`Price: $${snapshot.currentPrice?.toFixed(2)}, 24h Change: ${((snapshot.priceChange24h || 0) * 100).toFixed(2)}%, Volatility: ${((snapshot.volatility24h || 0) * 100).toFixed(2)}%`);
      }

      // Check for depeg if it's a stablecoin
      if (primaryFeed.pairName.includes("USDC") || primaryFeed.pairName.includes("USDT") || primaryFeed.pairName.includes("DAI")) {
        const depegCheck = checkDepeg(
          currentPriceFeed.priceFormatted,
          1.0,
          contract.riskThresholds.depegTolerance || 0.02
        );
        
        snapshot.priceDeviationFromPeg = depegCheck.deviation;
        
        if (depegCheck.isDepegged) {
          runtime.log(`⚠️  DEPEG DETECTED: ${primaryFeed.pairName} is ${(depegCheck.deviation * 100).toFixed(2)}% off peg`);
        }
      }
    } else {
      // No price feeds configured, try to use default feeds based on chain
      runtime.log("No price feeds configured, using default ETH/USD feed");
      const defaultFeed = getDefaultFeedForChain(contract.chainSelectorName);
      
      if (defaultFeed) {
        const priceFeed = fetchPriceFeed(runtime, defaultFeed, contract.chainSelectorName);
        snapshot.currentPrice = priceFeed.priceFormatted;
      }
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    runtime.log(`Error building market data snapshot: ${msg}`);
  }

  return snapshot;
}

/*********************************
 * Helper Functions
 *********************************/

/**
 * Gets default price feed for a chain (ETH/USD for Ethereum, MATIC/USD for Polygon, etc.)
 */
export function getDefaultFeedForChain(chainSelectorName: string): PriceFeedConfig | null {
  if (chainSelectorName.includes("ethereum")) {
    return SEPOLIA_FEEDS["ETH/USD"];
  } else if (chainSelectorName.includes("polygon")) {
    return AMOY_FEEDS["MATIC/USD"];
  }
  return null;
}

/**
 * Fetches multiple price feeds in parallel for efficiency.
 */
export function fetchMultiplePriceFeeds(
  runtime: Runtime<Config>,
  feedConfigs: PriceFeedConfig[],
  chainSelectorName: string
): Map<string, ChainlinkPriceFeedData> {
  const feedData = new Map<string, ChainlinkPriceFeedData>();

  for (const feedConfig of feedConfigs) {
    try {
      const data = fetchPriceFeed(runtime, feedConfig, chainSelectorName);
      feedData.set(feedConfig.pairName, data);
    } catch (err) {
      runtime.log(`Failed to fetch ${feedConfig.pairName}, skipping`);
    }
  }

  return feedData;
}

/**
 * Checks if price feed data is stale and needs updating.
 */
export function isPriceFeedStale(
  feedData: ChainlinkPriceFeedData,
  maxStalenessSeconds: number = 7200 // 2 hours default
): boolean {
  return feedData.lastUpdateAgo > maxStalenessSeconds;
}

/**
 * Export well-known feeds for easy access
 */
export const WELL_KNOWN_FEEDS = {
  SEPOLIA: SEPOLIA_FEEDS,
  AMOY: AMOY_FEEDS,
};
