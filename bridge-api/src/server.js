import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";

dotenv.config();
const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const PORT = Number(process.env.PORT || 4100);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
const CRE_WORKFLOW = process.env.CRE_WORKFLOW || "chainguard-sentinel";
const CRE_TARGET = process.env.CRE_TARGET || "local-simulation";
const CRE_TIMEOUT_MS = Number(process.env.CRE_TIMEOUT_MS || 120000);

const projectRoot = path.resolve(__dirname, "../..");
const defaultConfigPath = path.resolve(projectRoot, "chainguard-sentinel/config.json");
const configPath = process.env.CHAIN_GUARD_CONFIG_PATH
  ? path.resolve(__dirname, process.env.CHAIN_GUARD_CONFIG_PATH)
  : defaultConfigPath;

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json({ limit: "1mb" }));

const inMemory = {
  contracts: [],
  alerts: [],
  lastScan: null,
  lastSimulation: null,
};

const addContractSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chainSelectorName: z.string().min(3),
  name: z.string().optional(),
});

const scanSchema = z.object({
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  chainSelectorName: z.string().optional(),
  contractName: z.string().optional(),
});

function readWorkflowConfig() {
  try {
    if (!fs.existsSync(configPath)) {
      return { monitoredContracts: [], geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp" };
    }
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return { monitoredContracts: [], geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp" };
  }
}

function normalizeChain(chainSelectorName) {
  if (chainSelectorName.includes("polygon")) return "polygon";
  if (chainSelectorName.includes("arbitrum")) return "arbitrum";
  if (chainSelectorName.includes("optimism")) return "optimism";
  return "ethereum";
}

function scoreFromAddress(address) {
  const n = Number.parseInt(address.slice(2, 8), 16);
  return Number.isFinite(n) ? n : 0;
}

function mapRisk(score) {
  const bucket = score % 100;
  if (bucket >= 80) return "high";
  if (bucket >= 45) return "medium";
  return "low";
}

function toUiContracts(contracts) {
  return contracts.map((contract, idx) => {
    const base = scoreFromAddress(contract.address);
    const riskLevel = mapRisk(base);
    const volatility = `${((base % 330) / 10).toFixed(1)}%`;
    const tvl = `$${((base % 900) / 10 + 1).toFixed(1)}M`;

    return {
      id: `${idx + 1}`,
      name: contract.name || `Contract ${idx + 1}`,
      address: contract.address,
      tvl,
      riskLevel,
      volatility,
      chain: normalizeChain(contract.chainSelectorName || "ethereum-testnet-sepolia"),
      chainSelectorName: contract.chainSelectorName,
      status: "monitored",
      lastUpdate: "just now",
    };
  });
}

function buildOverview() {
  const contracts = inMemory.contracts.length > 0 ? inMemory.contracts : toUiContracts(readWorkflowConfig().monitoredContracts || []);
  const activeAlerts = inMemory.alerts.filter((a) => a.status === "active").length;
  const riskScore = inMemory.lastScan?.riskScore ?? 72;

  return {
    kpis: {
      monitoredContracts: contracts.length,
      activeAlerts,
      totalValueLocked: contracts.reduce((acc, c) => {
        const n = Number(c.tvl.replace(/[^0-9.]/g, ""));
        return acc + (Number.isFinite(n) ? n : 0);
      }, 0),
      riskScore,
    },
    contracts,
    alerts: inMemory.alerts,
    system: {
      oracle: "online",
      riskEngine: "active",
      alertService: "running",
      lastSync: inMemory.lastScan?.timestamp || new Date().toISOString(),
      lastSimulation: inMemory.lastSimulation,
    },
  };
}

async function runGeminiRiskAnalysis(payload) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";

  if (!apiKey) {
    const pseudo = (scoreFromAddress(payload.contractAddress || "0x0000000000000000000000000000000000000000") % 100) + 1;
    const riskLevel = pseudo > 80 ? "HIGH" : pseudo > 45 ? "MEDIUM" : "LOW";
    return {
      riskLevel,
      riskType: riskLevel === "HIGH" ? "VOLATILITY" : "CUSTOM",
      confidence: 6200,
      reasoning: "Fallback assessment (GEMINI_API_KEY not configured).",
      suggestedActions: ["Configure GEMINI_API_KEY in bridge-api/.env", "Run CRE scan"],
      affectedMetrics: ["volatility24h"],
      estimatedImpact: "Moderate monitoring risk",
      source: "fallback",
    };
  }

  const prompt = {
    system_instruction: {
      parts: [{ text: "You are a DeFi risk engine. Return strict minified JSON with keys: riskLevel,riskType,confidence,reasoning,suggestedActions,affectedMetrics,estimatedImpact." }],
    },
    contents: [
      {
        parts: [
          {
            text: `Analyze contract risk now. contractAddress=${payload.contractAddress ?? "unknown"}, chain=${payload.chainSelectorName ?? "ethereum-testnet-sepolia"}, name=${payload.contractName ?? "Unknown"}.`
          }
        ]
      }
    ]
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prompt),
  });

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {
      riskLevel: "MEDIUM",
      riskType: "CUSTOM",
      confidence: 3000,
      reasoning: `Gemini returned non-JSON: ${text.slice(0, 120)}`,
      suggestedActions: ["Retry scan", "Tighten prompt constraints"],
      affectedMetrics: [],
      estimatedImpact: "Unknown",
    };
  }

  return { ...parsed, source: "gemini" };
}

