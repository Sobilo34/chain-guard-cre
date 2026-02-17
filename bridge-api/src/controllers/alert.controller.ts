/**
 * Alert Controllers
 */

import { Request, Response } from 'express';
import { contractService } from '../services/contract.service';
import { asyncHandler } from '../middleware/errorHandler';

export const alertControllers = {
  /**
   * GET /api/alerts
   */
  getAlerts: asyncHandler(async (req: Request, res: Response) => {
    const { address, severity, limit, offset } = req.query;
    
    const { alerts, total } = await contractService.getAlerts(
      address as string | undefined,
      severity as any,
      limit ? parseInt(limit as string) : 50,
      offset ? parseInt(offset as string) : 0
    );
    
    res.json({
      alerts,
      total,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    });
  }),
};
