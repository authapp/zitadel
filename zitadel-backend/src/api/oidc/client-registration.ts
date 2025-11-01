/**
 * Dynamic Client Registration Endpoint (RFC 7591)
 * 
 * POST /oauth/register - Register new OAuth client
 * PUT /oauth/register/:client_id - Update existing client
 * DELETE /oauth/register/:client_id - Delete client
 */

import { Request, Response } from 'express';
import { Commands } from '@/lib/command/commands';
import { DatabasePool } from '@/lib/database';
import {
  ClientRegistrationRequest,
  ClientUpdateRequest,
} from '@/lib/command/oauth/client-registration-commands';

/**
 * POST /oauth/register
 * 
 * Register a new OAuth 2.0 client dynamically (RFC 7591)
 * 
 * Request body: ClientRegistrationRequest (RFC 7591 Section 2)
 * Response: ClientRegistrationResponse (RFC 7591 Section 3.2.1)
 */
export async function handleClientRegistration(
  req: Request,
  res: Response,
  commands: Commands,
  _pool: DatabasePool
): Promise<void> {
  try {
    // Extract registration request from body
    const request = req.body as ClientRegistrationRequest;

    // Get project and org from headers or defaults
    // In production, these would come from authentication/authorization
    const projectID = (req.headers['x-zitadel-project'] as string) || 'default-project';
    const orgID = (req.headers['x-zitadel-orgid'] as string) || 'default-org';

    // Build context
    const ctx = {
      instanceID: (req.headers['x-zitadel-instance'] as string) || 'default',
      orgID,
      userID: (req.headers['x-zitadel-userid'] as string) || undefined,
    };

    // Validate required field
    if (!request.redirect_uris || request.redirect_uris.length === 0) {
      res.status(400).json({
        error: 'invalid_client_metadata',
        error_description: 'redirect_uris is required and must contain at least one URI',
      });
      return;
    }

    // Register client
    const response = await commands.registerClient(
      ctx,
      projectID,
      orgID,
      request
    );

    // Return RFC 7591 compliant response
    res.status(201).json(response);
  } catch (error: any) {
    console.error('[Client Registration] Error:', error);

    // Map errors to RFC 7591 error responses
    if (error.code === 'INVALID_ARGUMENT' || error.code?.startsWith('COMMAND-DCR')) {
      res.status(400).json({
        error: 'invalid_client_metadata',
        error_description: error.message,
      });
    } else if (error.code?.startsWith('COMMAND-') || error.code?.startsWith('ERRORS-')) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: error.message,
      });
    } else if (error.message?.includes('Invalid') || error.message?.includes('invalid') ||
               error.message?.includes('required') || error.message?.includes('must')) {
      // Catch validation errors that don't have proper codes
      res.status(400).json({
        error: 'invalid_client_metadata',
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

/**
 * PUT /oauth/register/:client_id
 * 
 * Update an existing dynamically registered client (RFC 7592)
 */
export async function handleClientUpdate(
  req: Request,
  res: Response,
  commands: Commands,
  _pool: DatabasePool
): Promise<void> {
  try {
    const clientID = req.params.client_id;
    const request = req.body as ClientUpdateRequest;

    // Get project and org from headers
    const projectID = (req.headers['x-zitadel-project'] as string) || 'default-project';
    const orgID = (req.headers['x-zitadel-orgid'] as string) || 'default-org';

    // Build context
    const ctx = {
      instanceID: (req.headers['x-zitadel-instance'] as string) || 'default',
      orgID,
      userID: (req.headers['x-zitadel-userid'] as string) || undefined,
    };

    // Add client_id to request
    request.client_id = clientID;

    // Update client
    const response = await commands.updateClient(
      ctx,
      projectID,
      orgID,
      request
    );

    // Return updated client metadata
    res.status(200).json(response);
  } catch (error: any) {
    console.error('[Client Update] Error:', error);

    if (error.code === 'NOT_FOUND') {
      res.status(404).json({
        error: 'invalid_client_id',
        error_description: 'Client not found',
      });
    } else if (error.code?.startsWith('COMMAND-') || error.code?.startsWith('ERRORS-')) {
      res.status(400).json({
        error: 'invalid_client_metadata',
        error_description: error.message,
      });
    } else if (error.message?.includes('Invalid') || error.message?.includes('invalid') ||
               error.message?.includes('required') || error.message?.includes('must')) {
      res.status(400).json({
        error: 'invalid_client_metadata',
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

/**
 * DELETE /oauth/register/:client_id
 * 
 * Delete a dynamically registered client (RFC 7592)
 */
export async function handleClientDeletion(
  req: Request,
  res: Response,
  commands: Commands,
  _pool: DatabasePool
): Promise<void> {
  try {
    const clientID = req.params.client_id;

    // Get project and org from headers
    const projectID = (req.headers['x-zitadel-project'] as string) || 'default-project';
    const orgID = (req.headers['x-zitadel-orgid'] as string) || 'default-org';

    // Build context
    const ctx = {
      instanceID: (req.headers['x-zitadel-instance'] as string) || 'default',
      orgID,
      userID: (req.headers['x-zitadel-userid'] as string) || undefined,
    };

    // Delete client
    await commands.deleteClient(ctx, clientID, projectID, orgID);

    // RFC 7592: successful deletion returns 204 No Content
    res.status(204).send();
  } catch (error: any) {
    console.error('[Client Deletion] Error:', error);

    if (error.code === 'NOT_FOUND' || error.message?.includes('not found')) {
      res.status(404).json({
        error: 'invalid_client_id',
        error_description: 'Client not found',
      });
    } else if (error.code?.startsWith('COMMAND-') || error.code?.startsWith('ERRORS-')) {
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
