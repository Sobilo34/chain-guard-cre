// main.ts
// Main workflow entry point for ChainGuard Sentinel.
// Orchestrates periodic risk monitoring using CRE Cron triggers.

import {
  cre,
  type Runtime,
  type CronPayload,
} from "@chainlink/cre-sdk";

import { configSchema, type Config, type AlertPayload } from "./types";
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
 */
const createOnCronTrigger = (config: Config) => {
  let initialized = false;

  return (runtime: Runtime<Config>, _payload: CronPayload): string => {
    const executionId = `run-${runtime.now()}`;

    runtime.log(`Starting ChainGuard Sentinel run ${executionId}`);

    // Lazy init contract cache from config on first trigger
    if (!initialized) {
      initializeFromConfig(config);
      initialized = true;
      runtime.log(`Loaded ${config.monitoredContracts.length} contract(s) from config`);
    }

    const contracts = getAllMonitoredContracts();

    if (contracts.length === 0) {
      runtime.log("No monitored contracts configured. Skipping run.");
      return "no-contracts";
    }

    const maxContracts = config.maxContractsPerRun ?? contracts.length;
    const contractsToProcess = contracts.slice(0, maxContracts);

    let alertCount = 0;

    for (const contract of contractsToProcess) {
      runtime.log(`Processing ${contract.name} (${contract.address}) on ${contract.chainSelectorName}`);

      try {
        const contractState = fetchContractState(runtime, contract);
        const marketData = buildMarketDataSnapshot(runtime, contract);

        const aiAnalysis = analyzeRiskWithGemini(
          runtime,
          contract.name,
          contract.address,
          contract.chainSelectorName,
          marketData,
          contractState,
          contract.riskThresholds
        );

        const assessment = evaluateRisk(
          runtime,
          contract,
          marketData,
          contractState,
          aiAnalysis
        );

        if (assessment.shouldAlert) {
          const alert = buildAlertPayload(runtime, assessment, executionId);
          const deliveryResults = sendAlerts(runtime, alert, contract.alertChannels);
          const successCount = deliveryResults.filter((r: any) => r.success).length;

          alertCount += 1;
          runtime.log(`Alert dispatched (${successCount}/${contract.alertChannels.length} channels succeeded)`);
        } else {
          runtime.log(`No alert triggered for ${contract.name}`);
        }

      } catch (err) {
        runtime.log(`Error processing ${contract.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return `Processed ${contractsToProcess.length} contracts, sent ${alertCount} alerts.`;
  };
};

/*********************************
 * Helper Functions
 *********************************/

/**
 * Builds alert payload from risk assessment.
 */
function buildAlertPayload(
  runtime: Runtime<Config>,
  assessment: any,
  executionId: string
): AlertPayload {
  let riskLevel = assessment.aiAnalysis.riskLevel;
  
  if (assessment.overallRiskScore >= 80) riskLevel = "CRITICAL";
  else if (assessment.overallRiskScore >= 60) riskLevel = "HIGH";
  else if (assessment.overallRiskScore >= 40) riskLevel = "MEDIUM";
  else riskLevel = "LOW";

  const summary = generateRiskSummary(assessment);
  const reasoning = generateDetailedReasoning(assessment);

  const alert: AlertPayload = {
    alertId: `${executionId}-${assessment.contractAddress.substring(0, 8)}`,
    timestamp: new Date(runtime.now()).toISOString(),
    contractAddress: assessment.contractAddress,
    contractName: assessment.contractName,
    chainSelectorName: assessment.chainSelectorName,
    riskLevel,
    riskType: assessment.aiAnalysis.riskType,
    riskScore: assessment.overallRiskScore,
    summary,
    reasoning,
    triggeredMetrics: assessment.thresholdViolations.map((v: any) => ({
      name: v.type,
      currentValue: v.currentValue,
      threshold: v.thresholdValue,
    })),
    suggestedActions: assessment.aiAnalysis.suggestedActions,
    rawMarketData: assessment.marketData,
  };

  return alert;
}

/*********************************
 * Entry Point
 *********************************/

/**
 * Main entry point for CRE workflow.
 * Handles both discovery (empty config) and runtime (full config).
 */
export function main() {
  return (config: Config) => {
    // 1. Validation (Handle discovery where config might be incomplete)
    let validatedConfig: Config;
    try {
      validatedConfig = configSchema.parse(config);
    } catch (e: any) {
      // In discovery mode, return a dummy trigger to satisfy CLI requirements
      const dummyCapability = new cre.capabilities.CronCapability();
      return [
        cre.handler(
          dummyCapability.trigger({ schedule: "*/5 * * * *" }),
          (runtime) => {
             runtime.log("Discovery handler execution");
             return "discovery";
          }
        )
      ];
    }

    // 2. Production path
    const cronCapability = new cre.capabilities.CronCapability();
    const onCronTrigger = createOnCronTrigger(validatedConfig);

    return [
      cre.handler(
        cronCapability.trigger({
          schedule: validatedConfig.cronSchedule ?? "*/5 * * * *",
        }),
        onCronTrigger
      ),
    ];
  };
}




