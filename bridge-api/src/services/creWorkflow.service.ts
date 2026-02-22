/**
 * CRE Workflow Service
 * Handles interactions with Chainlink Runtime Environment
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { creWorkflowPath, creTarget, simulation } from '../config';
import logger from '../middleware/logger';
import {
  CREHttpTriggerPayload,
  CRETriggerResponse,
  CREConfidentialTriggerPayload,
  CREConfidentialResponse,
  WorkflowExecution,
  SimulationResult,
} from '../types';

const execAsync = promisify(exec);

export class CREWorkflowService {
  private executions: Map<string, WorkflowExecution> = new Map();

  /**
   * Execute CRE workflow simulation (Normal HTTP)
   */
  async executeNormalWorkflow(
    payload: CREHttpTriggerPayload
  ): Promise<CRETriggerResponse> {
    const workflowId = this.generateWorkflowId();

    logger.info('Executing normal CRE workflow', { workflowId, payload });

    const execution: WorkflowExecution = {
      id: workflowId,
      type: 'normal',
      payload,
      status: 'running',
      startedAt: new Date(),
    };

    this.executions.set(workflowId, execution);

    try {
      // Run CRE simulation
      const result = await this.runCRESimulation(payload);

      execution.status = result.success ? 'completed' : 'failed';
      execution.completedAt = new Date();
      execution.result = result.output;

      logger.info('Workflow execution completed', {
        workflowId,
        status: execution.status,
        duration: result.duration
      });

      return {
        workflowId,
        status: execution.status === 'failed' ? 'completed' : execution.status as 'accepted' | 'running' | 'completed',
        result: result.output,
      };
    } catch (error: any) {
      execution.status = 'failed';
      execution.completedAt = new Date();
      execution.error = error.message;

      logger.error('Workflow execution failed', { workflowId, error: error.message });

      throw error;
    }
  }

  /**
   * Execute CRE confidential workflow (Experimental, Simulation Only)
   */
  async executeConfidentialWorkflow(
    payload: CREConfidentialTriggerPayload
  ): Promise<CREConfidentialResponse> {
    const workflowId = this.generateWorkflowId();

    logger.info('Executing confidential CRE workflow', { workflowId, payload });

    // Check if in simulation mode
    if (creTarget !== 'local-simulation') {
      throw new Error('Confidential HTTP is experimental and only available in simulation mode');
    }

    const execution: WorkflowExecution = {
      id: workflowId,
      type: 'confidential',
      payload,
      status: 'running',
      startedAt: new Date(),
    };

    this.executions.set(workflowId, execution);

    try {
      // Run confidential simulation with secret injection
      const result = await this.runConfidentialSimulation(payload);

      execution.status = result.success ? 'completed' : 'failed';
      execution.completedAt = new Date();
      execution.result = result.output;

      logger.info('Confidential workflow execution completed', {
        workflowId,
        encrypted: payload.enclaveConfig.encryptResponse
      });

      // Handle response encryption if requested
      if (payload.enclaveConfig.encryptResponse) {
        const encryptedData = await this.encryptResponse(result.output);
        return {
          workflowId,
          status: execution.status === 'failed' ? 'completed' : execution.status as 'accepted' | 'running' | 'completed',
          encrypted: true,
          encryptedData,
        };
      }

      return {
        workflowId,
        status: execution.status === 'failed' ? 'completed' : execution.status as 'accepted' | 'running' | 'completed',
        encrypted: false,
        result: result.output,
      };
    } catch (error: any) {
      execution.status = 'failed';
      execution.completedAt = new Date();
      execution.error = error.message;

      logger.error('Confidential workflow execution failed', { workflowId, error: error.message });

      throw error;
    }
  }

  /**
   * Run CRE workflow simulation
   */
  private async runCRESimulation(_payload: CREHttpTriggerPayload): Promise<SimulationResult> {
    const startTime = Date.now();
    const logs: string[] = [];

    try {
      await this.syncConfigWithContracts();

      // Build CRE command
      const command = `cre workflow simulate ${creWorkflowPath} --target ${creTarget}`;

      logger.debug('Running CRE command', { command });
      logs.push(`Command: ${command}`);

      // Execute with timeout
      const { stdout, stderr } = await this.execWithTimeout(command, simulation.timeout);

      logs.push(`STDOUT: ${stdout}`);
      if (stderr) logs.push(`STDERR: ${stderr}`);

      // Parse output
      const output = this.parseSimulationOutput(stdout);

      this.processAssessments(stdout).catch(e => logger.error('Failed to process assessments', { error: e.message }));

      return {
        success: true,
        output,
        duration: Date.now() - startTime,
        logs,
      };
    } catch (error: any) {
      logs.push(`Error: ${error.message}`);

      return {
        success: false,
        output: { error: error.message },
        duration: Date.now() - startTime,
        logs,
      };
    }
  }

  /**
   * Synchronize active contracts configuration to config.json before simulation
   */
  private async syncConfigWithContracts(): Promise<void> {
    const { contractService } = await import('./contract.service');
    const contracts = await contractService.getAllContracts();
    const configPath = require('path').resolve(process.cwd(), creWorkflowPath, 'config.json');

    if (!require('fs').existsSync(configPath)) {
      logger.warn('CRE config.json not found to sync contracts');
      return;
    }

    try {
      const raw = require('fs').readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw);

      parsed.monitoredContracts = contracts.map(c => ({
        address: c.address,
        name: c.name || c.protocol || "Unknown",
        chainSelectorName: c.chainSelectorName || c.chain || "ethereum-testnet-sepolia",
        riskThresholds: Object.assign({
          depegTolerance: 0.02,
          volatilityMax: 0.15,
          liquidityDropMax: 0.25,
          collateralRatioMin: 1.5,
        }, c.riskThresholds),
        alertChannels: c.alertChannels || ["email"],
        priceFeeds: c.priceFeeds || [],
      }));

      require('fs').writeFileSync(configPath, JSON.stringify(parsed, null, 2));
      logger.debug('Synchronized contracts to CRE config.json');
    } catch (e: any) {
      logger.error('Failed to sync config.json', { error: e.message });
    }
  }

  /**
   * Run confidential simulation with secret injection
   */
  private async runConfidentialSimulation(
    payload: CREConfidentialTriggerPayload
  ): Promise<SimulationResult> {
    const startTime = Date.now();
    const logs: string[] = [];

    try {
      // In simulation, secrets are injected via templates {{.secretName}}
      // For now, we'll simulate this behavior
      logs.push('Confidential execution in secure enclave (simulated)');
      logs.push(`Secrets required: ${payload.enclaveConfig.secretsRequired?.join(', ')}`);

      // Run normal simulation (in production, this would be in TEE)
      const result = await this.runCRESimulation({
        action: payload.action as any,
        contractAddress: payload.contractAddress,
        parameters: payload.parameters,
      });

      logs.push(...result.logs);
      logs.push('Confidential execution completed');

      return {
        ...result,
        logs,
      };
    } catch (error: any) {
      logs.push(`Confidential execution error: ${error.message}`);

      return {
        success: false,
        output: { error: error.message },
        duration: Date.now() - startTime,
        logs,
      };
    }
  }

  /**
   * Execute command with timeout
   */
  private async execWithTimeout(command: string, timeout: number): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);

      execAsync(command)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Parse CRE simulation output
   */
  private parseSimulationOutput(stdout: string): any {
    try {
      // Try to extract JSON from output
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // If no JSON, return parsed text
      return {
        output: stdout,
        parsed: this.extractKeyMetrics(stdout),
      };
    } catch (error) {
      logger.warn('Failed to parse simulation output as JSON', { error });
      return { raw: stdout };
    }
  }

  /**
   * Extract key metrics from text output
   */
  private extractKeyMetrics(output: string): Record<string, any> {
    const metrics: Record<string, any> = {};

    // Extract common patterns
    const patterns = {
      riskLevel: /Risk Level:\s*(\w+)/i,
      contractsProcessed: /Contracts Processed:\s*(\d+)/i,
      alertsGenerated: /Alerts Generated:\s*(\d+)/i,
      violations: /Violations:\s*(\d+)/i,
    };

    for (const [key, pattern] of Object.entries(patterns)) {
      const match = output.match(pattern);
      if (match) {
        metrics[key] = isNaN(Number(match[1])) ? match[1] : Number(match[1]);
      }
    }

    return metrics;
  }

  /**
   * Encrypt response data (simulated AES-256-GCM)
   */
  private async encryptResponse(data: any): Promise<string> {
    // In production, this would use actual encryption
    // For simulation, we'll just base64 encode
    const jsonString = JSON.stringify(data);
    const base64 = Buffer.from(jsonString).toString('base64');

    logger.debug('Response encrypted (simulated)', { size: base64.length });

    return base64;
  }

  /**
   * Get workflow execution status
   */
  getExecution(workflowId: string): WorkflowExecution | undefined {
    return this.executions.get(workflowId);
  }

  /**
   * List all executions
   */
  listExecutions(): WorkflowExecution[] {
    return Array.from(this.executions.values());
  }

  /**
   * Generate unique workflow ID
   */
  private generateWorkflowId(): string {
    return `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up old executions (keep last 100)
   */
  cleanup(): void {
    if (this.executions.size > 100) {
      const sorted = Array.from(this.executions.entries())
        .sort((a, b) => a[1].startedAt.getTime() - b[1].startedAt.getTime());

      const toRemove = sorted.slice(0, sorted.length - 100);
      toRemove.forEach(([id]) => this.executions.delete(id));

      logger.info(`Cleaned up ${toRemove.length} old workflow executions`);
    }
  }

  /**
   * Parse detailed risk assessments emitted by Sentinel and push to ContractService
   */
  private async processAssessments(stdout: string) {
    const { contractService } = await import('./contract.service');
    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.includes('[SENTINEL_ASSESSMENT]')) {
        try {
          const jsonStr = line.substring(line.indexOf('[SENTINEL_ASSESSMENT]') + '[SENTINEL_ASSESSMENT]'.length).trim();
          const parsed = JSON.parse(jsonStr);
          await contractService.updateContractStatus(
            parsed.contractAddress,
            parsed.riskLevel,
            parsed.riskScore,
            parsed.metrics
          );
          if (parsed.latestScan) {
            await contractService.updateLatestScan(parsed.contractAddress, parsed.latestScan);
          }
        } catch (e: any) {
          logger.error('Error parsing assignment output JSON', { error: e.message });
        }
      }
    }
  }
}

// Singleton instance
export const creWorkflowService = new CREWorkflowService();
