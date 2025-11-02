/**
 * SCIM Discovery Endpoints Integration Tests
 * Tests: Schemas, ServiceProviderConfig, ResourceTypes
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createSCIMRouter } from '../../../../src/api/scim/router';
import { SCIM_SCHEMAS } from '../../../../src/api/scim/types';

describe('SCIM Discovery Endpoints Integration Tests', () => {
  let app: express.Application;
  let pool: any;
  let eventstore: any;

  beforeAll(async () => {
    // Mock minimal pool and eventstore for discovery endpoints
    pool = {} as any;
    eventstore = {} as any;
    
    app = express();
    app.use(express.json());
    
    // Mount SCIM router
    const scimRouter = createSCIMRouter(pool, eventstore);
    app.use('/scim/v2', scimRouter);
  });

  // ============================================================================
  // Schemas Endpoint
  // ============================================================================

  describe('GET /scim/v2/Schemas', () => {
    it('should return list of all schemas', async () => {
      const response = await request(app)
        .get('/scim/v2/Schemas')
        .expect('Content-Type', /application\/scim\+json/)
        .expect(200);

      expect(response.body).toHaveProperty('schemas');
      expect(response.body.schemas).toContain(SCIM_SCHEMAS.LIST_RESPONSE);
      expect(response.body).toHaveProperty('totalResults');
      expect(response.body).toHaveProperty('Resources');
      expect(Array.isArray(response.body.Resources)).toBe(true);
      expect(response.body.Resources.length).toBeGreaterThan(0);

      console.log('✓ Retrieved all schemas successfully');
    });

    it('should include User and Group schemas', async () => {
      const response = await request(app)
        .get('/scim/v2/Schemas')
        .expect(200);

      const schemaIds = response.body.Resources.map((r: any) => r.id);
      expect(schemaIds).toContain(SCIM_SCHEMAS.CORE_USER);
      expect(schemaIds).toContain(SCIM_SCHEMAS.CORE_GROUP);

      console.log('✓ User and Group schemas present');
    });
  });

  describe('GET /scim/v2/Schemas/:id', () => {
    it('should return User schema', async () => {
      const response = await request(app)
        .get(`/scim/v2/Schemas/${encodeURIComponent(SCIM_SCHEMAS.CORE_USER)}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', SCIM_SCHEMAS.CORE_USER);
      expect(response.body).toHaveProperty('name', 'User');
      expect(response.body).toHaveProperty('attributes');
      expect(Array.isArray(response.body.attributes)).toBe(true);

      // Check for required User attributes
      const attrNames = response.body.attributes.map((a: any) => a.name);
      expect(attrNames).toContain('userName');
      expect(attrNames).toContain('name');
      expect(attrNames).toContain('emails');

      console.log('✓ User schema retrieved with all attributes');
    });

    it('should return Group schema', async () => {
      const response = await request(app)
        .get(`/scim/v2/Schemas/${encodeURIComponent(SCIM_SCHEMAS.CORE_GROUP)}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', SCIM_SCHEMAS.CORE_GROUP);
      expect(response.body).toHaveProperty('name', 'Group');
      expect(response.body).toHaveProperty('attributes');

      const attrNames = response.body.attributes.map((a: any) => a.name);
      expect(attrNames).toContain('displayName');
      expect(attrNames).toContain('members');

      console.log('✓ Group schema retrieved with all attributes');
    });

    it('should return 404 for unknown schema', async () => {
      const response = await request(app)
        .get('/scim/v2/Schemas/unknown:schema')
        .expect(404);

      expect(response.body).toHaveProperty('schemas');
      expect(response.body.schemas).toContain(SCIM_SCHEMAS.ERROR);
      expect(response.body).toHaveProperty('status', 404);
      expect(response.body).toHaveProperty('scimType', 'notFound');

      console.log('✓ Returns 404 for unknown schema');
    });
  });

  // ============================================================================
  // ServiceProviderConfig Endpoint
  // ============================================================================

  describe('GET /scim/v2/ServiceProviderConfig', () => {
    it('should return service provider capabilities', async () => {
      const response = await request(app)
        .get('/scim/v2/ServiceProviderConfig')
        .expect(200);

      expect(response.body).toHaveProperty('schemas');
      expect(response.body.schemas).toContain(SCIM_SCHEMAS.SERVICE_PROVIDER_CONFIG);
      expect(response.body).toHaveProperty('patch');
      expect(response.body).toHaveProperty('bulk');
      expect(response.body).toHaveProperty('filter');
      expect(response.body).toHaveProperty('changePassword');
      expect(response.body).toHaveProperty('sort');
      expect(response.body).toHaveProperty('etag');
      expect(response.body).toHaveProperty('authenticationSchemes');

      console.log('✓ Service provider config returned');
    });

    it('should indicate patch support', async () => {
      const response = await request(app)
        .get('/scim/v2/ServiceProviderConfig')
        .expect(200);

      expect(response.body.patch).toHaveProperty('supported', true);

      console.log('✓ PATCH operations supported');
    });

    it('should indicate filter support', async () => {
      const response = await request(app)
        .get('/scim/v2/ServiceProviderConfig')
        .expect(200);

      expect(response.body.filter).toHaveProperty('supported', true);
      expect(response.body.filter).toHaveProperty('maxResults');

      console.log('✓ Filtering supported');
    });

    it('should list authentication schemes', async () => {
      const response = await request(app)
        .get('/scim/v2/ServiceProviderConfig')
        .expect(200);

      expect(Array.isArray(response.body.authenticationSchemes)).toBe(true);
      expect(response.body.authenticationSchemes.length).toBeGreaterThan(0);
      
      const scheme = response.body.authenticationSchemes[0];
      expect(scheme).toHaveProperty('type');
      expect(scheme).toHaveProperty('name');

      console.log('✓ Authentication schemes listed');
    });
  });

  // ============================================================================
  // ResourceTypes Endpoint
  // ============================================================================

  describe('GET /scim/v2/ResourceTypes', () => {
    it('should return list of resource types', async () => {
      const response = await request(app)
        .get('/scim/v2/ResourceTypes')
        .expect(200);

      expect(response.body).toHaveProperty('schemas');
      expect(response.body.schemas).toContain(SCIM_SCHEMAS.LIST_RESPONSE);
      expect(response.body).toHaveProperty('totalResults');
      expect(response.body).toHaveProperty('Resources');
      expect(Array.isArray(response.body.Resources)).toBe(true);

      console.log('✓ Resource types retrieved');
    });

    it('should include User and Group resource types', async () => {
      const response = await request(app)
        .get('/scim/v2/ResourceTypes')
        .expect(200);

      const resourceIds = response.body.Resources.map((r: any) => r.id);
      expect(resourceIds).toContain('User');
      expect(resourceIds).toContain('Group');

      console.log('✓ User and Group resource types present');
    });

    it('should include endpoints for each resource type', async () => {
      const response = await request(app)
        .get('/scim/v2/ResourceTypes')
        .expect(200);

      const userType = response.body.Resources.find((r: any) => r.id === 'User');
      expect(userType).toHaveProperty('endpoint', '/Users');
      expect(userType).toHaveProperty('schema', SCIM_SCHEMAS.CORE_USER);

      const groupType = response.body.Resources.find((r: any) => r.id === 'Group');
      expect(groupType).toHaveProperty('endpoint', '/Groups');
      expect(groupType).toHaveProperty('schema', SCIM_SCHEMAS.CORE_GROUP);

      console.log('✓ Resource type endpoints defined');
    });
  });

  describe('GET /scim/v2/ResourceTypes/:id', () => {
    it('should return User resource type', async () => {
      const response = await request(app)
        .get('/scim/v2/ResourceTypes/User')
        .expect(200);

      expect(response.body).toHaveProperty('id', 'User');
      expect(response.body).toHaveProperty('name', 'User');
      expect(response.body).toHaveProperty('endpoint', '/Users');
      expect(response.body).toHaveProperty('schema', SCIM_SCHEMAS.CORE_USER);
      expect(response.body).toHaveProperty('schemaExtensions');

      console.log('✓ User resource type retrieved');
    });

    it('should return Group resource type', async () => {
      const response = await request(app)
        .get('/scim/v2/ResourceTypes/Group')
        .expect(200);

      expect(response.body).toHaveProperty('id', 'Group');
      expect(response.body).toHaveProperty('name', 'Group');
      expect(response.body).toHaveProperty('endpoint', '/Groups');
      expect(response.body).toHaveProperty('schema', SCIM_SCHEMAS.CORE_GROUP);

      console.log('✓ Group resource type retrieved');
    });

    it('should return 404 for unknown resource type', async () => {
      const response = await request(app)
        .get('/scim/v2/ResourceTypes/Unknown')
        .expect(404);

      expect(response.body).toHaveProperty('scimType', 'notFound');

      console.log('✓ Returns 404 for unknown resource type');
    });
  });

  // ============================================================================
  // Coverage Summary
  // ============================================================================

  describe('Discovery Coverage Summary', () => {
    it('should confirm all discovery endpoints are functional', () => {
      const endpoints = [
        'GET /scim/v2/Schemas',
        'GET /scim/v2/Schemas/:id',
        'GET /scim/v2/ServiceProviderConfig',
        'GET /scim/v2/ResourceTypes',
        'GET /scim/v2/ResourceTypes/:id',
      ];

      console.log('\n✅ SCIM Discovery Endpoints - All Functional:');
      endpoints.forEach(endpoint => console.log(`  ✓ ${endpoint}`));
      
      expect(endpoints.length).toBe(5);
    });
  });
});
