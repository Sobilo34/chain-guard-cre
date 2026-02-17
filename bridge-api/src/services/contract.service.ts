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
      chain: request.chain || 'ethereum',
      riskThresholds: request.riskThresholds || {
        volatility: 0.15,
        liquidity: 0.20,
        concentration: 0.25,
        overall: 0.30,
      },
      priceFeeds: request.priceFeeds || [],
      alertChannels: request.alertChannels || ['email'],
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
        address: '0x1234567890123456789012345678901234567890',
        name: 'Aave V3 Pool',
        protocol: 'Aave',
        chain: 'ethereum',
        riskThresholds: {
          volatility: 0.15,
          liquidity: 0.20,
          concentration: 0.25,
          overall: 0.30,
        },
        priceFeeds: [
          {
            asset: 'ETH/USD',
            feedAddress: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
            decimals: 8,
          },
        ],
        alertChannels: ['email', 'slack'],
      },
    ];

    for (const contract of sampleContracts) {
      this.addContract(contract).catch(err => {
        logger.error('Failed to add sample contract', { error: err.message });
      });
    }
  }
}

// Singleton instance
export const contractService = new ContractService();
