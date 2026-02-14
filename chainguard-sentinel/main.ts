// main.ts
// Main workflow entry point for ChainGuard Sentinel.
// Orchestrates periodic risk monitoring using CRE Cron triggers.

import {
  cre,
  type Runtime,
  Runner,
  type CronPayload,
} from "@chainlink/cre-sdk";
import { v4 as uuidv4 } from "uuid";

import { configSchema, type Config, type AlertPayload, type WorkflowContext } from "./types";
import { fetchContractState } from "./evm";
import { buildMarketDataSnapshot } from "./chainlink-feeds";
import { analyzeRiskWithGemini } from "./gemini";
import { evaluateRisk, generateRiskSummary, generateDetailedReasoning } from "./risk-evaluator";
import { sendAlerts } from "./notifications";
import { 
  getAllMonitoredContracts,
  initializeFromConfig,
} from "./api-handler";

/*********************************
 * Cron Trigger Handler
 *********************************/

/**
 * Main monitoring handler triggered by Cron schedule.
 * Processes all configured contracts and triggers alerts as needed.
 * 
 * @param runtime - CRE runtime instance with configuration
 * @param payload - Cron payload (contains trigger timestamp)
 * @returns Execution summary
 */
const onCronTrigger = (runtime: Runtime<Config>, payload: CronPayload): string => {
  const executionId = uuidv4();
  const startTime = new Date().toISOString();

  runtime.log("=".repeat(80));
  runtime.log(`ChainGuard Sentinel Monitoring Cycle Started`);
  runtime.log(`Execution ID: ${executionId}`);
  runtime.log(`Timestamp: ${startTime}`);
  runtime.log("=".repeat(80));

  const context: WorkflowContext = {
    executionId,
    startTime,
    contractsProcessed: 0,
    alertsTriggered: 0,
    errors: [],
  };

  try {
    const config = runtime.config;
    
    // Get dynamically managed contracts from API storage
    const contracts = getAllMonitoredContracts();
    
    // Fallback to config file if no dynamic contracts
    const monitoredContracts = contracts.length > 0 ? contracts : config.monitoredContracts;

    runtime.log(`Monitoring ${monitoredContracts.length} contract(s)`);

    // Process each monitored contract
    for (const contract of monitoredContracts.slice(0, config.maxContractsPerRun ?? 10)) {
      try {
        runtime.log("\n" + "-".repeat(80));
        runtime.log(`Processing: ${contract.name} (${contract.address})`);
        runtime.log("-".repeat(80));

        // Step 1: Fetch on-chain contract state
        runtime.log("📊 Step 1/5: Fetching on-chain state...");
        const contractState = fetchContractState(runtime, contract);

        // Step 2: Build market data snapshot from Chainlink feeds
        runtime.log("📈 Step 2/5: Fetching market data from Chainlink feeds...");
        const marketData = buildMarketDataSnapshot(runtime, contract);

        // Step 3: Analyze risk with Gemini AI
        runtime.log("🤖 Step 3/5: Analyzing risk with Gemini AI...");
        const aiAnalysis = analyzeRiskWithGemini(
          runtime,
          contract.name,
          contract.address,
          contract.chainSelectorName,
          marketData,
          contractState,
          contract.riskThresholds
        );

        // Step 4: Evaluate overall risk and check thresholds
        runtime.log("⚖️  Step 4/5: Evaluating risk thresholds...");
        const riskAssessment = evaluateRisk(
          runtime,
          contract,
          marketData,
          contractState,
          aiAnalysis
        );

        // Log risk summary
        const summary = generateRiskSummary(riskAssessment);
        runtime.log(`\n${summary}\n`);

        // Step 5: Send alerts if needed
        if (riskAssessment.shouldAlert) {
          runtime.log("🚨 Step 5/5: Risk threshold exceeded - Sending alerts...");
          
          const alert: AlertPayload = buildAlertPayload(
            riskAssessment,
            executionId
          );

          const deliveryResults = sendAlerts(
            runtime,
            alert,
            contract.alertChannels
          );

          const successCount = deliveryResults.filter(r => r.success).length;
          runtime.log(
            `Alerts sent: ${successCount}/${contract.alertChannels.length} successful`
          );

          context.alertsTriggered++;

        } else {
          runtime.log("✅ Step 5/5: No alerts needed - Risk within acceptable limits");
        }

        context.contractsProcessed++;

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        runtime.log(`❌ Error processing ${contract.name}: ${msg}`);
        context.errors.push(`${contract.name}: ${msg}`);
      }
    }

    // Execution summary
    runtime.log("\n" + "=".repeat(80));
    runtime.log("Monitoring Cycle Complete");
    runtime.log("=".repeat(80));
    runtime.log(`Contracts Processed: ${context.contractsProcessed}`);
    runtime.log(`Alerts Triggered: ${context.alertsTriggered}`);
    runtime.log(`Errors: ${context.errors.length}`);
    
    if (context.errors.length > 0) {
      runtime.log("\nErrors encountered:");
      context.errors.forEach(err => runtime.log(`  - ${err}`));
    }

    runtime.log(`Duration: ${calculateDuration(startTime)}`);
    runtime.log("=".repeat(80));

    return `Monitoring complete: ${context.contractsProcessed} contracts, ${context.alertsTriggered} alerts`;

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    runtime.log(`Fatal error in monitoring cycle: ${msg}`);
    throw err;
  }
};

