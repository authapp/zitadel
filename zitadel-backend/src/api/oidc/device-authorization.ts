/**
 * Device Authorization Endpoint (RFC 8628)
 * 
 * OAuth 2.0 Device Authorization Grant
 * Used for devices without browsers (Smart TVs, CLI tools, IoT devices)
 * 
 * Endpoint: POST /oauth/device_authorization
 */

import { Request, Response } from 'express';
import { Commands } from '@/lib/command/commands';
import { DatabasePool } from '@/lib/database';
import { DeviceAuthRequest } from '@/lib/command/oauth/device-auth-commands';

/**
 * Device Authorization Request (RFC 8628 Section 3.1)
 */
interface DeviceAuthorizationRequest {
  client_id: string;
  scope?: string;
}

/**
 * Device Authorization Response (RFC 8628 Section 3.2)
 */
interface DeviceAuthorizationResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
}

/**
 * POST /oauth/device_authorization
 * 
 * Initiates device authorization flow
 * Returns device_code and user_code for user to enter
 */
export async function handleDeviceAuthorization(
  req: Request,
  res: Response,
  commands: Commands,
  _pool: DatabasePool
): Promise<void> {
  try {
    // 1. Parse request (form-urlencoded per RFC 8628)
    const { client_id, scope } = req.body as DeviceAuthorizationRequest;

    // 2. Validate required parameters
    if (!client_id) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'client_id is required',
      });
      return;
    }

    // 3. Parse scope
    const scopeArray = scope ? scope.split(' ') : [];

    // 4. Create device authorization via command
    const deviceAuthRequest: DeviceAuthRequest = {
      clientID: client_id,
      scope: scopeArray,
    };

    const ctx = {
      instanceID: req.headers['x-zitadel-instance'] as string || 'default',
      orgID: req.headers['x-zitadel-orgid'] as string || 'default',
      userID: undefined, // Device flow has no authenticated user yet
    };

    const result = await commands.addDeviceAuth(ctx, deviceAuthRequest);

    // 5. Return device authorization response
    const response: DeviceAuthorizationResponse = {
      device_code: result.deviceCode,
      user_code: result.userCode,
      verification_uri: result.verificationURI,
      verification_uri_complete: result.verificationURIComplete,
      expires_in: result.expiresIn,
      interval: result.interval,
    };

    res.status(200).json(response);
  } catch (error: any) {
    console.error('[Device Authorization] Error:', error);
    
    // Map error to OAuth error response
    if (error.code === 'COMMAND-DeviceAuth01') {
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

/**
 * POST /oauth/device
 * 
 * User approval endpoint
 * Called when user visits verification_uri and submits user_code
 */
export async function handleDeviceUserApproval(
  req: Request,
  res: Response,
  commands: Commands,
  _pool: DatabasePool
): Promise<void> {
  try {
    // 1. Parse request
    const { user_code, action } = req.body as {
      user_code: string;
      action: 'approve' | 'deny';
    };

    // 2. Validate required parameters
    if (!user_code) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'user_code is required',
      });
      return;
    }

    if (!action || (action !== 'approve' && action !== 'deny')) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'action must be "approve" or "deny"',
      });
      return;
    }

    // 3. Get authenticated user from session
    // TODO: Integrate with session management
    const userID = req.headers['x-zitadel-userid'] as string;
    
    if (!userID) {
      res.status(401).json({
        error: 'unauthorized',
        error_description: 'User must be authenticated',
      });
      return;
    }

    const ctx = {
      instanceID: req.headers['x-zitadel-instance'] as string || 'default',
      orgID: req.headers['x-zitadel-orgid'] as string || 'default',
      userID,
    };

    // 4. Approve or deny device authorization
    if (action === 'approve') {
      await commands.approveDeviceAuth(ctx, user_code, userID);
      res.status(200).json({
        success: true,
        message: 'Device approved successfully',
      });
    } else {
      await commands.denyDeviceAuth(ctx, user_code, userID);
      res.status(200).json({
        success: true,
        message: 'Device denied successfully',
      });
    }
  } catch (error: any) {
    console.error('[Device User Approval] Error:', error);
    
    // Map errors to user-friendly messages
    if (error.code?.startsWith('COMMAND-DeviceAuth') || error.message?.includes('device authorization')) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: error.message || 'Device authorization error',
      });
    } else if (error.code?.startsWith('COMMAND-') || error.name === 'ZitadelError') {
      res.status(400).json({
        error: 'invalid_request',
        error_description: error.message || 'Command error',
      });
    } else {
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error',
      });
    }
  }
}
