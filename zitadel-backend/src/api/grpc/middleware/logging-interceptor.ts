/**
 * Logging Interceptor for gRPC
 * 
 * Logs all gRPC requests and responses for debugging and monitoring
 */

import * as grpc from '@grpc/grpc-js';

export interface LogEntry {
  timestamp: Date;
  method: string;
  peer: string;
  metadata: Record<string, string>;
  duration?: number;
  status?: grpc.status;
  error?: string;
}

/**
 * Create logging interceptor
 */
export function createLoggingInterceptor() {
  return (
    options: any,
    nextCall: (options: any) => grpc.InterceptingCall
  ): grpc.InterceptingCall => {
    const startTime = Date.now();
    const logEntry: LogEntry = {
      timestamp: new Date(),
      method: options.method_definition?.path || 'unknown',
      peer: 'unknown',
      metadata: {},
    };

    const requester = {
      start: (metadata: grpc.Metadata, listener: grpc.Listener, next: (metadata: grpc.Metadata, listener: grpc.Listener) => void) => {
        // Extract metadata for logging
        const metadataObj: Record<string, string> = {};
        const metadataMap = metadata.getMap();
        
        for (const [key, value] of Object.entries(metadataMap)) {
          if (typeof value === 'string') {
            // Don't log sensitive data
            if (key.toLowerCase().includes('authorization') || key.toLowerCase().includes('token')) {
              metadataObj[key] = '[REDACTED]';
            } else {
              metadataObj[key] = value;
            }
          }
        }
        
        logEntry.metadata = metadataObj;
        
        // Log request start
        console.log(`[gRPC] → ${logEntry.method}`, {
          timestamp: logEntry.timestamp.toISOString(),
          metadata: logEntry.metadata,
        });

        const newListener: grpc.Listener = {
          ...listener,
          onReceiveStatus: (status: grpc.StatusObject, next: (status: grpc.StatusObject) => void) => {
            // Calculate duration
            logEntry.duration = Date.now() - startTime;
            logEntry.status = status.code;
            
            if (status.code !== grpc.status.OK) {
              logEntry.error = status.details;
            }

            // Log response
            const emoji = status.code === grpc.status.OK ? '✓' : '✗';
            
            console.log(`[gRPC] ${emoji} ${logEntry.method}`, {
              duration: `${logEntry.duration}ms`,
              status: grpc.status[status.code] || status.code,
              ...(logEntry.error && { error: logEntry.error }),
            });

            next(status);
          },
        };

        next(metadata, newListener);
      },
    };

    return new grpc.InterceptingCall(nextCall(options), requester);
  };
}

/**
 * Log gRPC call (for server-side logging)
 */
export function logGrpcCall(
  call: grpc.ServerUnaryCall<any, any> | grpc.ServerWritableStream<any, any>,
  method: string
): void {
  const metadata = call.metadata;
  const peer = call.getPeer();

  const metadataObj: Record<string, string> = {};
  const metadataMap = metadata.getMap();
  
  for (const [key, value] of Object.entries(metadataMap)) {
    if (typeof value === 'string') {
      if (key.toLowerCase().includes('authorization') || key.toLowerCase().includes('token')) {
        metadataObj[key] = '[REDACTED]';
      } else {
        metadataObj[key] = value;
      }
    }
  }

  console.log(`[gRPC Server] ${method}`, {
    peer,
    metadata: metadataObj,
  });
}
