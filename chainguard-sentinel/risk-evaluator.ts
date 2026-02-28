// risk-evaluator.ts
// Risk scoring and threshold evaluation logic.
// Combines on-chain data, market metrics, and AI analysis into actionable risk scores.

import type {
  Runtime,
} from "@chainlink/cre-sdk";
import type {
  Config,
  MonitoredContract,
  MarketDataSnapshot,
  ContractStateData,
  GeminiRiskResponse,
  RiskAssessment,
  RiskLevel,
  RiskThresholds,
} from "./types";

/*********************************
 * Main Risk Evaluation Function
 *********************************/

/**
 * Evaluates overall risk for a contract based on thresholds and AI analysis.
 * Combines multiple risk factors into a unified assessment.
 * 
 * @param runtime - CRE runtime instance
 * @param contract - Monitored contract configuration
 * @param marketData - Market data snapshot
 * @param contractState - On-chain contract state
 * @param aiAnalysis - Gemini AI risk analysis
 * @returns Complete risk assessment with threshold violations
 */
export function evaluateRisk(
  runtime: Runtime<Config>,
  contract: MonitoredContract,
  marketData: MarketDataSnapshot,
  contractState: ContractStateData,
  aiAnalysis: GeminiRiskResponse
): RiskAssessment {
  runtime.log(`Evaluating risk for ${contract.name}`);

  // Risk is determined only by real threshold violations, market data, and AI analysis.
  // No hardcoded overrides: volatility, depeg, liquidity, manipulation, and collateral
  // are assessed from actual feeds and on-chain state.

  // Check threshold violations
  const violations = checkThresholdViolations(
    contract.riskThresholds,
    marketData
  );

  // Calculate rule-based risk score (0-100)
  const ruleBasedScore = calculateRuleBasedRiskScore(
    violations,
    marketData
  );

  // Convert AI confidence to 0-100 score
  const aiRiskScore = (aiAnalysis.confidence / 10000) * 100;

  // Weight the scores (70% rule-based, 30% AI)
  const overallRiskScore = Math.round(
    ruleBasedScore * 0.7 + aiRiskScore * 0.3
  );

  // Determine if alert should be triggered
  const shouldAlert = determineShouldAlert(
    violations,
    aiAnalysis.riskLevel,
    overallRiskScore
  );

  runtime.log(
    `Risk Score: ${overallRiskScore}/100 | Violations: ${violations.length} | AI Risk: ${aiAnalysis.riskLevel} | Alert: ${shouldAlert}`
  );

  const assessment: RiskAssessment = {
    contractAddress: contract.address,
    contractName: contract.name,
    chainSelectorName: contract.chainSelectorName,
    timestamp: marketData.timestamp,
    marketData,
    aiAnalysis,
    thresholdViolations: violations,
    overallRiskScore,
    shouldAlert,
  };

  return assessment;
}

/*********************************
 * Threshold Violation Checking
 *********************************/

/**
 * Checks if any configured thresholds are violated.
 */
