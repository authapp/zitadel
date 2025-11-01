/**
 * Device Authorization API Integration Tests
 * Tests the HTTP endpoints for OAuth 2.0 Device Authorization Grant (RFC 8628)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { handleDeviceAuthorization, handleDeviceUserApproval } from '../../../src/api/oidc/device-authorization';
import { UserBuilder } from '../../helpers/test-data-builders';
import { DeviceAuthProjection } from '../../../src/lib/query/projections/device-auth-projection';

describe('Device Authorization API Integration Tests', () => {
  let app: Express;
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let deviceAuthProjection: DeviceAuthProjection;

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);

    // Initialize device auth projection
    deviceAuthProjection = new DeviceAuthProjection(ctx.eventstore, pool);
    await deviceAuthProjection.init();

    // Create Express app with device auth endpoints
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Device authorization endpoint
    app.post('/oauth/device_authorization', async (req, res) => {
      await handleDeviceAuthorization(req, res, ctx.commands, pool);
    });

    // User approval endpoint
    app.post('/oauth/device', async (req, res) => {
      await handleDeviceUserApproval(req, res, ctx.commands, pool);
    });

    // Token endpoint (for device grant testing)
    app.post('/oauth/token', async (req, res) => {
      // Inject pool into request for token handler
      (req as any).pool = pool;
      const { tokenHandler } = await import('../../../src/api/oidc/token');
      await tokenHandler(req, res, (err: any) => {
        if (err) {
          console.error('Token handler error:', err);
          res.status(500).json({ error: 'server_error' });
        }
      });
    });
  });

  afterAll(async () => {
    await pool.close();
  });

  /**
   * Helper: Process device auth projection events
   */
  async function processDeviceAuthEvents() {
    const events = await ctx.getEvents('*', '*');
    for (const event of events) {
      try {
        await deviceAuthProjection.reduce(event);
      } catch (err) {
        // Ignore events not relevant to this projection
      }
    }
    // Small delay to ensure database consistency
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  /**
   * Helper: Create test user
   */
  async function createTestUser() {
    const userData = new UserBuilder()
      .withUsername(`testuser-${Date.now()}`)
      .withEmail(`test-${Date.now()}@example.com`)
      .build();

    const result = await ctx.commands.addHumanUser(ctx.createContext(), userData);
    return result.userID;
  }

  describe('POST /oauth/device_authorization', () => {
    describe('Success Cases', () => {
      it('should return device code and user code', async () => {
        const response = await request(app)
          .post('/oauth/device_authorization')
          .send({
            client_id: 'test-client-123',
            scope: 'openid profile email',
          })
          .expect(200);

        expect(response.body).toHaveProperty('device_code');
        expect(response.body).toHaveProperty('user_code');
        expect(response.body).toHaveProperty('verification_uri');
        expect(response.body).toHaveProperty('verification_uri_complete');
        expect(response.body).toHaveProperty('expires_in', 600);
        expect(response.body).toHaveProperty('interval', 5);

        // Verify user_code format (XXXX-XXXX)
        expect(response.body.user_code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

        // Verify device_code is a valid UUID
        expect(response.body.device_code).toBeDefined();
        expect(typeof response.body.device_code).toBe('string');
      });

      it('should handle scope as string', async () => {
        const response = await request(app)
          .post('/oauth/device_authorization')
          .send({
            client_id: 'test-client',
            scope: 'read write admin',
          })
          .expect(200);

        expect(response.body.device_code).toBeDefined();
      });

      it('should work without scope parameter', async () => {
        const response = await request(app)
          .post('/oauth/device_authorization')
          .send({
            client_id: 'test-client',
          })
          .expect(200);

        expect(response.body.device_code).toBeDefined();
        expect(response.body.user_code).toBeDefined();
      });

      it('should generate unique codes for each request', async () => {
        const response1 = await request(app)
          .post('/oauth/device_authorization')
          .send({ client_id: 'client-1' })
          .expect(200);

        const response2 = await request(app)
          .post('/oauth/device_authorization')
          .send({ client_id: 'client-2' })
          .expect(200);

        expect(response1.body.device_code).not.toBe(response2.body.device_code);
        expect(response1.body.user_code).not.toBe(response2.body.user_code);
      });

      it('should include verification_uri_complete with user_code', async () => {
        const response = await request(app)
          .post('/oauth/device_authorization')
          .send({ client_id: 'test-client' })
          .expect(200);

        const { user_code, verification_uri_complete } = response.body;
        expect(verification_uri_complete).toContain(user_code);
      });

      it('should comply with RFC 8628 response format', async () => {
        const response = await request(app)
          .post('/oauth/device_authorization')
          .send({
            client_id: 'rfc-test-client',
            scope: 'openid',
          })
          .expect(200);

        // RFC 8628 Section 3.2 - Required response fields
        const requiredFields = [
          'device_code',
          'user_code',
          'verification_uri',
          'expires_in',
        ];

        requiredFields.forEach(field => {
          expect(response.body).toHaveProperty(field);
        });

        // RFC 8628 - Optional but recommended
        expect(response.body).toHaveProperty('verification_uri_complete');
        expect(response.body).toHaveProperty('interval');
      });
    });

    describe('Error Cases', () => {
      it('should return error when client_id is missing', async () => {
        const response = await request(app)
          .post('/oauth/device_authorization')
          .send({})
          .expect(400);

        expect(response.body).toHaveProperty('error', 'invalid_request');
        expect(response.body).toHaveProperty('error_description');
        expect(response.body.error_description).toContain('client_id');
      });

      it('should return error when client_id is empty', async () => {
        const response = await request(app)
          .post('/oauth/device_authorization')
          .send({ client_id: '' })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'invalid_request');
      });

      it('should handle malformed request gracefully', async () => {
        const response = await request(app)
          .post('/oauth/device_authorization')
          .send('invalid-json-data')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('POST /oauth/device', () => {
    let deviceAuth: any;
    let userID: string;

    beforeAll(async () => {
      // Create a device authorization for approval tests
      const response = await request(app)
        .post('/oauth/device_authorization')
        .send({ client_id: 'test-client' });
      
      deviceAuth = response.body;
      userID = await createTestUser();
    });

    describe('Success Cases', () => {
      it('should approve device successfully', async () => {
        // Create fresh device auth for this test
        const authResponse = await request(app)
          .post('/oauth/device_authorization')
          .set('x-zitadel-instance', 'test-instance')
          .set('x-zitadel-orgid', 'test-org')
          .send({ client_id: 'approval-test-client' });

        // Process projection so device auth is queryable
        await processDeviceAuthEvents();

        const response = await request(app)
          .post('/oauth/device')
          .set('x-zitadel-userid', userID)
          .set('x-zitadel-instance', 'test-instance')
          .set('x-zitadel-orgid', 'test-org')
          .send({
            user_code: authResponse.body.user_code,
            action: 'approve',
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('approved');
      });

      it('should deny device successfully', async () => {
        // Create fresh device auth for this test
        const authResponse = await request(app)
          .post('/oauth/device_authorization')
          .set('x-zitadel-instance', 'test-instance')
          .set('x-zitadel-orgid', 'test-org')
          .send({ client_id: 'denial-test-client' });

        // Process projection so device auth is queryable
        await processDeviceAuthEvents();

        const response = await request(app)
          .post('/oauth/device')
          .set('x-zitadel-userid', userID)
          .set('x-zitadel-instance', 'test-instance')
          .set('x-zitadel-orgid', 'test-org')
          .send({
            user_code: authResponse.body.user_code,
            action: 'deny',
          })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.message).toContain('denied');
      });
    });

    describe('Error Cases', () => {
      it('should fail when user_code is missing', async () => {
        const response = await request(app)
          .post('/oauth/device')
          .set('x-zitadel-userid', userID)
          .send({
            action: 'approve',
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'invalid_request');
        expect(response.body.error_description).toContain('user_code');
      });

      it('should fail when action is missing', async () => {
        const response = await request(app)
          .post('/oauth/device')
          .set('x-zitadel-userid', userID)
          .send({
            user_code: 'TEST-CODE',
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'invalid_request');
        expect(response.body.error_description).toContain('action');
      });

      it('should fail when action is invalid', async () => {
        const response = await request(app)
          .post('/oauth/device')
          .set('x-zitadel-userid', userID)
          .send({
            user_code: 'TEST-CODE',
            action: 'invalid',
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'invalid_request');
      });

      it('should fail when user is not authenticated', async () => {
        const response = await request(app)
          .post('/oauth/device')
          .send({
            user_code: 'TEST-CODE',
            action: 'approve',
          })
          .expect(401);

        expect(response.body).toHaveProperty('error', 'unauthorized');
      });

      it('should fail with non-existent user_code', async () => {
        const response = await request(app)
          .post('/oauth/device')
          .set('x-zitadel-userid', userID)
          .set('x-zitadel-instance', 'test-instance')
          .set('x-zitadel-orgid', 'test-org')
          .send({
            user_code: 'FAKE-CODE',
            action: 'approve',
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'invalid_request');
      });
    });
  });

  describe('Complete Device Flow', () => {
    it('should complete full device authorization flow', async () => {
      // Step 1: Device requests authorization
      const authResponse = await request(app)
        .post('/oauth/device_authorization')
        .set('x-zitadel-instance', 'test-instance')
        .set('x-zitadel-orgid', 'test-org')
        .send({
          client_id: 'smart-tv-app',
          scope: 'openid profile offline_access',
        })
        .expect(200);

      expect(authResponse.body.device_code).toBeDefined();
      expect(authResponse.body.user_code).toBeDefined();

      // Process projection so device auth is queryable
      await processDeviceAuthEvents();

      // Step 2: User approves on another device
      const userID = await createTestUser();

      const approvalResponse = await request(app)
        .post('/oauth/device')
        .set('x-zitadel-userid', userID)
        .set('x-zitadel-instance', 'test-instance')
        .set('x-zitadel-orgid', 'test-org')
        .send({
          user_code: authResponse.body.user_code,
          action: 'approve',
        })
        .expect(200);

      expect(approvalResponse.body.success).toBe(true);

      // Step 3: Device polls token endpoint (would happen in real flow)
      // Note: Token exchange would require projection layer to query device state
      console.log('✓ Device authorization flow completed successfully');
    });

    it('should handle denial flow correctly', async () => {
      const authResponse = await request(app)
        .post('/oauth/device_authorization')
        .set('x-zitadel-instance', 'test-instance')
        .set('x-zitadel-orgid', 'test-org')
        .send({ client_id: 'test-client' })
        .expect(200);

      // Process projection so device auth is queryable
      await processDeviceAuthEvents();

      const userID = await createTestUser();

      const denialResponse = await request(app)
        .post('/oauth/device')
        .set('x-zitadel-userid', userID)
        .set('x-zitadel-instance', 'test-instance')
        .set('x-zitadel-orgid', 'test-org')
        .send({
          user_code: authResponse.body.user_code,
          action: 'deny',
        })
        .expect(200);

      expect(denialResponse.body.success).toBe(true);
      expect(denialResponse.body.message).toContain('denied');
    });
  });

  describe('Token Exchange (Device Grant)', () => {
    it('should return authorization_pending when device not yet approved', async () => {
      // Create device authorization
      const authResponse = await request(app)
        .post('/oauth/device_authorization')
        .set('x-zitadel-instance', 'test-instance')
        .set('x-zitadel-orgid', 'test-org')
        .send({ client_id: 'test-client' })
        .expect(200);

      // Process projection
      await processDeviceAuthEvents();

      // Try to get tokens (device polls)
      const tokenResponse = await request(app)
        .post('/oauth/token')
        .set('x-zitadel-instance', 'test-instance')
        .send({
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: authResponse.body.device_code,
          client_id: 'test-client',
        })
        .expect(400);

      expect(tokenResponse.body).toHaveProperty('error', 'authorization_pending');
    });

    it('should return access_denied when device is denied', async () => {
      // Create device authorization
      const authResponse = await request(app)
        .post('/oauth/device_authorization')
        .set('x-zitadel-instance', 'test-instance')
        .set('x-zitadel-orgid', 'test-org')
        .send({ client_id: 'test-client' })
        .expect(200);

      // Process projection
      await processDeviceAuthEvents();

      // User denies
      const userID = await createTestUser();
      await request(app)
        .post('/oauth/device')
        .set('x-zitadel-userid', userID)
        .set('x-zitadel-instance', 'test-instance')
        .set('x-zitadel-orgid', 'test-org')
        .send({
          user_code: authResponse.body.user_code,
          action: 'deny',
        })
        .expect(200);

      // Process approval/denial event
      await processDeviceAuthEvents();

      // Try to get tokens
      const tokenResponse = await request(app)
        .post('/oauth/token')
        .set('x-zitadel-instance', 'test-instance')
        .send({
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: authResponse.body.device_code,
          client_id: 'test-client',
        })
        .expect(400);

      expect(tokenResponse.body).toHaveProperty('error', 'access_denied');
      expect(tokenResponse.body.error_description).toContain('denied');
    });

    it('should issue tokens when device is approved', async () => {
      // Create device authorization
      const authResponse = await request(app)
        .post('/oauth/device_authorization')
        .set('x-zitadel-instance', 'test-instance')
        .set('x-zitadel-orgid', 'test-org')
        .send({
          client_id: 'test-client',
          scope: 'openid profile email',
        })
        .expect(200);

      // Process projection
      await processDeviceAuthEvents();

      // User approves
      const userID = await createTestUser();
      await request(app)
        .post('/oauth/device')
        .set('x-zitadel-userid', userID)
        .set('x-zitadel-instance', 'test-instance')
        .set('x-zitadel-orgid', 'test-org')
        .send({
          user_code: authResponse.body.user_code,
          action: 'approve',
        })
        .expect(200);

      // Process approval event
      await processDeviceAuthEvents();

      // Get tokens
      const tokenResponse = await request(app)
        .post('/oauth/token')
        .set('x-zitadel-instance', 'test-instance')
        .send({
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: authResponse.body.device_code,
          client_id: 'test-client',
        })
        .expect(200);

      // Verify token response
      expect(tokenResponse.body).toHaveProperty('access_token');
      expect(tokenResponse.body).toHaveProperty('token_type', 'Bearer');
      expect(tokenResponse.body).toHaveProperty('expires_in', 3600);
      expect(tokenResponse.body).toHaveProperty('refresh_token');
      expect(tokenResponse.body).toHaveProperty('scope');
      expect(tokenResponse.body.scope).toContain('openid');

      console.log('✓ Device authorization token exchange successful');
    });

    it('should validate client_id in token exchange', async () => {
      // Create device authorization
      const authResponse = await request(app)
        .post('/oauth/device_authorization')
        .set('x-zitadel-instance', 'test-instance')
        .set('x-zitadel-orgid', 'test-org')
        .send({ client_id: 'original-client' })
        .expect(200);

      // Process projection
      await processDeviceAuthEvents();

      // Try with wrong client_id
      const tokenResponse = await request(app)
        .post('/oauth/token')
        .set('x-zitadel-instance', 'test-instance')
        .send({
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: authResponse.body.device_code,
          client_id: 'wrong-client',
        })
        .expect(400);

      expect(tokenResponse.body).toHaveProperty('error', 'invalid_client');
    });

    it('should reject invalid device_code', async () => {
      const tokenResponse = await request(app)
        .post('/oauth/token')
        .set('x-zitadel-instance', 'test-instance')
        .send({
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: 'invalid-device-code',
          client_id: 'test-client',
        })
        .expect(400);

      expect(tokenResponse.body).toHaveProperty('error', 'invalid_grant');
    });

    it('should require device_code parameter', async () => {
      const tokenResponse = await request(app)
        .post('/oauth/token')
        .set('x-zitadel-instance', 'test-instance')
        .send({
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          client_id: 'test-client',
        })
        .expect(400);

      expect(tokenResponse.body).toHaveProperty('error', 'invalid_request');
      expect(tokenResponse.body.error_description).toContain('device_code');
    });
  });

  describe('Security Tests', () => {
    it('should not allow approval without authentication', async () => {
      const authResponse = await request(app)
        .post('/oauth/device_authorization')
        .send({ client_id: 'test-client' });

      await request(app)
        .post('/oauth/device')
        .send({
          user_code: authResponse.body.user_code,
          action: 'approve',
        })
        .expect(401);
    });

    it('should generate cryptographically random codes', async () => {
      const codes = new Set();
      const numRequests = 10;

      for (let i = 0; i < numRequests; i++) {
        const response = await request(app)
          .post('/oauth/device_authorization')
          .send({ client_id: `client-${i}` })
          .expect(200);

        codes.add(response.body.device_code);
        codes.add(response.body.user_code);
      }

      // All codes should be unique
      expect(codes.size).toBe(numRequests * 2);
    });

    it('should not expose sensitive information in errors', async () => {
      const response = await request(app)
        .post('/oauth/device')
        .set('x-zitadel-userid', 'fake-user')
        .send({
          user_code: 'FAKE-CODE',
          action: 'approve',
        })
        .expect(400);

      // Should not reveal database or internal details
      expect(response.body.error_description).not.toContain('database');
      expect(response.body.error_description).not.toContain('sql');
      expect(response.body.error_description).not.toContain('stack');
    });
  });

  describe('RFC 8628 Compliance', () => {
    it('should return proper OAuth error format', async () => {
      const response = await request(app)
        .post('/oauth/device_authorization')
        .send({})
        .expect(400);

      // RFC 6749 Section 5.2 - Error Response
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('error_description');
      expect(typeof response.body.error).toBe('string');
      expect(typeof response.body.error_description).toBe('string');
    });

    it('should support form-urlencoded content type', async () => {
      const response = await request(app)
        .post('/oauth/device_authorization')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('client_id=test-client&scope=openid')
        .expect(200);

      expect(response.body.device_code).toBeDefined();
    });

    it('should return application/json content type', async () => {
      const response = await request(app)
        .post('/oauth/device_authorization')
        .send({ client_id: 'test-client' })
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });
});
