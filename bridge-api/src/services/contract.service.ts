/**
 * Contract Management Service
 */

import logger from '../middleware/logger';
import {
  MonitoredContract,
  ContractStatus,
  AddContractRequest,
  UpdateContractRequest,
  Alert,
  RiskLevel,
} from '../types';

export class ContractService {
  // In-memory storage (replace with database in production)
  private contracts: Map<string, MonitoredContract> = new Map();
  private contractStatuses: Map<string, ContractStatus> = new Map();
  private alerts: Alert[] = [];

  constructor() {
    // Initialize without example data 
    // this.initializeSampleData();
  }

  /**
   * Get all monitored contracts
   */
  async getAllContracts(): Promise<MonitoredContract[]> {
    return Array.from(this.contracts.values());
  }

  /**
   * Get contract by address
   */
  async getContract(address: string): Promise<MonitoredContract | null> {
    const contract = this.contracts.get(address.toLowerCase());
    return contract || null;
  }

  /**
   * Add new contract
   */
  async addContract(request: AddContractRequest): Promise<MonitoredContract> {
    const address = request.address.toLowerCase();

    // Check if already exists
    if (this.contracts.has(address)) {
      throw new Error('Contract already exists');
    }

    const contract: MonitoredContract = {
      address,
      name: request.name,
      protocol: request.protocol,
      chain: request.chain || request.chainSelectorName || 'ethereum-testnet-sepolia',
      chainSelectorName: request.chainSelectorName,
      chainName: request.chainName,
      rpcUrl: request.rpcUrl,
      chainId: request.chainId,
      riskThresholds: request.riskThresholds || {
        volatility: 0.15,
        liquidity: 0.20,
        concentration: 0.25,
        overall: 0.30,
      },
      priceFeeds: request.priceFeeds || [],
      alertChannels: request.alertChannels?.length ? request.alertChannels : ['email'],
      addedAt: new Date(),
    };

    this.contracts.set(address, contract);

    // Initialize status
    this.contractStatuses.set(address, {
      address,
      riskLevel: 'LOW',
      lastChecked: new Date(),
    });

    logger.info('Contract added', { address, name: contract.name });

    return contract;
  }

  /**
   * Update contract
   */
  async updateContract(
    address: string,
    request: UpdateContractRequest
  ): Promise<MonitoredContract> {
    const lowerAddress = address.toLowerCase();
    const contract = this.contracts.get(lowerAddress);

    if (!contract) {
      throw new Error('Contract not found');
    }

    // Update fields
    if (request.name) contract.name = request.name;
    if (request.riskThresholds) contract.riskThresholds = request.riskThresholds;
    if (request.priceFeeds) contract.priceFeeds = request.priceFeeds;
    if (request.alertChannels) contract.alertChannels = request.alertChannels;

    this.contracts.set(lowerAddress, contract);

    logger.info('Contract updated', { address: lowerAddress });

    return contract;
  }

  /**
   * Delete contract
   */
  async deleteContract(address: string): Promise<void> {
    const lowerAddress = address.toLowerCase();

    if (!this.contracts.has(lowerAddress)) {
      throw new Error('Contract not found');
    }

    this.contracts.delete(lowerAddress);
    this.contractStatuses.delete(lowerAddress);

    logger.info('Contract deleted', { address: lowerAddress });
  }

  /**
   * Get contract status
   */
  async getContractStatus(address: string): Promise<ContractStatus | null> {
    const lowerAddress = address.toLowerCase();
    const status = this.contractStatuses.get(lowerAddress);
    return status || null;
  }

