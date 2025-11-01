/**
 * Dynamic Client Registration Integration Tests (RFC 7591 & RFC 7592)
 * 
 * Tests OAuth 2.0 Dynamic Client Registration Protocol
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { DatabasePool } from '../../../src/lib/database';
import { createTestDatabase } from '../setup';
import { setupCommandTest, CommandTestContext } from '../../helpers/command-test-helpers';
import { handleClientRegistration, handleClientUpdate, handleClientDeletion } from '../../../src/api/oidc/client-registration';
import { AppProjection } from '../../../src/lib/query/projections/app-projection';

describe('Dynamic Client Registration API Tests (RFC 7591/7592)', () => {
  let app: Express;
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let appProjection: AppProjection;
  let testOrgId: string;
  let testProjectId: string;
  let testUserId: string;

  beforeAll(async () => {
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);

    // Initialize app projection
    appProjection = new AppProjection(ctx.eventstore, pool);
    await appProjection.init();

    // Create test organization and project
    const testContext = ctx.createContext();
    
    // Create organization
    const orgResult = await ctx.commands.setupOrg(testContext, {
      name: 'DCR Test Org',
      admins: [{
        username: `admin-${Date.now()}`,
        email: `admin-${Date.now()}@test.com`,
        firstName: 'Test',
        lastName: 'Admin',
      }],
    });
    testOrgId = orgResult.orgID;
    testUserId = orgResult.createdAdmins[0].userID;
    
    // Create project
    const projectResult = await ctx.commands.addProject(
      { ...testContext, orgID: testOrgId, userID: testUserId },
      {
        orgID: testOrgId,
        name: 'DCR Test Project',
      }
    );
    testProjectId = projectResult.projectID;

    // Create Express app with client registration endpoints
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Client registration endpoint
    app.post('/oauth/register', async (req, res) => {
      // Override headers with test user for permission checks
      req.headers['x-zitadel-userid'] = testUserId;
      await handleClientRegistration(req, res, ctx.commands, pool);
    });

    // Client update endpoint
    app.put('/oauth/register/:client_id', async (req, res) => {
      req.headers['x-zitadel-userid'] = testUserId;
      await handleClientUpdate(req, res, ctx.commands, pool);
    });

    // Client deletion endpoint
    app.delete('/oauth/register/:client_id', async (req, res) => {
      req.headers['x-zitadel-userid'] = testUserId;
      await handleClientDeletion(req, res, ctx.commands, pool);
    });
  });

  afterAll(async () => {
    await pool.close();
  });

  /**
   * Helper: Process app projection events
   */
  async function processAppEvents() {
    const events = await ctx.getEvents('*', '*');
    for (const event of events) {
      try {
        await appProjection.reduce(event);
      } catch (err) {
        // Ignore events not relevant to this projection
      }
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  describe('POST /oauth/register - Client Registration (RFC 7591)', () => {
    describe('Success Cases', () => {
      it('should register a web application successfully', async () => {
        const response = await request(app)
          .post('/oauth/register')
          .set('x-zitadel-instance', 'test-instance')
          .set('x-zitadel-orgid', testOrgId)
          .set('x-zitadel-project', testProjectId)
          .send({
            redirect_uris: ['https://app.example.com/callback'],
            client_name: 'Test Web App',
            application_type: 'web',
            grant_types: ['authorization_code'],
            response_types: ['code'],
            token_endpoint_auth_method: 'client_secret_basic',
          })
          .expect(201);

        // Verify response structure (RFC 7591 Section 3.2.1)
        expect(response.body).toHaveProperty('client_id');
        expect(response.body).toHaveProperty('client_secret');
        expect(response.body).toHaveProperty('client_id_issued_at');
        expect(response.body).toHaveProperty('client_secret_expires_at', 0);
        expect(response.body).toHaveProperty('redirect_uris');
        expect(response.body).toHaveProperty('grant_types');
        expect(response.body).toHaveProperty('response_types');
        expect(response.body).toHaveProperty('token_endpoint_auth_method', 'client_secret_basic');
        expect(response.body.client_name).toBe('Test Web App');

        console.log('✓ Web application registered:', response.body.client_id);
      });

      it('should register a native application with custom scheme', async () => {
        const response = await request(app)
          .post('/oauth/register')
          .set('x-zitadel-instance', 'test-instance')
          .set('x-zitadel-orgid', testOrgId)
          .set('x-zitadel-project', testProjectId)
          .send({
            redirect_uris: ['myapp://callback', 'http://localhost:8080/callback'],
            client_name: 'Test Mobile App',
            application_type: 'native',
            token_endpoint_auth_method: 'none',
          })
          .expect(201);

        expect(response.body).toHaveProperty('client_id');
        expect(response.body).not.toHaveProperty('client_secret'); // Public client
        expect(response.body.client_name).toBe('Test Mobile App');
        expect(response.body.token_endpoint_auth_method).toBe('none');

        console.log('✓ Native application registered:', response.body.client_id);
      });

      it('should register with multiple redirect URIs', async () => {
        const response = await request(app)
          .post('/oauth/register')
          .set('x-zitadel-instance', 'test-instance')
          .set('x-zitadel-orgid', testOrgId)
          .set('x-zitadel-project', testProjectId)
          .send({
            redirect_uris: [
              'https://app.example.com/callback',
              'https://app.example.com/callback2',
              'https://beta.example.com/callback',
            ],
            client_name: 'Multi-URI App',
          })
          .expect(201);

        expect(response.body.redirect_uris).toHaveLength(3);
        console.log('✓ Multiple redirect URIs registered');
      });

      it('should register with all optional metadata', async () => {
        const response = await request(app)
          .post('/oauth/register')
          .set('x-zitadel-instance', 'test-instance')
          .set('x-zitadel-orgid', testOrgId)
          .set('x-zitadel-project', testProjectId)
          .send({
            redirect_uris: ['https://app.example.com/callback'],
            client_name: 'Full Metadata App',
            client_uri: 'https://app.example.com',
            logo_uri: 'https://app.example.com/logo.png',
            tos_uri: 'https://app.example.com/tos',
            policy_uri: 'https://app.example.com/privacy',
            contacts: ['admin@example.com'],
            scope: 'openid profile email',
          })
          .expect(201);

        expect(response.body.client_uri).toBe('https://app.example.com');
        expect(response.body.logo_uri).toBe('https://app.example.com/logo.png');
        expect(response.body.contacts).toEqual(['admin@example.com']);
        expect(response.body.scope).toBe('openid profile email');

        console.log('✓ Full metadata registration successful');
      });

      it('should support different auth methods', async () => {
        const authMethods = ['client_secret_basic', 'client_secret_post', 'none'];

        for (const method of authMethods) {
          const response = await request(app)
            .post('/oauth/register')
            .set('x-zitadel-instance', 'test-instance')
            .set('x-zitadel-orgid', testOrgId)
            .set('x-zitadel-project', testProjectId)
            .send({
              redirect_uris: ['https://app.example.com/callback'],
              client_name: `App with ${method}`,
              token_endpoint_auth_method: method,
            })
            .expect(201);

          expect(response.body.token_endpoint_auth_method).toBe(method);
          
          if (method === 'none') {
            expect(response.body).not.toHaveProperty('client_secret');
          } else {
            expect(response.body).toHaveProperty('client_secret');
          }
        }

        console.log('✓ All auth methods supported');
      });
    });

    describe('Error Cases', () => {
      it('should fail without redirect_uris', async () => {
        const response = await request(app)
          .post('/oauth/register')
          .set('x-zitadel-instance', 'test-instance')
          .set('x-zitadel-orgid', testOrgId)
          .set('x-zitadel-project', testProjectId)
          .send({
            client_name: 'No Redirect URIs',
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'invalid_client_metadata');
        expect(response.body.error_description).toContain('redirect_uris');
      });

      it('should fail with empty redirect_uris array', async () => {
        const response = await request(app)
          .post('/oauth/register')
          .set('x-zitadel-instance', 'test-instance')
          .set('x-zitadel-orgid', testOrgId)
          .set('x-zitadel-project', testProjectId)
          .send({
            redirect_uris: [],
            client_name: 'Empty Redirect URIs',
          })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });

      it('should fail with invalid redirect URI', async () => {
        const response = await request(app)
          .post('/oauth/register')
          .set('x-zitadel-instance', 'test-instance')
          .set('x-zitadel-orgid', testOrgId)
          .set('x-zitadel-project', testProjectId)
          .send({
            redirect_uris: ['not-a-valid-uri'],
            client_name: 'Invalid URI',
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'invalid_client_metadata');
      });

      it('should enforce HTTPS for web apps', async () => {
        const response = await request(app)
          .post('/oauth/register')
          .set('x-zitadel-instance', 'test-instance')
          .set('x-zitadel-orgid', testOrgId)
          .set('x-zitadel-project', testProjectId)
          .send({
            redirect_uris: ['http://app.example.com/callback'],
            application_type: 'web',
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'invalid_client_metadata');
        expect(response.body.error_description).toContain('HTTPS');
      });

      it('should allow localhost HTTP for web apps', async () => {
        const response = await request(app)
          .post('/oauth/register')
          .set('x-zitadel-instance', 'test-instance')
          .set('x-zitadel-orgid', testOrgId)
          .set('x-zitadel-project', testProjectId)
          .send({
            redirect_uris: ['http://localhost:8080/callback'],
            application_type: 'web',
          })
          .expect(201);

        expect(response.body.redirect_uris).toContain('http://localhost:8080/callback');
      });

      it('should validate grant_type and response_type compatibility', async () => {
        const response = await request(app)
          .post('/oauth/register')
          .set('x-zitadel-instance', 'test-instance')
          .set('x-zitadel-orgid', testOrgId)
          .set('x-zitadel-project', testProjectId)
          .send({
            redirect_uris: ['https://app.example.com/callback'],
            grant_types: ['authorization_code'],
            response_types: ['token'], // Mismatch
          })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'invalid_client_metadata');
        expect(response.body.error_description).toContain('code response type');
      });
    });
  });

  describe('PUT /oauth/register/:client_id - Client Update (RFC 7592)', () => {
    let clientId: string;

    beforeEach(async () => {
      // Register a client first
      const response = await request(app)
        .post('/oauth/register')
        .set('x-zitadel-instance', 'test-instance')
        .set('x-zitadel-orgid', testOrgId)
        .set('x-zitadel-project', testProjectId)
        .send({
          redirect_uris: ['https://app.example.com/callback'],
          client_name: 'To Be Updated',
        })
        .expect(201);

      clientId = response.body.client_id;
      
      // Process projection
      await processAppEvents();
    });

    describe('Success Cases', () => {
      it('should update client name', async () => {
        const response = await request(app)
          .put(`/oauth/register/${clientId}`)
          .set('x-zitadel-instance', 'test-instance')
          .set('x-zitadel-orgid', testOrgId)
          .set('x-zitadel-project', testProjectId)
          .send({
            client_name: 'Updated Client Name',
          })
          .expect(200);

        expect(response.body.client_name).toBe('Updated Client Name');
        console.log('✓ Client name updated');
      });

      it('should update redirect URIs', async () => {
        const response = await request(app)
          .put(`/oauth/register/${clientId}`)
          .set('x-zitadel-instance', 'test-instance')
          .set('x-zitadel-orgid', testOrgId)
          .set('x-zitadel-project', testProjectId)
          .send({
            redirect_uris: [
              'https://app.example.com/new-callback',
              'https://app.example.com/callback2',
            ],
          })
          .expect(200);

        expect(response.body.redirect_uris).toHaveLength(2);
        console.log('✓ Redirect URIs updated');
      });

      it('should update grant types', async () => {
        const response = await request(app)
          .put(`/oauth/register/${clientId}`)
          .set('x-zitadel-instance', 'test-instance')
          .set('x-zitadel-orgid', testOrgId)
          .set('x-zitadel-project', testProjectId)
          .send({
            grant_types: ['authorization_code', 'refresh_token'],
          })
          .expect(200);

        expect(response.body.grant_types).toContain('refresh_token');
        console.log('✓ Grant types updated');
      });
    });

    describe('Error Cases', () => {
      it('should fail with non-existent client_id', async () => {
        const response = await request(app)
          .put('/oauth/register/non-existent-client-id')
          .set('x-zitadel-instance', 'test-instance')
          .set('x-zitadel-orgid', testOrgId)
          .set('x-zitadel-project', testProjectId)
          .send({
            client_name: 'Updated Name',
          })
          .expect(404);

        expect(response.body).toHaveProperty('error', 'invalid_client_id');
      });
    });
  });

  describe('DELETE /oauth/register/:client_id - Client Deletion (RFC 7592)', () => {
    let clientId: string;

    beforeEach(async () => {
      // Register a client first
      const response = await request(app)
        .post('/oauth/register')
        .set('x-zitadel-instance', 'test-instance')
        .set('x-zitadel-orgid', testOrgId)
        .set('x-zitadel-project', testProjectId)
        .send({
          redirect_uris: ['https://app.example.com/callback'],
          client_name: 'To Be Deleted',
        })
        .expect(201);

      clientId = response.body.client_id;
      
      // Process projection
      await processAppEvents();
    });

    describe('Success Cases', () => {
      it('should delete client successfully', async () => {
        await request(app)
          .delete(`/oauth/register/${clientId}`)
          .set('x-zitadel-instance', 'test-instance')
          .set('x-zitadel-orgid', testOrgId)
          .set('x-zitadel-project', testProjectId)
          .expect(204);

        console.log('✓ Client deleted successfully');
      });
    });

    describe('Error Cases', () => {
      it('should fail with non-existent client_id', async () => {
        const response = await request(app)
          .delete('/oauth/register/non-existent-client-id')
          .set('x-zitadel-instance', 'test-instance')
          .set('x-zitadel-orgid', testOrgId)
          .set('x-zitadel-project', testProjectId)
          .expect(404);

        expect(response.body).toHaveProperty('error', 'invalid_client_id');
      });
    });
  });

  describe('RFC Compliance', () => {
    it('should return proper RFC 7591 response format', async () => {
      const response = await request(app)
        .post('/oauth/register')
        .set('x-zitadel-instance', 'test-instance')
        .set('x-zitadel-orgid', testOrgId)
        .set('x-zitadel-project', testProjectId)
        .send({
          redirect_uris: ['https://app.example.com/callback'],
        })
        .expect(201);

      // RFC 7591 Section 3.2.1 - Required fields
      expect(response.body).toHaveProperty('client_id');
      expect(typeof response.body.client_id).toBe('string');
      expect(response.body.client_id).toMatch(/^[0-9a-f-]+$/);

      expect(response.body).toHaveProperty('client_id_issued_at');
      expect(typeof response.body.client_id_issued_at).toBe('number');

      // Optional but should be present if secret was issued
      if (response.body.client_secret) {
        expect(response.body).toHaveProperty('client_secret_expires_at');
      }

      console.log('✓ RFC 7591 compliance verified');
    });

    it('should support application/json content type', async () => {
      const response = await request(app)
        .post('/oauth/register')
        .set('Content-Type', 'application/json')
        .set('x-zitadel-instance', 'test-instance')
        .set('x-zitadel-orgid', testOrgId)
        .set('x-zitadel-project', testProjectId)
        .send(JSON.stringify({
          redirect_uris: ['https://app.example.com/callback'],
        }))
        .expect(201);

      expect(response.body).toHaveProperty('client_id');
    });

    it('should return application/json response', async () => {
      const response = await request(app)
        .post('/oauth/register')
        .set('x-zitadel-instance', 'test-instance')
        .set('x-zitadel-orgid', testOrgId)
        .set('x-zitadel-project', testProjectId)
        .send({
          redirect_uris: ['https://app.example.com/callback'],
        })
        .expect(201);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Complete Lifecycle', () => {
    it('should handle complete client lifecycle', async () => {
      console.log('\n--- Complete Client Lifecycle ---');

      // 1. Register client
      console.log('Step 1: Register client');
      const registerResponse = await request(app)
        .post('/oauth/register')
        .set('x-zitadel-instance', 'test-instance')
        .set('x-zitadel-orgid', testOrgId)
        .set('x-zitadel-project', testProjectId)
        .send({
          redirect_uris: ['https://app.example.com/callback'],
          client_name: 'Lifecycle Test App',
          application_type: 'web',
        })
        .expect(201);

      const clientId = registerResponse.body.client_id;
      expect(clientId).toBeDefined();
      console.log(`  ✓ Client registered: ${clientId}`);

      // Process projection
      await processAppEvents();

      // 2. Update client
      console.log('Step 2: Update client metadata');
      await request(app)
        .put(`/oauth/register/${clientId}`)
        .set('x-zitadel-instance', 'test-instance')
        .set('x-zitadel-orgid', testOrgId)
        .set('x-zitadel-project', testProjectId)
        .send({
          client_name: 'Updated Lifecycle App',
          redirect_uris: ['https://app.example.com/new-callback'],
        })
        .expect(200);
      console.log('  ✓ Client updated');

      // Process projection
      await processAppEvents();

      // 3. Delete client
      console.log('Step 3: Delete client');
      await request(app)
        .delete(`/oauth/register/${clientId}`)
        .set('x-zitadel-instance', 'test-instance')
        .set('x-zitadel-orgid', testOrgId)
        .set('x-zitadel-project', testProjectId)
        .expect(204);
      console.log('  ✓ Client deleted');

      console.log('✓ Complete lifecycle successful\n');
    });
  });
});
