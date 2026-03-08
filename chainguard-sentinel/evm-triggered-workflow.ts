/**
 * EVM-triggered ChainGuard CRE workflow.
 * Triggered by RiskAnalysisRequested events from ChainGuardCREConsumer.
 * Fetches contract state + market data, runs OpenRouter AI analysis, writes report onchain.
 */

import {
  EVMClient,
  handler,
  Runner,
  getNetwork,
  type Runtime,
  type EVMLog,
  bytesToHex,
  hexToBase64,
  TxStatus,
} from "@chainlink/cre-sdk";
import { decodeEventLog, parseAbi, encodeAbiParameters, parseAbiParameters, keccak256, toBytes } from "viem";
import { z } from "zod";
import { type Config } from "./types";
import { fetchContractState } from "./evm";
import { buildMarketDataSnapshot } from "./chainlink-feeds";
import { analyzeRiskWithGemini } from "./gemini";
import { evaluateRisk } from "./risk-evaluator";

const evmTriggerConfigSchema = z.object({
  creConsumerAddress: z.string().min(1),
  chainSelectorName: z.string().min(1),
  gasLimit: z.string().optional(),
  openRouterModel: z.string().optional(),
  openRouterApiKey: z.string().optional(),
  monitoredContracts: z.array(z.any()).optional(),
}).passthrough();

type EVMTriggerConfig = z.infer<typeof evmTriggerConfigSchema>;

const RISK_ANALYSIS_REQUESTED_ABI = parseAbi([
  "event RiskAnalysisRequested(bytes32 indexed requestId, address indexed contractAddress, string chainSelectorName, address indexed requester)",
]);

function riskLevelToUint8(level: string): number {
  switch (level) {
    case "LOW": return 0;
    case "MEDIUM": return 1;
    case "HIGH": return 2;
    case "CRITICAL": return 3;
    default: return 0;
  }
}

/**
 * Truncate string for onchain summary. Shorter = less gas and smaller calldata.
 * 64 chars = 2 storage slots for string data; 100+ chars uses more.
 */
function truncateSummary(s: string, maxLen: number = 64): string {
  if (!s || s.length <= maxLen) return s;
  return s.slice(0, maxLen - 3) + "...";
}