function checkThresholdViolations(
  thresholds: RiskThresholds,
  marketData: MarketDataSnapshot
): RiskAssessment["thresholdViolations"] {
  const violations: RiskAssessment["thresholdViolations"] = [];

  // Check depeg tolerance (for stablecoins)
  if (
    thresholds.depegTolerance !== undefined &&
    marketData.priceDeviationFromPeg !== undefined
  ) {
    if (marketData.priceDeviationFromPeg > thresholds.depegTolerance) {
      violations.push({
        type: "depegTolerance",
        currentValue: marketData.priceDeviationFromPeg,
        thresholdValue: thresholds.depegTolerance,
        severity: calculateViolationSeverity(
          marketData.priceDeviationFromPeg,
          thresholds.depegTolerance,
          2.0 // 2x threshold = CRITICAL
        ),
      });
    }
  }

  // Check volatility
  if (
    thresholds.volatilityMax !== undefined &&
    marketData.volatility24h !== undefined
  ) {
    if (marketData.volatility24h > thresholds.volatilityMax) {
      violations.push({
        type: "volatilityMax",
        currentValue: marketData.volatility24h,
        thresholdValue: thresholds.volatilityMax,
        severity: calculateViolationSeverity(
          marketData.volatility24h,
          thresholds.volatilityMax,
          2.0
        ),
      });
    }
  }

  // Check liquidity drop
  if (
    thresholds.liquidityDropMax !== undefined &&
    marketData.liquidityChange24h !== undefined
  ) {
    const liquidityDrop = Math.abs(Math.min(marketData.liquidityChange24h, 0));

    if (liquidityDrop > thresholds.liquidityDropMax) {
      violations.push({
        type: "liquidityDropMax",
        currentValue: liquidityDrop,
        thresholdValue: thresholds.liquidityDropMax,
        severity: calculateViolationSeverity(
          liquidityDrop,
          thresholds.liquidityDropMax,
          2.0
        ),
      });
    }
  }

  // Check collateral ratio (inverse - lower is worse)
  if (
    thresholds.collateralRatioMin !== undefined &&
    marketData.collateralRatio !== undefined
  ) {
    if (marketData.collateralRatio < thresholds.collateralRatioMin) {
      const deviation = thresholds.collateralRatioMin - marketData.collateralRatio;

      violations.push({
        type: "collateralRatioMin",
        currentValue: marketData.collateralRatio,
        thresholdValue: thresholds.collateralRatioMin,
        severity: calculateViolationSeverity(
          deviation,
          thresholds.collateralRatioMin * 0.1, // 10% below = CRITICAL
          2.0
        ),
      });
    }
  }

  // Check gas price spike
  if (
    thresholds.gasPriceMax !== undefined &&
    marketData.currentGasPrice !== undefined
  ) {
    if (marketData.currentGasPrice > thresholds.gasPriceMax) {
      violations.push({
        type: "gasPriceMax",
        currentValue: marketData.currentGasPrice,
        thresholdValue: thresholds.gasPriceMax,
        severity: calculateViolationSeverity(
          marketData.currentGasPrice,
          thresholds.gasPriceMax,
          3.0 // 3x normal = CRITICAL
        ),
      });
    }
  }

  return violations;
}

/*********************************
 * Risk Score Calculation
 *********************************/

/**
 * Calculates rule-based risk score from threshold violations.
 * Returns score from 0-100.
 */
function calculateRuleBasedRiskScore(
  violations: RiskAssessment["thresholdViolations"],
  marketData: MarketDataSnapshot
): number {
  if (violations.length === 0) {
    return 0; // No violations = no risk
  }

  let totalScore = 0;
  let weights = 0;

  for (const violation of violations) {
    let weight = 1;
    let severityMultiplier = 1;

    // Assign weights based on violation type
    switch (violation.type) {
      case "depegTolerance":
        weight = 10; // Depeg is very serious
        break;
      case "collateralRatioMin":
        weight = 9; // Under-collateralization is critical
        break;
      case "liquidityDropMax":
        weight = 7; // Liquidity issues are serious
        break;
      case "volatilityMax":
        weight = 6; // Volatility is concerning
        break;
      case "gasPriceMax":
        weight = 3; // Gas spikes are less critical
        break;
      default:
        weight = 5;
    }

    // Severity multiplier
    switch (violation.severity) {
      case "CRITICAL":
        severityMultiplier = 4;
        break;
      case "HIGH":
        severityMultiplier = 3;
        break;
      case "MEDIUM":
        severityMultiplier = 2;
        break;
      case "LOW":
        severityMultiplier = 1;
        break;
    }

    totalScore += weight * severityMultiplier;
    weights += weight;
  }

  // Normalize to 0-100
  const normalizedScore = Math.min(100, (totalScore / (weights * 4)) * 100);

  return Math.round(normalizedScore);
}

/**
 * Calculates violation severity based on how much threshold is exceeded.
 */
function calculateViolationSeverity(
  currentValue: number,
  thresholdValue: number,
  criticalMultiplier: number = 2.0
): RiskLevel {
  const ratio = currentValue / thresholdValue;

  if (ratio >= criticalMultiplier) {
    return "CRITICAL";
  } else if (ratio >= criticalMultiplier * 0.75) {
    return "HIGH";
  } else if (ratio >= criticalMultiplier * 0.5) {
    return "MEDIUM";
  } else {
    return "LOW";
  }
}

/*********************************
 * Alert Decision Logic
 *********************************/

/**
 * Determines if an alert should be triggered based on violations and AI analysis.
 */
