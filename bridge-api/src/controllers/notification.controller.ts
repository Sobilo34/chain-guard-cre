/**
 * Notification Controllers
 */

import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import { asyncHandler, badRequest } from '../middleware/errorHandler';
import { creWorkflowPath } from '../config';
import { creWorkflowService } from '../services/creWorkflow.service';
import logger from '../middleware/logger';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getConfigPaths = () => {
  const basePath = path.resolve(process.cwd(), creWorkflowPath);
  return [
    path.join(basePath, 'config.json'),
    path.join(basePath, 'config.staging.json'),
    path.join(basePath, 'config.production.json'),
  ];
};

const readEmailFromConfig = () => {
  const [primaryPath] = getConfigPaths();
  if (!fs.existsSync(primaryPath)) return null;
  const raw = fs.readFileSync(primaryPath, 'utf-8');
  const parsed = JSON.parse(raw) as { emailConfig?: { to?: string[] } };
  const toList = parsed.emailConfig?.to || [];
  return toList.length > 0 ? toList[0] : null;
};

const writeEmailToConfigs = (email: string) => {
  const paths = getConfigPaths();
  paths.forEach((configPath) => {
    if (!fs.existsSync(configPath)) return;
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as {
      emailConfig?: { from?: string; to?: string[]; subject?: string; apiEndpoint?: string };
    };
    parsed.emailConfig = {
      from: parsed.emailConfig?.from || 'alerts@chainguard.io',
      to: [email],
      subject: parsed.emailConfig?.subject || 'ChainGuard Risk Alert',
      apiEndpoint: parsed.emailConfig?.apiEndpoint,
    };
    fs.writeFileSync(configPath, JSON.stringify(parsed, null, 2));
  });
};

export const notificationControllers = {
  /**
   * GET /api/notifications/email
   */
  getEmail: asyncHandler(async (_req: Request, res: Response) => {
    const email = readEmailFromConfig();
    res.json({ email });
  }),

  /**
   * PUT /api/notifications/email
   */
  setEmail: asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body as { email?: string };
    if (!email || !EMAIL_REGEX.test(email)) {
      throw badRequest('Valid email is required');
    }

    writeEmailToConfigs(email);
    res.json({ success: true, email });
  }),

  /**
   * POST /api/notifications/test
   */
  sendTestEmail: asyncHandler(async (_req: Request, res: Response) => {
    const email = readEmailFromConfig();
    if (!email) {
      throw badRequest('Email not configured. Please set an email first.');
    }

    // Trigger a manual check/test
    // In our system, the CRE workflow is responsible for detecting and sending alerts.
    // Triggering a 'monitor' action will cause the CRE to scan and send alerts if found.
    try {
      // Fire and forget, or wait? User said "upon the trigger", usually implies initiation.
      // We'll call it without awaiting if we want it to be fast, but since it's a test button,
      // awaiting might be better to show it actually did something.
      // However, CRE simulation can take time. We'll at least log it.
      logger.info('Test notification trigger: starting CRE monitor workflow', { email });

      // We initiate it but don't strictly require the result for the response
      creWorkflowService.executeNormalWorkflow({ action: 'monitor' } as any).catch(err => {
        logger.error('Test notification CRE trigger failed', { error: err.message });
      });
    } catch (e) {
      logger.error('Error initiating test notification', e);
    }

    res.json({
      success: true,
      message: `Test notification sequence initiated. If there are pending alerts for ${email}, they will be dispatched.`
    });
  }),
};
