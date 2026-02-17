/**
 * Scan Routes
 */

import { Router } from 'express';
import { scanControllers } from '../controllers/scan.controller';
import { validateEnum } from '../middleware/validation';

const router = Router();

// Trigger on-demand scan
router.post(
  '/',
  validateEnum('priority', ['low', 'normal', 'high'], 'body'),
  scanControllers.triggerScan
);

export default router;
