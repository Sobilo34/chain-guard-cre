/**
 * Logging Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { logLevel } from '../config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLogLevel = LOG_LEVELS[logLevel as LogLevel] || LOG_LEVELS.info;

export const logger = {
  debug: (message: string, meta?: any) => {
    if (currentLogLevel <= LOG_LEVELS.debug) {
      console.debug(`[DEBUG] ${message}`, meta || '');
    }
  },
  
  info: (message: string, meta?: any) => {
    if (currentLogLevel <= LOG_LEVELS.info) {
      console.info(`[INFO] ${message}`, meta || '');
    }
  },
  
  warn: (message: string, meta?: any) => {
    if (currentLogLevel <= LOG_LEVELS.warn) {
      console.warn(`[WARN] ${message}`, meta || '');
    }
  },
  
  error: (message: string, meta?: any) => {
    if (currentLogLevel <= LOG_LEVELS.error) {
      console.error(`[ERROR] ${message}`, meta || '');
    }
  },
};

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  // Log request
  logger.info(`${req.method} ${req.path}`, {
    query: req.query,
    body: req.method !== 'GET' ? req.body : undefined,
    ip: req.ip,
  });
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'error' : 'info';
    
    logger[level](`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });
  
  next();
};

export default logger;
