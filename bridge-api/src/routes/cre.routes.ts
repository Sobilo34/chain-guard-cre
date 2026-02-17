/**
 * CRE Workflow Routes
 */

import { Router } from 'express';
import { creControllers } from '../controllers/cre.controller';
import { validateCRESignature, validateBody, validateEnum } from '../middleware/validation';

const router = Router();

// Normal HTTP Trigger
router.post(
  '/trigger',
  validateBody(['action']),
  validateEnum('action', ['scan', 'monitor', 'evaluate'], 'body'),
  validateCRESignature,
  creControllers.httpTrigger
);

// Confidential HTTP Trigger
router.post(
  '/confidential/trigger',
  validateBody(['action', 'enclaveConfig']),
  validateEnum('action', ['analyze', 'evaluate'], 'body'),
  validateCRESignature,
  creControllers.confidentialTrigger
);

// Report Submission
router.post(
  '/report',
  validateBody(['reportType', 'data']),
  validateEnum('reportType', ['risk_assessment', 'alert', 'status_update'], 'body'),
  creControllers.submitReport
);

// Workflow Execution Status
router.get('/executions', creControllers.listExecutions);
router.get('/executions/:id', creControllers.getExecution);

export default router;
