/**
 * Contract Routes
 */

import { Router } from 'express';
import { contractControllers } from '../controllers/contract.controller';
import { validateEthereumAddress, validateBody, validateRiskThresholds } from '../middleware/validation';

const router = Router();

// List all contracts
router.get('/', contractControllers.listContracts);

// Add new contract
router.post(
  '/',
  validateBody(['address', 'name', 'protocol']),
  validateEthereumAddress('address'),
  validateRiskThresholds,
  contractControllers.addContract
);

// Get contract by address
router.get(
  '/:address',
  validateEthereumAddress(),
  contractControllers.getContract
);

// Update contract
router.put(
  '/:address',
  validateEthereumAddress(),
  validateRiskThresholds,
  contractControllers.updateContract
);

// Delete contract
router.delete(
  '/:address',
  validateEthereumAddress(),
  contractControllers.deleteContract
);

// Get contract status
router.get(
  '/:address/status',
  validateEthereumAddress(),
  contractControllers.getContractStatus
);

export default router;
