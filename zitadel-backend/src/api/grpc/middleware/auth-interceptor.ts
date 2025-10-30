/**
 * Authentication Interceptor for gRPC
 * 
 * Validates tokens and builds authorization context for requests
 */

import * as grpc from '@grpc/grpc-js';
import { buildContextFromToken, TokenPayload } from '../../../lib/authz/context-builder';
import { AuthContext, TokenType } from '../../../lib/authz/types';

/**
 * Auth context key for storing in gRPC call
 */
export const AUTH_CONTEXT_KEY = 'authContext';

/**
 * Create authentication interceptor
 */
export function createAuthInterceptor() {
  return (
    options: any,
    nextCall: (options: any) => grpc.InterceptingCall
  ): grpc.InterceptingCall => {
    const requester = {
      start: (metadata: grpc.Metadata, listener: grpc.Listener, next: (metadata: grpc.Metadata, listener: grpc.Listener) => void) => {
        // Extract token from metadata
        const authorization = metadata.get('authorization')[0] as string | undefined;
        
        if (!authorization) {
          // No auth - create anonymous context
          const anonContext: AuthContext = {
            subject: {
              userId: 'anonymous',
              roles: [],
            },
            instanceId: 'default',
            tokenType: TokenType.USER,
            isSystemToken: false,
          };
          
          // Store in metadata for handler access
          metadata.set(AUTH_CONTEXT_KEY, JSON.stringify(anonContext));
        } else {
          try {
            // Parse JWT token (simplified - in production use proper JWT library)
            const token = authorization.replace(/^Bearer\s+/i, '');
            const payload = parseJWT(token);
            
            // Build context from token
            const context = buildContextFromToken(payload);
            
            // Store in metadata for handler access
            metadata.set(AUTH_CONTEXT_KEY, JSON.stringify(context));
          } catch (error) {
            // Invalid token - create anonymous context
            const anonContext: AuthContext = {
              subject: {
                userId: 'anonymous',
                roles: [],
              },
              instanceId: 'default',
              tokenType: TokenType.USER,
              isSystemToken: false,
            };
            metadata.set(AUTH_CONTEXT_KEY, JSON.stringify(anonContext));
          }
        }
        
        next(metadata, listener);
      },
    };

    return new grpc.InterceptingCall(nextCall(options), requester);
  };
}

/**
 * Parse JWT token (simplified)
 * In production, use a proper JWT library like 'jose'
 */
function parseJWT(token: string): TokenPayload {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf-8')
    );

    return payload as TokenPayload;
  } catch (error) {
    throw new Error('Failed to parse JWT token');
  }
}

/**
 * Extract auth context from call metadata
 */
export function getAuthContext(call: grpc.ServerUnaryCall<any, any> | grpc.ServerWritableStream<any, any>): AuthContext | null {
  try {
    const contextStr = call.metadata.get(AUTH_CONTEXT_KEY)[0] as string;
    if (!contextStr) {
      return null;
    }
    return JSON.parse(contextStr) as AuthContext;
  } catch (error) {
    return null;
  }
}
