import { NextFunction, Request, Response } from 'express';
import { formatRequest } from '../services/logger';

/**
 * Express middleware for logging HTTP requests
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    const path = req.originalUrl || req.url;

    // Skip health check logs to reduce noise
    if (path === '/health') {
      return;
    }

    console.log(formatRequest(req.method, path, res.statusCode, duration));
  });

  next();
}

export default requestLogger;
