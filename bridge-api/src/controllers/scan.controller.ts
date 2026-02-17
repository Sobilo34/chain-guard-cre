/**
 * Scan Controllers
 */

import { Request, Response } from 'express';
import { creWorkflowService } from '../services/creWorkflow.service';
import { contractService } from '../services/contract.service';
import { asyncHandler } from '../middleware/errorHandler';
import { ScanResponse } from '../types';

export const scanControllers = {
  /**
   * POST /api/scan
   */
  triggerScan: asyncHandler(async (req: Request, res: Response) => {
    const { addresses, priority } = req.body;
    
    // If no addresses specified, scan all contracts
    const contractsToScan = addresses && addresses.length > 0
      ? addresses
      : (await contractService.getAllContracts()).map(c => c.address);
    
    // Trigger workflow execution
    const workflowResult = await creWorkflowService.executeNormalWorkflow({
      action: 'scan',
      parameters: {
        contracts: contractsToScan,
        priority: priority || 'normal',
      },
    });
    
    const response: ScanResponse = {
      scanId: workflowResult.workflowId,
      status: workflowResult.status === 'completed' ? 'completed' : 'running',
      contractsQueued: contractsToScan.length,
    };
    
    res.status(202).json(response);
  }),
};
