/**
 * Contract Controllers
 */

import { Request, Response } from 'express';
import { contractService } from '../services/contract.service';
import { asyncHandler, notFound } from '../middleware/errorHandler';
import { ApiSuccessResponse } from '../types';

export const contractControllers = {
  /**
   * GET /api/contracts
   */
  listContracts: asyncHandler(async (_req: Request, res: Response) => {
    const contracts = await contractService.getAllContracts();
    res.json({ contracts });
  }),

  /**
   * POST /api/contracts
   */
  addContract: asyncHandler(async (req: Request, res: Response) => {
    const contract = await contractService.addContract(req.body);
    
    const response: ApiSuccessResponse = {
      success: true,
      message: 'Contract added successfully',
      data: contract,
    };
    
    res.status(201).json(response);
  }),

  /**
   * GET /api/contracts/:address
   */
  getContract: asyncHandler(async (req: Request, res: Response) => {
    const contract = await contractService.getContract(req.params.address);
    
    if (!contract) {
      throw notFound('Contract');
    }
    
    res.json(contract);
  }),

  /**
   * PUT /api/contracts/:address
   */
  updateContract: asyncHandler(async (req: Request, res: Response) => {
    const contract = await contractService.updateContract(req.params.address, req.body);
    
    const response: ApiSuccessResponse = {
      success: true,
      message: 'Contract updated successfully',
      data: contract,
    };
    
    res.json(response);
  }),

  /**
   * DELETE /api/contracts/:address
   */
  deleteContract: asyncHandler(async (req: Request, res: Response) => {
    await contractService.deleteContract(req.params.address);
    
    const response: ApiSuccessResponse = {
      success: true,
      message: 'Contract removed successfully',
    };
    
    res.json(response);
  }),

  /**
   * GET /api/contracts/:address/status
   */
  getContractStatus: asyncHandler(async (req: Request, res: Response) => {
    const status = await contractService.getContractStatus(req.params.address);
    
    if (!status) {
      throw notFound('Contract status');
    }
    
    res.json(status);
  }),

  /**
   * GET /api/contracts/:address/detail
   */
  getContractDetail: asyncHandler(async (req: Request, res: Response) => {
    const detail = await contractService.getContractDetails(req.params.address);
    
    if (!detail) {
      throw notFound('Contract detail');
    }
    
    res.json(detail);
  }),

  /**
   * GET /api/overview
   * Dashboard summary
   */
  getOverview: asyncHandler(async (_req: Request, res: Response) => {
    const contracts = await contractService.getAllContracts();
    const { alerts } = await contractService.getAlerts(undefined, undefined, 5); // Latest 5 alerts
    
    // Calculate KPIs
    let totalTvl = 0;
    let totalRiskScore = 0;
    let contractsWithScore = 0;
    let activeAlerts = 0;

    const mappedContracts = await Promise.all(contracts.map(async (c) => {
      const status = await contractService.getContractStatus(c.address);
      if (status) {
        if (status.metrics?.tvl) totalTvl += status.metrics.tvl;
        if (status.riskScore) {
          totalRiskScore += status.riskScore;
          contractsWithScore++;
        }
        activeAlerts += (status.activeAlerts || 0);
      }

      return {
        id: c.address, // UI uses id for keying
        name: c.name || c.protocol || 'Unknown',
        address: c.address,
        tvl: status?.metrics?.tvl ? `$${(status.metrics.tvl / 1000000).toFixed(1)}M` : '$0.0M',
        riskLevel: (status?.riskLevel || 'LOW').toLowerCase() as 'low' | 'medium' | 'high',
        volatility: status?.metrics?.volatility ? `${(status.metrics.volatility * 100).toFixed(1)}%` : '0.0%',
        chain: c.chain || 'ethereum',
        status: status?.riskLevel || 'LOW',
        lastUpdate: status?.lastChecked ? status.lastChecked.toISOString() : new Date().toISOString()
      };
    }));

    const mappedAlerts = alerts.map(a => ({
      id: a.id,
      timestamp: a.timestamp.toISOString(),
      contract: a.contractAddress,
      contractName: contracts.find(c => c.address.toLowerCase() === a.contractAddress.toLowerCase())?.name || 'Unknown',
      type: a.message,
      severity: a.severity.toLowerCase() as 'low' | 'medium' | 'high',
      status: a.resolved ? 'resolved' : 'active' as 'active' | 'acknowledged' | 'resolved'
    }));

    const data = {
      kpis: {
        monitoredContracts: contracts.length,
        activeAlerts: activeAlerts,
        totalValueLocked: totalTvl,
        riskScore: contractsWithScore > 0 ? Math.round(totalRiskScore / contractsWithScore) : 0
      },
      contracts: mappedContracts,
      alerts: mappedAlerts,
      system: {
        oracle: 'Chainlink Price Feeds',
        riskEngine: 'Gemini 1.5 Pro',
        alertService: 'Active',
        lastSync: new Date().toISOString()
      }
    };

    res.json({ data });
  }),
};
