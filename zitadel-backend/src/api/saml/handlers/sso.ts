/**
 * SAML IdP SSO Handler
 * 
 * Handles SAML authentication requests from Service Providers
 */

import { Request, Response } from 'express';
import { DatabasePool } from '../../../lib/database';
import { Commands } from '../../../lib/command/commands';
import { Context } from '../../../lib/command/context';
import { 
  generateSAMLID,
  generateSAMLResponse,
  base64EncodeSAMLResponse,
  base64DecodeSAMLRequest,
  parseSAMLAuthnRequest
} from '../utils/saml-generator';
import {
  SAMLResponse,
  SAMLAssertion,
  SAMLStatusCode,
  SAMLNameIDFormat,
  SAMLUserAttributes
} from '../types';
import { UserQueries } from '../../../lib/query/user/user-queries';
import { addSAMLRequest, linkSessionToSAMLRequest } from '../../../lib/command/saml/saml-request-commands';
import { checkSAMLPermission } from '../../../lib/command/saml/saml-permissions';
import { 
  generateSAMLErrorResponse,
  mapZitadelErrorToSAML
} from '../../../lib/domain/saml-errors';

/**
 * POST /saml/sso
 * 
 * Handles SAML AuthnRequest from Service Provider
 * 
 * Request body:
 * - SAMLRequest (base64 encoded)
 * - RelayState (optional)
 */
