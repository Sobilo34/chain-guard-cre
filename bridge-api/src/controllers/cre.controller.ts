/**
 * CRE Workflow Controllers
 */

import { Request, Response } from 'express';
import { creWorkflowService } from '../services/creWorkflow.service';
import { contractService } from '../services/contract.service';
import { asyncHandler } from '../middleware/errorHandler';
import { ApiSuccessResponse } from '../types';
import logger from '../middleware/logger';

export const creControllers = {
  /**
   * POST /cre/trigger
   * Normal CRE HTTP Trigger
   */
  httpTrigger: asyncHandler(async (req: Request, res: Response) => {
    logger.info('CRE HTTP trigger received', { payload: req.body });
    
    const result = await creWorkflowService.executeNormalWorkflow(req.body);
    
    res.json(result);
  }),

  /**
   * POST /cre/confidential/trigger
   * Confidential CRE HTTP Trigger (Experimental, Simulation Only)
   */
  confidentialTrigger: asyncHandler(async (req: Request, res: Response) => {
    logger.info('CRE confidential trigger received', { payload: req.body });
    
    const result = await creWorkflowService.executeConfidentialWorkflow(req.body);
    
    res.json(result);
  }),

  /**
   * POST /cre/report
   * CRE Report Submission
   */
  submitReport: asyncHandler(async (req: Request, res: Response) => {
    const { reportType, data, signatures, timestamp } = req.body;
    
    logger.info('CRE report received', { reportType, timestamp });
    
    // Verify report (in production, verify DON signatures)
    if (signatures && signatures.length > 0) {
      logger.debug('Report signatures received', { count: signatures.length });
    }
    
    // Process report based on type
    switch (reportType) {
      case 'risk_assessment':
        // Update contract status
        if (data.contractAddress && data.riskLevel) {
          await contractService.updateContractStatus(
            data.contractAddress,
            data.riskLevel,
            data.riskScore,
            data.metrics
          );
        }
        break;
        
      case 'alert':
        // Create alert
        if (data.contractAddress && data.severity && data.message) {
          await contractService.addAlert({
            contractAddress: data.contractAddress,
            severity: data.severity,
            message: data.message,
            details: data.details,
          });
        }
        break;
        
      case 'status_update':
        // Update status only
        if (data.contractAddress) {
          await contractService.getContractStatus(data.contractAddress);
        }
        break;
        
      default:
        logger.warn('Unknown report type', { reportType });
    }
    
    const response: ApiSuccessResponse = {
      success: true,
      message: 'Report submitted successfully',
    };
    
    res.status(201).json(response);
  }),

  /**
   * GET /cre/executions
   * List workflow executions
   */
  listExecutions: asyncHandler(async (_req: Request, res: Response) => {
    const executions = creWorkflowService.listExecutions();
    res.json({ executions });
  }),

  /**
   * GET /cre/executions/:id
   * Get workflow execution details
   */
  getExecution: asyncHandler(async (req: Request, res: Response) => {
    const execution = creWorkflowService.getExecution(req.params.id);
    
    if (!execution) {
      res.status(404).json({ error: 'Execution not found' });
      return;
    }
    
    res.json(execution);
  }),
};
