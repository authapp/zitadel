/**
 * Request Logging Middleware
 * 
 * HTTP request logging using Morgan with custom formats
 */

import morgan from 'morgan';
import { RequestHandler } from 'express';

export type LogFormat = 'dev' | 'combined' | 'common' | 'short' | 'tiny' | 'json';

export interface LoggingConfig {
  format?: LogFormat | string;
  skip?: (req: any, res: any) => boolean;
  stream?: {
    write: (message: string) => void;
  };
}

/**
 * Create request logging middleware
 */
export function createLoggingMiddleware(config?: LoggingConfig): RequestHandler {
  const format = config?.format || 'dev';
  
  // Custom JSON format for structured logging
  if (format === 'json') {
    morgan.token('request-id', (req: any) => req.requestId);
    
    const jsonFormat = JSON.stringify({
      timestamp: ':date[iso]',
      method: ':method',
      url: ':url',
      status: ':status',
      responseTime: ':response-time',
      contentLength: ':res[content-length]',
      requestId: ':request-id',
      userAgent: ':user-agent',
      remoteAddr: ':remote-addr',
    });
    
    return morgan(jsonFormat, {
      skip: config?.skip,
      stream: config?.stream,
    });
  }
  
  return morgan(format as any, {
    skip: config?.skip,
    stream: config?.stream,
  });
}

/**
 * Create development logging (colorful, detailed)
 */
export function createDevelopmentLogging(): RequestHandler {
  return morgan('dev');
}

/**
 * Create production logging (Apache combined format)
 */
export function createProductionLogging(
  stream?: { write: (message: string) => void }
): RequestHandler {
  return morgan('combined', {
    skip: (req, res) => {
      // Skip health check logs in production
      return req.url === '/health' && res.statusCode === 200;
    },
    stream,
  });
}

/**
 * Create JSON structured logging
 */
export function createJsonLogging(
  stream?: { write: (message: string) => void }
): RequestHandler {
  return createLoggingMiddleware({
    format: 'json',
    stream,
  });
}

/**
 * Create logging middleware that skips specific paths
 */
export function createSelectiveLogging(
  skipPaths: string[],
  format: LogFormat = 'dev'
): RequestHandler {
  return morgan(format, {
    skip: (req) => skipPaths.some(path => req.url.startsWith(path)),
  });
}