/*********************************
 * Helper Functions
 *********************************/

/**
 * Builds alert payload from risk assessment.
 */
function buildAlertPayload(
  assessment: any,
  executionId: string
): AlertPayload {
  // Determine overall risk level from score
  let riskLevel = assessment.aiAnalysis.riskLevel;
  
  if (assessment.overallRiskScore >= 80) {
    riskLevel = "CRITICAL";
  } else if (assessment.overallRiskScore >= 60) {
    riskLevel = "HIGH";
  } else if (assessment.overallRiskScore >= 40) {
    riskLevel = "MEDIUM";
  } else {
    riskLevel = "LOW";
  }

  const summary = generateRiskSummary(assessment);
  const reasoning = generateDetailedReasoning(assessment);

  // Extract triggered metrics
  const triggeredMetrics = assessment.thresholdViolations.map((v: any) => ({
    name: v.type,
    currentValue: v.currentValue,
    threshold: v.thresholdValue,
    unit: v.type.includes("Price") || v.type.includes("Ratio") ? "%" : undefined,
  }));

  // Build explorer link
  const explorerBaseUrls: Record<string, string> = {
    "ethereum-testnet-sepolia": "https://sepolia.etherscan.io/address",
    "ethereum-mainnet": "https://etherscan.io/address",
    "polygon-testnet-amoy": "https://amoy.polygonscan.com/address",
    "polygon-mainnet": "https://polygonscan.com/address",
  };

  const explorerLink = explorerBaseUrls[assessment.chainSelectorName]
    ? `${explorerBaseUrls[assessment.chainSelectorName]}/${assessment.contractAddress}`
    : undefined;

  const alert: AlertPayload = {
    alertId: `${executionId}-${assessment.contractAddress.substring(0, 8)}`,
    timestamp: assessment.timestamp,
    contractAddress: assessment.contractAddress,
    contractName: assessment.contractName,
    chainSelectorName: assessment.chainSelectorName,
    riskLevel,
    riskType: assessment.aiAnalysis.riskType,
    riskScore: assessment.overallRiskScore,
    summary,
    reasoning,
    triggeredMetrics,
    suggestedActions: assessment.aiAnalysis.suggestedActions,
    rawMarketData: assessment.marketData,
    explorerLink,
  };

  return alert;
}

/**
 * Calculates duration since start time.
 */
function calculateDuration(startTime: string): string {
  const start = new Date(startTime).getTime();
  const end = Date.now();
  const durationMs = end - start;
  
  const seconds = Math.floor(durationMs / 1000);
  const ms = durationMs % 1000;
  
  return `${seconds}.${ms.toString().padStart(3, "0")}s`;
}

/*********************************
 * HTTP API Handler
 *********************************/

/*********************************
 * Workflow Initialization
 *********************************/

/**
 * Initializes the CRE workflow with Cron trigger.
 * Configures monitoring schedule and registers handler.
 * 
 * @param config - Validated workflow configuration
 * @returns CRE handler
 */
const initWorkflow = (config: Config) => {
  console.log("Initializing ChainGuard Sentinel Workflow");
  
  // Initialize contract database from config file
  initializeFromConfig(config);
  
  console.log(`Config contracts: ${config.monitoredContracts.length}`);
  console.log(`Cron schedule: ${config.cronSchedule ?? "*/5 * * * *"}`);
  console.log(`Gemini model: ${config.geminiModel ?? "gemini-2.0-flash-exp"}`);

  // Create Cron capability for periodic monitoring
  const cronCapability = new cre.capabilities.CronCapability();

  // Register Cron handler for periodic monitoring
  return [
    cre.handler(
      cronCapability.trigger({
        schedule: config.cronSchedule ?? "*/5 * * * *",
      }),
      onCronTrigger
    ),
  ];
};

/*********************************
 * Entry Point
 *********************************/

/**
 * Main entry point for the CRE workflow.
 * Initializes the CRE runner and starts the workflow.
 */
export async function main() {
  try {
    console.log("=".repeat(80));
    console.log("ChainGuard Sentinel - AI-Powered Smart Contract Risk Monitor");
    console.log("=".repeat(80));

    const runner = await Runner.newRunner<Config>({ configSchema });
    
    console.log("Runner initialized successfully");
    console.log("Starting workflow...");
    
    await runner.run(initWorkflow);

    console.log("Workflow started successfully");

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Fatal error starting workflow:", msg);
    throw err;
  }
}

// Start the workflow
main();
