/**
 * Notification Routes
 */

import { Router } from 'express';
import { notificationControllers } from '../controllers/notification.controller';

const router = Router();

router.get('/email', notificationControllers.getEmail);
router.put('/email', notificationControllers.setEmail);
router.post('/test', notificationControllers.sendTestEmail);

export default router;
