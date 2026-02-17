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
};
