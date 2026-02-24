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
    const { addresses, address, contractAddress, priority } = req.body;
    
    // Normalize input addresses
    let targetAddresses: string[] = [];
    if (addresses && Array.isArray(addresses)) {
      targetAddresses = addresses;
    } else if (address) {
      targetAddresses = [address];
    } else if (contractAddress) {
      targetAddresses = [contractAddress];
    }
    
    // If no addresses specified, scan all contracts
    const contractsToScan = targetAddresses.length > 0
      ? targetAddresses
      : (await contractService.getAllContracts()).map(c => c.address);
    
    // Trigger workflow execution
    const workflowResult = await creWorkflowService.executeNormalWorkflow({
      action: 'scan',
      parameters: {
        contracts: contractsToScan,
        priority: priority || 'normal',
      },
    });
    
    const response: ScanResponse & { data?: any } = {
      scanId: workflowResult.workflowId,
      status: workflowResult.status === 'completed' ? 'completed' : 'running',
      contractsQueued: contractsToScan.length,
      data: workflowResult.result,
    };

    // If the CRE workflow reported an error payload, surface it clearly to the frontend
    const hasError =
      response.data &&
      typeof response.data === 'object' &&
      (response.data.error || response.data.output?.error);

    if (hasError) {
      const message =
        response.data.error ||
        response.data.output?.error ||
        'CRE workflow failed';
      return res.status(500).json({
        ...response,
        status: 'failed',
        error: message,
      });
    }

    res.status(workflowResult.status === 'completed' ? 200 : 202).json(response);
  }),
};
