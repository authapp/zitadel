/**
 * Pushed Authorization Requests (PAR) Endpoint (RFC 9126)
 * 
 * POST /oauth/par - Push authorization request parameters
 */

import { Request, Response } from 'express';
import { Commands } from '@/lib/command/commands';
import { DatabasePool } from '@/lib/database';
import { PARRequest } from '@/lib/command/oauth/par-commands';

/**
 * POST /oauth/par
 * 
 * Pushed Authorization Request endpoint (RFC 9126)
 * 
 * Allows clients to push authorization request parameters to the
 * authorization server before redirecting the user, enhancing security.
 * 
 * Request body: OAuth 2.0 authorization request parameters
 * Response: request_uri and expires_in
 */
export async function handlePAR(
  req: Request,
  res: Response,
  commands: Commands,
  _pool: DatabasePool
): Promise<void> {
  try {
    // Extract PAR request from body
    const request = req.body as PARRequest;

    // Build context
    const ctx = {
      instanceID: (req.headers['x-zitadel-instance'] as string) || 'default',
      orgID: (req.headers['x-zitadel-orgid'] as string) || '',
      userID: (req.headers['x-zitadel-userid'] as string) || undefined,
    };

    // Validate required parameters
    if (!request.client_id) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'client_id is required',
      });
      return;
    }

    if (!request.response_type) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'response_type is required',
      });
      return;
    }

    if (!request.redirect_uri) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'redirect_uri is required',
      });
      return;
    }

    // Create PAR request
    const response = await commands.createPushedAuthRequest(ctx, request);

    // Return RFC 9126 compliant response
    res.status(201).json(response);
  } catch (error: any) {
    console.error('[PAR] Error:', error);

    // Map errors to RFC 9126 error responses
    if (error.code === 'INVALID_ARGUMENT') {
      res.status(400).json({
        error: 'invalid_request',
        error_description: error.message,
      });
    } else if (error.code?.startsWith('COMMAND-PAR')) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: error.message,
      });
    } else if (error.message?.includes('Invalid') || error.message?.includes('invalid')) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: error.message,
      });
    } else {
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error',
      });
    }
  }
}
