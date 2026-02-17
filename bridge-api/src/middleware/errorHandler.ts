/**
 * Error Handling Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { ErrorResponse } from '../types';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: string
  ) {
    super(message);
    this.name = 'ApiError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error('Error:', err);

  if (err instanceof ApiError) {
    const response: ErrorResponse = {
      error: err.message,
      code: err.code,
      details: err.details,
    };
    return res.status(err.statusCode).json(response);
  }

  // Handle unexpected errors
  const response: ErrorResponse = {
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined,
  };
  
  return res.status(500).json(response);
};

// Async handler wrapper to catch promise rejections
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Common error factories
export const notFound = (resource: string = 'Resource') => {
  return new ApiError(404, `${resource} not found`, 'NOT_FOUND');
};

export const badRequest = (message: string, details?: string) => {
  return new ApiError(400, message, 'BAD_REQUEST', details);
};

export const unauthorized = (message: string = 'Unauthorized') => {
  return new ApiError(401, message, 'UNAUTHORIZED');
};

export const forbidden = (message: string = 'Forbidden') => {
  return new ApiError(403, message, 'FORBIDDEN');
};

export const internalError = (message: string = 'Internal server error') => {
  return new ApiError(500, message, 'INTERNAL_ERROR');
};