function toAlert(scan) {
  return {
    id: `${Date.now()}`,
    timestamp: "just now",
    contract: scan.contractName || "Unknown Contract",
    type: scan.riskType || "CUSTOM",
    severity: String(scan.riskLevel || "LOW").toLowerCase(),
    status: ["HIGH", "CRITICAL"].includes(scan.riskLevel) ? "active" : "resolved",
  };
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "chainguard-bridge-api", time: new Date().toISOString() });
});

app.get("/api/system-status", (_req, res) => {
  res.json(buildOverview().system);
});

app.get("/api/contracts", (_req, res) => {
  if (inMemory.contracts.length === 0) {
    inMemory.contracts = toUiContracts(readWorkflowConfig().monitoredContracts || []);
  }
  res.json({ data: inMemory.contracts });
});

app.post("/api/contracts", (req, res) => {
  const parsed = addContractSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid contract payload", details: parsed.error.flatten() });
  }

  const payload = parsed.data;
  const newContract = toUiContracts([
    {
      address: payload.address,
      chainSelectorName: payload.chainSelectorName,
      name: payload.name || "New Contract",
    },
  ])[0];

  const exists = inMemory.contracts.some((c) => c.address.toLowerCase() === newContract.address.toLowerCase() && c.chainSelectorName === newContract.chainSelectorName);
  if (!exists) inMemory.contracts.unshift({ ...newContract, id: `${Date.now()}` });

  return res.status(201).json({ data: newContract });
});

app.get("/api/alerts", (_req, res) => {
  res.json({ data: inMemory.alerts.slice(0, 20) });
});

app.get("/api/overview", (_req, res) => {
  const overview = buildOverview();
  res.json({ data: overview });
});

app.post("/api/scan", async (req, res) => {
  const parsed = scanSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid scan request", details: parsed.error.flatten() });
  }

  const payload = parsed.data;
  const configContracts = readWorkflowConfig().monitoredContracts || [];
  const fallback = configContracts[0] || {};

  const scanInput = {
    contractAddress: payload.contractAddress || fallback.address,
    chainSelectorName: payload.chainSelectorName || fallback.chainSelectorName || "ethereum-testnet-sepolia",
    contractName: payload.contractName || fallback.name || "Unknown Contract",
  };

  const analysis = await runGeminiRiskAnalysis(scanInput);
  const riskScore = Math.min(100, Math.max(0, Math.round((analysis.confidence || 0) / 100)));

  const result = {
    ...scanInput,
    ...analysis,
    riskScore,
    timestamp: new Date().toISOString(),
  };

  inMemory.lastScan = result;
  const alert = toAlert(result);
  inMemory.alerts.unshift(alert);
  inMemory.alerts = inMemory.alerts.slice(0, 100);

  res.json({ data: result });
});

app.post("/api/cre/simulate", async (_req, res) => {
  const command = `bunx cre workflow simulate ${CRE_WORKFLOW} -T ${CRE_TARGET} --non-interactive --trigger-index 0`;
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: projectRoot,
      timeout: CRE_TIMEOUT_MS,
      maxBuffer: 2 * 1024 * 1024,
    });
    const output = `${stdout || ""}\n${stderr || ""}`;
    const success = /Workflow Simulation Result:/i.test(output) && !/Error in simulation\./i.test(output);

    const payload = {
      success,
      command,
      output,
      timestamp: new Date().toISOString(),
    };

    inMemory.lastSimulation = payload;
    res.json({ data: payload });
  } catch (error) {
    const payload = {
      success: false,
      command,
      output: error?.stdout || error?.stderr || String(error),
      timestamp: new Date().toISOString(),
    };
    inMemory.lastSimulation = payload;
    res.status(500).json({ data: payload });
  }
});

app.listen(PORT, () => {
  console.log(`[bridge-api] listening on http://localhost:${PORT}`);
  console.log(`[bridge-api] config path: ${configPath}`);
});
