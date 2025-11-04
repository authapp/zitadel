/**
 * SAML Single Logout (SLO) Integration Tests
 * 
 * Tests SAML logout endpoint and session termination
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createTestDatabase } from '../../setup';
import { setupCommandTest, CommandTestContext } from '../../../helpers/command-test-helpers';
import { DatabasePool } from '../../../../src/lib/database';
import { createSAMLRouter } from '../../../../src/api/saml/router';
import { generateSAMLID } from '../../../../src/api/saml/utils/saml-generator';

describe('SAML Logout Integration Tests', () => {
  let app: express.Application;
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let testInstanceID: string;
  let testOrgID: string;
  let testUserID: string;

  beforeAll(async () => {
    // Initialize database
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);
    testInstanceID = 'test-instance';

    // Create test organization and user
    const orgResult = await ctx.commands.addOrg(ctx.createContext(), {
      name: 'Logout Test Org',
    });
    testOrgID = orgResult.orgID;

    const userResult = await ctx.commands.addHumanUser(ctx.createContext(), {
      orgID: testOrgID,
      username: 'logoutuser',
      email: 'logout@example.com',
      emailVerified: true,
      firstName: 'Logout',
      lastName: 'User',
      password: 'TestPassword123!',
    });
    testUserID = userResult.userID;

    // Create Express app with SAML router
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    const samlRouter = createSAMLRouter(pool, ctx.commands);
    app.use('/saml', samlRouter);

    console.log('\n=== SAML Logout Test Setup Complete ===\n');
  }, 30000);

  afterAll(async () => {
    if (ctx?.eventstore) {
      await ctx.eventstore.close();
    }
  }, 10000);

  describe('POST /saml/logout', () => {
    it('should return 400 if SAMLRequest is missing', async () => {
      const response = await request(app)
        .post('/saml/logout')
        .send({});

      expect(response.status).toBe(400);
      expect(response.text).toContain('Missing SAMLRequest parameter');
    });

    it('should handle invalid SAMLRequest gracefully', async () => {
      const response = await request(app)
        .post('/saml/logout')
        .send({
          SAMLRequest: 'invalid-base64-data',
        });

      // Returns 400 Bad Request for invalid SAMLRequest (correct behavior)
      expect(response.status).toBe(400);
      expect(response.text).toContain('Missing SAMLRequest parameter');
    });

    it('should accept valid SAMLRequest with SessionIndex', async () => {
      // Generate a minimal SAML LogoutRequest
      const requestID = generateSAMLID();
      const logoutRequest = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                     xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                     ID="${requestID}"
                     Version="2.0"
                     IssueInstant="${new Date().toISOString()}"
                     Destination="http://localhost/saml/logout">
  <saml:Issuer>https://sp.example.com/metadata</saml:Issuer>
  <saml:NameID>${testUserID}</saml:NameID>
  <saml:SessionIndex>session-123</saml:SessionIndex>
</samlp:LogoutRequest>`;

      const base64Request = Buffer.from(logoutRequest).toString('base64');

      const response = await request(app)
        .post('/saml/logout')
        .send({
          SAMLRequest: base64Request,
          RelayState: 'test-relay-state',
        });

      // Should return HTML form with base64-encoded LogoutResponse
      expect(response.status).toBe(200);
      expect(response.text).toContain('<!DOCTYPE html>');
      expect(response.text).toContain('SAMLResponse');
      
      // Extract and decode SAMLResponse
      const match = response.text.match(/name="SAMLResponse" value="([^"]+)"/);
      expect(match).toBeTruthy();
      const samlResponseXML = Buffer.from(match![1], 'base64').toString('utf8');
      
      // Verify SAML LogoutResponse structure
      expect(samlResponseXML).toContain('<?xml version="1.0"');
      expect(samlResponseXML).toContain('samlp:LogoutResponse');
      expect(samlResponseXML).toContain(`InResponseTo="${requestID}"`);
      expect(samlResponseXML).toContain('urn:oasis:names:tc:SAML:2.0:status:Success');
      expect(samlResponseXML).toContain('Logout successful');
      
      console.log('✓ SAML LogoutRequest processed successfully');
    });

    it('should handle LogoutRequest without SessionIndex', async () => {
      const requestID = generateSAMLID();
      const logoutRequest = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                     xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                     ID="${requestID}"
                     Version="2.0"
                     IssueInstant="${new Date().toISOString()}">
  <saml:Issuer>https://sp.example.com/metadata</saml:Issuer>
  <saml:NameID>${testUserID}</saml:NameID>
</samlp:LogoutRequest>`;

      const base64Request = Buffer.from(logoutRequest).toString('base64');

      const response = await request(app)
        .post('/saml/logout')
        .send({
          SAMLRequest: base64Request,
        });

      expect(response.status).toBe(200);
      expect(response.text).toContain('SAMLResponse');
      
      // Extract and decode SAMLResponse
      const match = response.text.match(/name="SAMLResponse" value="([^"]+)"/);
      expect(match).toBeTruthy();
      const samlResponseXML = Buffer.from(match![1], 'base64').toString('utf8');
      
      expect(samlResponseXML).toContain('samlp:LogoutResponse');
      expect(samlResponseXML).toContain('urn:oasis:names:tc:SAML:2.0:status:Success');
      console.log('✓ LogoutRequest without SessionIndex handled');
    });

    it('should be idempotent - multiple logout calls succeed', async () => {
      const requestID = generateSAMLID();
      const logoutRequest = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                     xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                     ID="${requestID}"
                     Version="2.0"
                     IssueInstant="${new Date().toISOString()}">
  <saml:Issuer>https://sp.example.com/metadata</saml:Issuer>
  <saml:NameID>${testUserID}</saml:NameID>
  <saml:SessionIndex>idempotent-session</saml:SessionIndex>
</samlp:LogoutRequest>`;

      const base64Request = Buffer.from(logoutRequest).toString('base64');

      // First call
      const response1 = await request(app)
        .post('/saml/logout')
        .send({ SAMLRequest: base64Request });

      expect(response1.status).toBe(200);
      
      // Decode and verify first response
      const match1 = response1.text.match(/name="SAMLResponse" value="([^"]+)"/);
      expect(match1).toBeTruthy();
      const samlXML1 = Buffer.from(match1![1], 'base64').toString('utf8');
      expect(samlXML1).toContain('urn:oasis:names:tc:SAML:2.0:status:Success');

      // Second call with same request should also succeed (idempotent)
      const response2 = await request(app)
        .post('/saml/logout')
        .send({ SAMLRequest: base64Request });

      expect(response2.status).toBe(200);
      
      // Decode and verify second response
      const match2 = response2.text.match(/name="SAMLResponse" value="([^"]+)"/);
      expect(match2).toBeTruthy();
      const samlXML2 = Buffer.from(match2![1], 'base64').toString('utf8');
      expect(samlXML2).toContain('urn:oasis:names:tc:SAML:2.0:status:Success');
      
      console.log('✓ Logout is idempotent');
    });
  });

  describe('SAML Logout Response Format', () => {
    it('should return valid SAML LogoutResponse XML', async () => {
      const requestID = generateSAMLID();
      const logoutRequest = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                     xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                     ID="${requestID}"
                     Version="2.0"
                     IssueInstant="${new Date().toISOString()}">
  <saml:Issuer>https://sp.example.com/metadata</saml:Issuer>
  <saml:NameID>${testUserID}</saml:NameID>
</samlp:LogoutRequest>`;

      const base64Request = Buffer.from(logoutRequest).toString('base64');

      const response = await request(app)
        .post('/saml/logout')
        .send({ SAMLRequest: base64Request });

      expect(response.status).toBe(200);
      
      // Extract SAMLResponse from HTML form
      const match = response.text.match(/name="SAMLResponse" value="([^"]+)"/);
      expect(match).toBeTruthy();
      
      // Decode base64 to get XML
      const samlResponseXML = Buffer.from(match![1], 'base64').toString('utf8');

      // Verify SAML 2.0 structure in decoded XML
      expect(samlResponseXML).toContain('<?xml version="1.0"');
      expect(samlResponseXML).toContain('samlp:LogoutResponse');
      expect(samlResponseXML).toContain(`InResponseTo="${requestID}"`);
      expect(samlResponseXML).toContain('samlp:Status');
      expect(samlResponseXML).toContain('samlp:StatusCode');
      expect(samlResponseXML).toContain('urn:oasis:names:tc:SAML:2.0:status:Success');
      expect(samlResponseXML).toContain('samlp:StatusMessage');
      expect(samlResponseXML).toContain('Logout successful');
      
      // Verify HTML form structure
      expect(response.text).toContain('<!DOCTYPE html>');
      expect(response.text).toContain('<form method="post"');
      expect(response.text).toContain('name="SAMLResponse"');
      
      console.log('✓ LogoutResponse has valid SAML 2.0 structure');
    });
  });
});