function determineShouldAlert(
  violations: RiskAssessment["thresholdViolations"],
  aiRiskLevel: RiskLevel,
  overallRiskScore: number
): boolean {
  // Alert if there are any CRITICAL or HIGH violations
  const hasCriticalViolation = violations.some(
    v => v.severity === "CRITICAL" || v.severity === "HIGH"
  );

  if (hasCriticalViolation) {
    return true;
  }

  // Alert if AI detected HIGH or CRITICAL risk
  if (aiRiskLevel === "CRITICAL" || aiRiskLevel === "HIGH") {
    return true;
  }

  // Alert if overall risk score is above 60
  if (overallRiskScore >= 60) {
    return true;
  }

  // Alert if AI detected MEDIUM risk AND there are threshold violations
  if (aiRiskLevel === "MEDIUM" && violations.length > 0) {
    return true;
  }

  // Alert if risk score is above 40 AND AI detected at least MEDIUM risk
  if (overallRiskScore >= 40 && aiRiskLevel !== "LOW") {
    return true;
  }

  return false;
}

/*********************************
 * Risk Summary Generation
 *********************************/

/**
 * Generates human-readable summary of the risk assessment.
 */
export function generateRiskSummary(assessment: RiskAssessment): string {
  const parts: string[] = [];

  // Overall risk level
  if (assessment.overallRiskScore >= 80) {
    parts.push(`🔴 CRITICAL RISK DETECTED (Score: ${assessment.overallRiskScore}/100)`);
  } else if (assessment.overallRiskScore >= 60) {
    parts.push(`🟠 HIGH RISK DETECTED (Score: ${assessment.overallRiskScore}/100)`);
  } else if (assessment.overallRiskScore >= 40) {
    parts.push(`🟡 MEDIUM RISK DETECTED (Score: ${assessment.overallRiskScore}/100)`);
  } else if (assessment.overallRiskScore >= 20) {
    parts.push(`🟢 LOW RISK DETECTED (Score: ${assessment.overallRiskScore}/100)`);
  } else {
    parts.push(`✅ MINIMAL RISK (Score: ${assessment.overallRiskScore}/100)`);
  }

  // Violations
  if (assessment.thresholdViolations.length > 0) {
    parts.push(
      `\n${assessment.thresholdViolations.length} threshold violation(s) detected:`
    );

    for (const violation of assessment.thresholdViolations) {
      const pct = ((violation.currentValue / violation.thresholdValue - 1) * 100).toFixed(1);
      parts.push(
        `  • ${violation.type}: ${(violation.currentValue * 100).toFixed(2)}% (${pct}% over threshold) [${violation.severity}]`
      );
    }
  }

  // AI analysis
  parts.push(`\nAI Analysis: ${assessment.aiAnalysis.riskType} risk at ${assessment.aiAnalysis.riskLevel} level`);

  return parts.join("\n");
}

/**
 * Generates detailed reasoning combining rule-based and AI insights.
 */
export function generateDetailedReasoning(assessment: RiskAssessment): string {
  const parts: string[] = [];

  // Start with AI reasoning
  parts.push(assessment.aiAnalysis.reasoning);

  // Add threshold violation details
  if (assessment.thresholdViolations.length > 0) {
    parts.push("\n\nThreshold Violations:");

    for (const violation of assessment.thresholdViolations) {
      const pct = ((violation.currentValue / violation.thresholdValue - 1) * 100).toFixed(1);
      parts.push(
        `- ${violation.type}: Current ${(violation.currentValue * 100).toFixed(2)}% exceeds threshold of ${(violation.thresholdValue * 100).toFixed(2)}% by ${pct}% (${violation.severity} severity)`
      );
    }
  }

  // Add market context
  if (assessment.marketData.currentPrice !== undefined) {
    parts.push(`\n\nMarket Context:`);
    parts.push(`- Current Price: $${assessment.marketData.currentPrice.toFixed(4)}`);

    if (assessment.marketData.priceChange24h !== undefined) {
      parts.push(`- 24h Change: ${(assessment.marketData.priceChange24h * 100).toFixed(2)}%`);
    }

    if (assessment.marketData.volatility24h !== undefined) {
      parts.push(`- 24h Volatility: ${(assessment.marketData.volatility24h * 100).toFixed(2)}%`);
    }
  }

  return parts.join("\n");
}
