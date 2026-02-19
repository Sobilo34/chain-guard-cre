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
    // Initialize with some example data
    this.initializeSampleData();
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

    // Simulate history based on current score
    const currentTime = new Date();
    const volatilityHistory = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(currentTime);
      date.setDate(date.getDate() - (6 - i));
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return {
        time: days[date.getDay()],
        value: (status.metrics?.volatility || 0.1) * (1 + (Math.random() * 0.4 - 0.2)) * 100
      };
    });

    const riskHistory = Array.from({ length: 6 }, (_, i) => ({
      time: `${i + 1}h`,
      score: Math.max(0, Math.min(100, (status.riskScore || 50) + (Math.random() * 10 - 5)))
    }));

    return {
      ...status,
      name: contract.name || contract.protocol || 'Unknown',
      chain: contract.chain || 'ethereum',
      protocol: contract.protocol,
      metrics: {
        ...status.metrics,
        price: 2847.32 + (Math.random() * 100 - 50),
        volume24h: (status.metrics?.tvl || 1000) * 0.15,
        liquidity: 85 + (Math.random() * 10 - 5),
      },
      history: {
        volatility: volatilityHistory,
        riskScore: riskHistory
      },
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
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize sample data
   */
  private initializeSampleData(): void {
    // Add sample contracts
    const sampleContracts: AddContractRequest[] = [
      {
        address: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8",
        name: "Uniswap V3 Pool",
        protocol: "Uniswap",
        chain: "ethereum",
        riskThresholds: {
          volatility: 0.1,
          liquidity: 0.2,
          concentration: 0.2,
          overall: 0.2,
        },
        priceFeeds: [
          {
            asset: "ETH/USD",
            feedAddress: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
            decimals: 8,
          },
        ],
        alertChannels: ["email", "slack"],
      },
      {
        address: "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9",
        name: "Aave Lending Pool",
        protocol: "Aave",
        chain: "ethereum",
        riskThresholds: {
          volatility: 0.15,
          liquidity: 0.25,
          concentration: 0.3,
          overall: 0.3,
        },
        priceFeeds: [
          {
            asset: "AAVE/USD",
            feedAddress: "0x547a514d5e3769680Ce22B2361c10Ea136077881",
            decimals: 8,
          },
        ],
        alertChannels: ["email"],
      },
      {
        address: "0x2d9458b72551ec946c986c478a0b0d3e5e488b73",
        name: "Curve Finance",
        protocol: "Curve",
        chain: "ethereum",
        riskThresholds: {
          volatility: 0.25,
          liquidity: 0.3,
          concentration: 0.4,
          overall: 0.4,
        },
        priceFeeds: [
          {
            asset: "CRV/USD",
            feedAddress: "0xCd627aA160A6f1D873530471b51892dAb001952e",
            decimals: 8,
          },
        ],
        alertChannels: ["email", "slack"],
      },
    ];

    for (const contract of sampleContracts) {
      this.addContract(contract)
        .then(async (c) => {
          // Add some dummy metrics and status
          const isHighRisk = c.protocol === "Curve";
          const isMedRisk = c.protocol === "Aave";
          
          await this.updateContractStatus(
            c.address,
            isHighRisk ? "HIGH" : (isMedRisk ? "MEDIUM" : "LOW"),
            isHighRisk ? 85 : (isMedRisk ? 45 : 12),
            {
              tvl: isHighRisk ? 4200000 : (isMedRisk ? 12100000 : 8200000),
              volatility: isHighRisk ? 0.321 : (isMedRisk ? 0.154 : 0.082),
              liquidity: 10000000,
            }
          );

          if (isHighRisk) {
              await this.addAlert({
                  contractAddress: c.address,
                  message: 'Liquidity Drop',
                  severity: 'HIGH'
              });
              await this.addAlert({
                contractAddress: c.address,
                message: 'TVL Change',
                severity: 'MEDIUM'
            });
          }
          if (isMedRisk) {
            await this.addAlert({
                contractAddress: c.address,
                message: 'Volatility Spike',
                severity: 'MEDIUM'
            });
          }
        })
        .catch((err) => {
          logger.error("Failed to add sample contract", { error: err.message });
        });
    }
  }
}

// Singleton instance
export const contractService = new ContractService();
