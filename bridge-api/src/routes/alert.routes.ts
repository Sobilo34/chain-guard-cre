/**
 * Alert Routes
 */

import { Router } from 'express';
import { alertControllers } from '../controllers/alert.controller';
import { validateEnum } from '../middleware/validation';

const router = Router();

// Get alerts with filtering
router.get(
  '/',
  validateEnum('severity', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], 'query'),
  alertControllers.getAlerts
);

// Acknowledge alert
router.post(
  '/:id/acknowledge',
  alertControllers.acknowledgeAlert
);

// Resolve alert (mitigate)
router.post(
  '/:id/resolve',
  alertControllers.resolveAlert
);

export default router;