  /**
   * Get full contract details including history and AI insights
   */
  async getContractDetails(address: string): Promise<any | null> {
    const lowerAddress = address.toLowerCase();
    const contract = this.contracts.get(lowerAddress);
    const status = this.contractStatuses.get(lowerAddress);
    const { alerts } = await this.getAlerts(lowerAddress, undefined, 5);

    if (!contract || !status) return null;

    // Provide defaulted static history layout if actual history points don't exist yet
    const currentTime = new Date();
    const volatilityHistory = status.metrics?.volatilityHistory || Array.from({ length: 7 }, (_, i) => {
      const date = new Date(currentTime);
      date.setDate(date.getDate() - (6 - i));
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return {
        time: days[date.getDay()],
        value: 0
      };
    });

    const riskHistory = status.riskHistory || Array.from({ length: 6 }, (_, i) => ({
      time: `${i + 1}h`,
      score: 0
    }));

    return {
      ...status,
      name: contract.name || contract.protocol || 'Unknown',
      chain: contract.chain || 'ethereum',
      protocol: contract.protocol,
      metrics: {
        ...status.metrics,
        price: status.metrics?.currentPrice || 0,
        volume24h: status.metrics?.volume24h || 0,
        liquidity: status.metrics?.totalLiquidity || 0,
      },
      history: {
        volatility: volatilityHistory,
        riskScore: riskHistory
      },
      latestScan: status.latestScan,
      recentAlerts: alerts.map(a => ({
        id: a.id,
        time: this.formatRelativeTime(a.timestamp),
        type: a.message,
        severity: a.severity.toLowerCase(),
        status: a.resolved ? 'resolved' : 'active'
      })),
      aiSuggestions: [
        {
          title: "Increase Liquidity Threshold",
          description: `Based on recent volatility patterns for ${contract.name}, consider raising your liquidity drop threshold to receiving earlier warnings.`,
        },
        {
          title: "Enable Manipulation Detection",
          description: "Your contract shows patterns that could benefit from our advanced manipulation detection feature.",
        },
        {
          title: "Add Price Feed Redundancy",
          description: "Consider adding multiple oracle price feeds for this asset to improve accuracy and reduce single point of failure risk.",
        },
      ]
    };
  }

  private formatRelativeTime(date: Date): string {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} mins ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hours ago`;
    return `${Math.floor(hours / 24)} days ago`;
  }

  /**
   * Update contract status (called after risk assessment)
   */
  async updateContractStatus(
    address: string,
    riskLevel: RiskLevel,
    riskScore?: number,
    metrics?: any
  ): Promise<void> {
    const lowerAddress = address.toLowerCase();

    const status: ContractStatus = {
      address: lowerAddress,
      riskLevel,
      riskScore,
      lastChecked: new Date(),
      metrics,
      activeAlerts: this.getActiveAlertsCount(lowerAddress),
    };

    this.contractStatuses.set(lowerAddress, status);

    logger.info('Contract status updated', { address: lowerAddress, riskLevel });
  }

  /**
   * Update latest scan results for a contract
   */
  async updateLatestScan(address: string, scanResult: any): Promise<void> {
    const lowerAddress = address.toLowerCase();
    const status = this.contractStatuses.get(lowerAddress);

    if (status) {
      status.latestScan = scanResult;
      this.contractStatuses.set(lowerAddress, status);
      logger.info('Contract latestScan updated', { address: lowerAddress });
    }
  }

  /**
   * Get alerts for a contract
   */
  async getAlerts(
    address?: string,
    severity?: RiskLevel,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ alerts: Alert[]; total: number }> {
    let filtered = this.alerts;

    // Filter by address
    if (address) {
      filtered = filtered.filter(a => a.contractAddress.toLowerCase() === address.toLowerCase());
    }

    // Filter by severity
    if (severity) {
      filtered = filtered.filter(a => a.severity === severity);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return { alerts: paginated, total };
  }

  /**
   * Add alert
   */
  async addAlert(alert: Omit<Alert, 'id' | 'timestamp'>): Promise<Alert> {
    const newAlert: Alert = {
      ...alert,
      id: this.generateAlertId(),
      timestamp: new Date(),
      resolved: false,
    };

    this.alerts.push(newAlert);

    logger.info('Alert added', {
      id: newAlert.id,
      address: alert.contractAddress,
      severity: alert.severity
    });

    return newAlert;
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }
    alert.resolved = true;
    alert.resolvedAt = new Date();
    logger.info('Alert resolved', { id: alertId });
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }
    // For now, acknowledgement is just setting a flag or simply logging
    // Let's add an 'acknowledged' property to Alert type if needed, but resolved is close enough for this demo
    // or we can just log it for now.
    logger.info('Alert acknowledged', { id: alertId });
  }

  /**
   * Get active alerts count for a contract
   */
  private getActiveAlertsCount(address: string): number {
    return this.alerts.filter(
      a => a.contractAddress.toLowerCase() === address.toLowerCase() && !a.resolved
    ).length;
  }

  /**
   * Generate alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}`;
  }
}

// Singleton instance
export const contractService = new ContractService();
