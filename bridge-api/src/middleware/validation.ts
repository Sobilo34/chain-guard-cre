/**
 * Request Validation Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { badRequest } from './errorHandler';
import { isValidEthereumAddress } from '../types';

// Ethereum address validation
export const validateEthereumAddress = (paramName: string = 'address') => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const address = req.params[paramName] || req.body[paramName];
    
    if (!address) {
      return next(badRequest(`${paramName} is required`));
    }
    
    if (!isValidEthereumAddress(address)) {
      return next(badRequest(`Invalid Ethereum address format for ${paramName}`));
    }
    
    next();
  };
};

// Request body validation
export const validateBody = (requiredFields: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const missing = requiredFields.filter(field => !req.body[field]);
    
    if (missing.length > 0) {
      return next(badRequest(
        `Missing required fields: ${missing.join(', ')}`,
        `Required: ${requiredFields.join(', ')}`
      ));
    }
    
    next();
  };
};

// Numeric validation
export const validateNumericRange = (
  field: string,
  min: number,
  max: number,
  location: 'body' | 'query' = 'body'
) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const value = Number(req[location][field]);
    
    if (isNaN(value)) {
      return next(badRequest(`${field} must be a number`));
    }
    
    if (value < min || value > max) {
      return next(badRequest(
        `${field} must be between ${min} and ${max}`,
        `Received: ${value}`
      ));
    }
    
    next();
  };
};

// Enum validation
export const validateEnum = <T extends string>(
  field: string,
  allowedValues: readonly T[],
  location: 'body' | 'query' = 'body'
) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const value = req[location][field];
    
    if (value && !allowedValues.includes(value as T)) {
      return next(badRequest(
        `Invalid value for ${field}`,
        `Allowed values: ${allowedValues.join(', ')}`
      ));
    }
    
    next();
  };
};

// Risk thresholds validation
export const validateRiskThresholds = (req: Request, _res: Response, next: NextFunction) => {
  const thresholds = req.body.riskThresholds;
  
  if (!thresholds) {
    return next();
  }
  
  const requiredFields = ['volatility', 'liquidity', 'concentration'];
  const missing = requiredFields.filter(field => 
    typeof thresholds[field] !== 'number'
  );
  
  if (missing.length > 0) {
    return next(badRequest(
      'Invalid risk thresholds',
      `Missing or invalid: ${missing.join(', ')}`
    ));
  }
  
  // Validate ranges (0-1)
  for (const field of requiredFields) {
    const value = thresholds[field];
    if (value < 0 || value > 1) {
      return next(badRequest(
        `Risk threshold ${field} must be between 0 and 1`,
        `Received: ${value}`
      ));
    }
  }
  
  next();
};

// CRE signature validation (for future implementation)
export const validateCRESignature = (req: Request, _res: Response, next: NextFunction) => {
  const signature = req.headers['x-evm-signature'] as string;
  
  // In simulation mode, signature is optional
  if (process.env.CRE_TARGET === 'local-simulation') {
    return next();
  }
  
  // In production, require signature
  if (!signature) {
    return next(badRequest('Missing X-EVM-Signature header'));
  }
  
  // TODO: Implement actual signature verification
  // For now, just check format
  if (!signature.startsWith('0x') || signature.length !== 132) {
    return next(badRequest('Invalid signature format'));
  }
  
  next();
};
