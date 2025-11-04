/**
 * SAML Single Logout (SLO) Handler
 * 
 * Handles SAML LogoutRequest from Service Providers
 * Based on SAML 2.0 Single Logout Profile
 */

import { Request, Response } from 'express';
import { DatabasePool } from '../../../lib/database';
import { Commands } from '../../../lib/command/commands';
import { generateSAMLLogoutResponse, generateSAMLErrorResponse } from '../utils/saml-generator';
import { parseSAMLLogoutRequest } from '../parsers/logout-request';

/**
 * Handle SAML LogoutRequest from Service Provider
 * 
 * Flow:
 * 1. Parse LogoutRequest from SP
 * 2. Find SAML session by NameID or SessionIndex
 * 3. Terminate SAML session
 * 4. Generate LogoutResponse
 * 5. Send back to SP via HTTP-POST or HTTP-Redirect
 */
export async function handleLogout(
  pool: DatabasePool,
  commands: Commands
): Promise<(req: Request, res: Response) => Promise<void>> {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      console.log('✓ Received SAML LogoutRequest');

      // 1. Parse LogoutRequest
      const { samlRequest, relayState, binding } = await parseSAMLLogoutRequest(req);
      
      if (!samlRequest) {
        console.error('✗ Missing SAMLRequest parameter');
        res.status(400).send('Missing SAMLRequest parameter');
      return;
      }

      console.log('✓ Parsed SAML LogoutRequest:', {
        id: samlRequest.id,
        issuer: samlRequest.issuer,
        nameID: samlRequest.nameID,
        sessionIndex: samlRequest.sessionIndex,
      });

      // 2. Find SAML session by SessionIndex or NameID
      let samlSessionID: string | null = null;

      if (samlRequest.sessionIndex) {
        // Query by session index (SAML response ID)
        const result = await pool.queryOne<{ id: string }>(
          `SELECT id FROM projections.saml_sessions 
           WHERE saml_response_id = $1 AND state = 'active'
           LIMIT 1`,
          [samlRequest.sessionIndex]
        );
        samlSessionID = result?.id || null;
      }

      if (!samlSessionID && samlRequest.nameID) {
        // Fallback: Query by user ID (extracted from NameID)
        // In production, you'd parse the NameID format properly
        const result = await pool.queryOne<{ id: string }>(
          `SELECT id FROM projections.saml_sessions 
           WHERE user_id = $1 AND entity_id = $2 AND state = 'active'
           ORDER BY creation_date DESC
           LIMIT 1`,
          [samlRequest.nameID, samlRequest.issuer]
        );
        samlSessionID = result?.id || null;
      }

      if (!samlSessionID) {
        console.log('⚠️  SAML session not found or already terminated');
        // Still return success (idempotent logout)
        const logoutResponse = generateSAMLLogoutResponse({
          inResponseTo: samlRequest.id,
          destination: samlRequest.issuer, // SP's logout response endpoint
          success: true,
          statusMessage: 'Logout successful',
        });

        sendLogoutResponse(res, logoutResponse, relayState, binding);
        return;
      }

      // 3. Terminate SAML session
      try {
        await commands.terminateSAMLSession(
          { instanceID: 'default', userID: 'system', orgID: 'system' },
          samlSessionID
        );
        console.log('✓ SAML session terminated:', samlSessionID);
      } catch (error: any) {
        console.error('✗ Failed to terminate SAML session:', error.message);
        // Continue anyway - session might already be terminated
      }

      // 4. Generate successful LogoutResponse
      const logoutResponse = generateSAMLLogoutResponse({
        inResponseTo: samlRequest.id,
        destination: samlRequest.issuer,
        success: true,
        statusMessage: 'Logout successful',
      });

      console.log('✓ SAML LogoutResponse generated');

      // 5. Send LogoutResponse back to SP
      sendLogoutResponse(res, logoutResponse, relayState, binding);
      return;

    } catch (error: any) {
      console.error('✗ SAML Logout error:', error.message);

      // Generate SAML error response
      const errorResponse = generateSAMLErrorResponse({
        statusCode: 'urn:oasis:names:tc:SAML:2.0:status:Responder',
        statusMessage: error.message || 'Logout failed',
        inResponseTo: 'unknown',
        destination: ''
      });

      res.status(500).send(errorResponse);
      return;
    }
  };
}

/**
 * Send LogoutResponse to Service Provider
 * 
 * Supports HTTP-POST and HTTP-Redirect bindings
 */
function sendLogoutResponse(
  res: Response,
  logoutResponse: string,
  relayState: string | undefined,
  binding: 'HTTP-POST' | 'HTTP-Redirect'
): void {
  if (binding === 'HTTP-POST') {
    // HTTP-POST binding: Return HTML form that auto-submits
    const base64Response = Buffer.from(logoutResponse).toString('base64');
    const relayStateInput = relayState
      ? `<input type="hidden" name="RelayState" value="${relayState}" />`
      : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>SAML Logout</title></head>
      <body onload="document.forms[0].submit()">
        <form method="post" action="DESTINATION_URL">
          <input type="hidden" name="SAMLResponse" value="${base64Response}" />
          ${relayStateInput}
          <noscript>
            <p>JavaScript is disabled. Click the button below to continue.</p>
            <input type="submit" value="Continue Logout" />
          </noscript>
        </form>
      </body>
      </html>
    `;

    res.set('Content-Type', 'text/html');
    res.send(html);
  } else {
    // HTTP-Redirect binding: Redirect with SAMLResponse in query string
    const base64Response = encodeURIComponent(
      Buffer.from(logoutResponse).toString('base64')
    );
    const relayStateParam = relayState ? `&RelayState=${encodeURIComponent(relayState)}` : '';
    const redirectUrl = `DESTINATION_URL?SAMLResponse=${base64Response}${relayStateParam}`;

    res.redirect(302, redirectUrl);
  }
}