async function onEVMLogTrigger(runtime: Runtime<EVMTriggerConfig>, log: EVMLog): Promise<string> {
  const config = runtime.config as EVMTriggerConfig;
  const topics = log.topics.map((t) => bytesToHex(t)) as [`0x${string}`, ...`0x${string}`[]];
  const data = bytesToHex(log.data);

  const decoded = decodeEventLog({
    abi: RISK_ANALYSIS_REQUESTED_ABI,
    data: data as `0x${string}`,
    topics,
  });

  if (decoded.eventName !== "RiskAnalysisRequested") {
    runtime.log(`Ignoring event: ${decoded.eventName}`);
    return "ignored";
  }

  const { requestId, contractAddress, chainSelectorName } = decoded.args;
  runtime.log(`Processing request ${bytesToHex(requestId)} for ${contractAddress} on ${chainSelectorName}`);

  // Monitored contract can be on mainnet (e.g. ethereum-mainnet); we read from that chain.
  // Result is written to the consumer on config.chainSelectorName (e.g. Sepolia) below.
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName,
    isTestnet: false,
  });
  if (!network) {
    runtime.log(`Unknown chain: ${chainSelectorName}`);
    return "unknown-chain";
  }

  const contract = {
    address: contractAddress as `0x${string}`,
    name: `Contract ${contractAddress.slice(0, 10)}...`,
    chainSelectorName,
    riskThresholds: {
      depegTolerance: 0.02,
      volatilityMax: 0.15,
      liquidityDropMax: 0.25,
      collateralRatioMin: 1.5,
    },
    alertChannels: ["onchain"] as const,
    priceFeeds: [{ pairName: "ETH/USD", feedAddress: "0x5f4eC3Dd9Bbd43714FE2740F5E3616155c5b8419", decimals: 8 }],
  };

  const tStart = Date.now();
  runtime.log(`[timing] start request ${bytesToHex(requestId)}`);

  const tBeforeStateMarket = Date.now();
  const [contractState, marketData] = await Promise.all([
    Promise.resolve().then(() => fetchContractState(runtime as Runtime<Config>, contract)),
    Promise.resolve().then(() => buildMarketDataSnapshot(runtime as Runtime<Config>, contract)),
  ]);
  runtime.log(`[timing] state+market (parallel) done in ${((Date.now() - tBeforeStateMarket) / 1000).toFixed(1)}s`);

  const tBeforeAI = Date.now();
  const aiAnalysis = await analyzeRiskWithGemini(
    runtime as Runtime<Config>,
    contract.name,
    contractAddress,
    chainSelectorName,
    marketData,
    contractState,
    contract.riskThresholds
  );
  runtime.log(`[timing] analyzeRiskWithGemini done in ${((Date.now() - tBeforeAI) / 1000).toFixed(1)}s`);

  const assessment = evaluateRisk(
    runtime as Runtime<Config>,
    contract,
    marketData,
    contractState,
    aiAnalysis
  );

  const riskLevelU8 = riskLevelToUint8(aiAnalysis.riskLevel);
  const riskScore = BigInt(Math.min(100, Math.max(0, assessment.overallRiskScore)));
  const summary = truncateSummary(aiAnalysis.reasoning || "No reasoning provided.");

  const reportData = encodeAbiParameters(
    parseAbiParameters("bytes32 requestId, address contractAddress, string chainSelectorName, uint8 riskLevel, uint256 riskScore, string summary"),
    [requestId, contractAddress, chainSelectorName, riskLevelU8, riskScore, summary]
  );

  const reportPayloadBytes = (typeof reportData === "string" && reportData.startsWith("0x") ? reportData.length - 2 : reportData.length) / 2;
  runtime.log(
    `[onchain report] summary=${summary.length} chars, chainSelectorName=${chainSelectorName.length} chars, payload=${reportPayloadBytes} bytes`
  );

  const tBeforeReport = Date.now();
  const reportResponse = runtime
    .report({
      encodedPayload: hexToBase64(reportData),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();
  runtime.log(`[timing] runtime.report done in ${((Date.now() - tBeforeReport) / 1000).toFixed(1)}s`);

  // Consumer contract is on config.chainSelectorName; write report there
  const writeNetwork = getNetwork({
    chainFamily: "evm",
    chainSelectorName: config.chainSelectorName,
    isTestnet: true,
  });
  if (!writeNetwork) {
    throw new Error(`Write chain not found: ${config.chainSelectorName}`);
  }
  const evmClient = new EVMClient(writeNetwork.chainSelector.selector);

  const tBeforeWrite = Date.now();
  const writeResult = evmClient
    .writeReport(runtime, {
      receiver: config.creConsumerAddress,
      report: reportResponse,
      gasConfig: { gasLimit: config.gasLimit || "500000" },
    })
    .result();
  runtime.log(`[timing] writeReport done in ${((Date.now() - tBeforeWrite) / 1000).toFixed(1)}s`);

  if (writeResult.txStatus === TxStatus.SUCCESS) {
    runtime.log(`Report submitted for request ${bytesToHex(requestId)} (total ${((Date.now() - tStart) / 1000).toFixed(1)}s)`);
    return bytesToHex(writeResult.txHash || new Uint8Array(32));
  }
  runtime.log(`Write failed: ${writeResult.txStatus}`);
  throw new Error(`Write report failed: ${writeResult.txStatus}`);
}

function initEVMTriggerWorkflow(config: EVMTriggerConfig) {
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: config.chainSelectorName,
    isTestnet: true,
  });
  if (!network) {
    throw new Error(`Network not found: ${config.chainSelectorName}`);
  }
  const evmClient = new EVMClient(network.chainSelector.selector);
  const eventSigHash = keccak256(toBytes("RiskAnalysisRequested(bytes32,address,string,address)"));

  return [
    handler(
      evmClient.logTrigger({
        addresses: [hexToBase64(config.creConsumerAddress)],
        topics: [{ values: [hexToBase64(eventSigHash)] }],
      }),
      onEVMLogTrigger
    ),
  ];
}

export async function main() {
  const runner = await Runner.newRunner<EVMTriggerConfig>({ configSchema: evmTriggerConfigSchema });
  await runner.run(initEVMTriggerWorkflow);
}