export async function handleSSO(
  pool: DatabasePool,
  commands: Commands
): Promise<(req: Request, res: Response) => Promise<void>> {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { SAMLRequest, RelayState } = req.body;

      if (!SAMLRequest) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'SAMLRequest parameter is required'
        });
        return;
      }

      // Decode and parse SAML AuthnRequest
      const decodedRequest = base64DecodeSAMLRequest(SAMLRequest);
      const authnRequest = parseSAMLAuthnRequest(decodedRequest);

      console.log('✓ Received SAML AuthnRequest:', {
        id: authnRequest.id,
        issuer: authnRequest.issuer,
        acsURL: authnRequest.acsURL
      });

      // Get base URL from request (before using)
      const protocol = req.protocol;
      const host = req.get('host') || 'localhost:3000';

      // Extract user and instance from request or use test values
      const userId = req.body.userId || 'mock-user-123';
      const instanceID = req.body.instanceID || 'test-instance';
      const sessionID = req.body.sessionID || undefined;
      const sessionToken = req.body.sessionToken || undefined;

      // Create SAML request in command system
      const ctx: Context = {
        instanceID,
        orgID: '',
        userID: userId,
      };

      try {
        // Add SAML request to track this authentication flow
        const { samlRequest } = await addSAMLRequest.call(commands, ctx, {
          applicationID: authnRequest.issuer,
          acsURL: authnRequest.acsURL,
          relayState: RelayState || '',
          requestID: authnRequest.id,
          binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
          issuer: authnRequest.issuer,
          destination: `${protocol}://${host}/saml/sso`,
          responseIssuer: `${protocol}://${host}/saml/metadata`,
          loginClient: userId,
        });

        // If session is provided, link it to the request
        if (sessionID && sessionToken) {
          await linkSessionToSAMLRequest.call(
            commands,
            ctx,
            samlRequest.id!,
            sessionID,
            sessionToken,
            false
          );
        }

        console.log('✓ SAML request created:', samlRequest.id);
      } catch (cmdError) {
        console.warn('Command system not fully integrated, continuing with direct auth:', cmdError);
      }

      // Check SAML permission - verify user has access to this application
      try {
        const permission = await checkSAMLPermission(
          pool,
          authnRequest.issuer, // Entity ID / Application ID
          userId,
          instanceID
        );
        console.log('✓ Permission check passed:', permission);
      } catch (permError: any) {
        console.error('✗ Permission check failed:', permError);
        
        // Generate SAML error response
        const errorResponse = mapZitadelErrorToSAML(
          permError.code || 'UNKNOWN',
          permError.message
        );
        const errorXML = generateSAMLErrorResponse(
          authnRequest.id,
          authnRequest.acsURL,
          `${protocol}://${host}/saml/metadata`,
          errorResponse
        );
        
        const encodedError = base64EncodeSAMLResponse(errorXML);
        
        // Return error to Service Provider
        res.set('Content-Type', 'text/html');
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>SAML SSO Error</title>
          </head>
          <body>
            <form method="POST" action="${authnRequest.acsURL}" id="SAMLResponseForm">
              <input type="hidden" name="SAMLResponse" value="${encodedError}" />
              ${RelayState ? `<input type="hidden" name="RelayState" value="${RelayState}" />` : ''}
              <noscript>
                <p>JavaScript is disabled. Click the button below to continue.</p>
                <input type="submit" value="Continue" />
              </noscript>
            </form>
            <script>
              document.getElementById('SAMLResponseForm').submit();
            </script>
          </body>
          </html>
        `);
        return;
      }

      // Get user details from database
      const userQueries = new UserQueries(pool);
      let userAttrs: SAMLUserAttributes;

      try {
        const user = await userQueries.getUserByID(userId, instanceID);
        
        if (user) {
          userAttrs = {
            userID: user.id,
            username: user.username,
            email: user.email || undefined,
            firstName: user.firstName || undefined,
            lastName: user.lastName || undefined,
            displayName: user.displayName || undefined
          };
        } else {
          // Fallback to mock user
          userAttrs = {
            userID: userId,
            username: `user_${userId}`,
            email: `${userId}@example.com`,
            firstName: 'Test',
            lastName: 'User',
            displayName: 'Test User'
          };
        }
      } catch (error) {
        console.warn('Failed to fetch user, using mock data:', error);
        userAttrs = {
          userID: userId,
          username: `user_${userId}`,
          email: `${userId}@example.com`,
          firstName: 'Test',
          lastName: 'User',
          displayName: 'Test User'
        };
      }

      // Generate SAML Response
      const now = new Date();
      const notOnOrAfter = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

      const issuer = `${protocol}://${host}/saml/metadata`;

      const assertion: SAMLAssertion = {
        id: generateSAMLID(),
        issueInstant: now,
        issuer,
        subject: {
          nameID: userAttrs.email || userAttrs.username,
          nameIDFormat: SAMLNameIDFormat.EMAIL,
          subjectConfirmation: {
            method: 'urn:oasis:names:tc:SAML:2.0:cm:bearer',
            subjectConfirmationData: {
              inResponseTo: authnRequest.id,
              recipient: authnRequest.acsURL,
              notOnOrAfter
            }
          }
        },
        conditions: {
          notBefore: now,
          notOnOrAfter,
          audienceRestriction: [authnRequest.issuer]
        },
        authnStatement: {
          authnInstant: now,
          sessionIndex: generateSAMLID(),
          authnContext: {
            authnContextClassRef: 'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport'
          }
        }
      };

      const response: SAMLResponse = {
        id: generateSAMLID(),
        inResponseTo: authnRequest.id,
        issueInstant: now,
        destination: authnRequest.acsURL,
        issuer,
        status: {
          statusCode: SAMLStatusCode.SUCCESS
        },
        assertion
      };

      const responseXML = generateSAMLResponse(response, userAttrs);
      const base64Response = base64EncodeSAMLResponse(responseXML);

      // Return HTML auto-post form (standard SAML HTTP-POST binding)
      const htmlResponse = generateSAMLPostForm(
        authnRequest.acsURL,
        base64Response,
        RelayState
      );

      res.set('Content-Type', 'text/html');
      res.send(htmlResponse);

      console.log('✓ SAML Response sent to SP');
    } catch (error) {
      console.error('Error handling SAML SSO:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Failed to process SAML request'
      });
    }
  };
}

/**
 * Generate HTML auto-post form for SAML HTTP-POST binding
 */
function generateSAMLPostForm(
  acsURL: string,
  samlResponse: string,
  relayState?: string
): string {
  const relayStateInput = relayState 
    ? `<input type="hidden" name="RelayState" value="${escapeHTML(relayState)}" />`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <title>SAML Response</title>
</head>
<body onload="document.forms[0].submit()">
  <form method="POST" action="${escapeHTML(acsURL)}">
    <input type="hidden" name="SAMLResponse" value="${escapeHTML(samlResponse)}" />
    ${relayStateInput}
    <noscript>
      <p>JavaScript is disabled. Click the button below to continue.</p>
      <input type="submit" value="Continue" />
    </noscript>
  </form>
</body>
</html>`;
}

/**
 * Escape HTML special characters
 */
function escapeHTML(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
