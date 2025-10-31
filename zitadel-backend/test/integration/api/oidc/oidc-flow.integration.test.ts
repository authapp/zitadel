/**
 * OIDC Flow Integration Tests
 * 
 * Tests complete OAuth2/OIDC flows end-to-end
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { Express } from 'express';
import { createServer } from '../../../../src/api/server';
import { Commands } from '../../../../src/lib/command/commands';
import { DatabasePool } from '../../../../src/lib/database';
import { createTestDatabase } from '../../setup';
import { setupCommandTest, CommandTestContext } from '../../../helpers/command-test-helpers';
import { getTokenStore, resetTokenStore } from '../../../../src/api/oidc/token-store';
import { KeyManager, resetKeyManager, setKeyManager } from '../../../../src/api/oidc/key-manager';

describe('OIDC Flow Integration Tests', () => {
  let app: Express;
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let keyManager: KeyManager;

  beforeAll(async () => {
    // Setup database and commands
    pool = await createTestDatabase();
    ctx = await setupCommandTest(pool);

    // Reset OIDC infrastructure
    resetTokenStore();
    resetKeyManager();
    keyManager = new KeyManager();
    await keyManager.initialize();
    
    // Set as singleton for server to use
    setKeyManager(keyManager);

    // Create test server
    app = createServer(ctx.commands, {
      port: 3001,
      host: 'localhost',
      environment: 'test', // Disable rate limiting for tests
      cors: { origin: '*', credentials: true },
    });
  });

  afterAll(async () => {
    // Reset global singletons to prevent interference with other tests
    resetKeyManager();
    resetTokenStore();
    
    await pool.close();
  });

  describe('Discovery Endpoint', () => {
    it('should return OpenID Connect Discovery metadata', async () => {
      const response = await request(app)
        .get('/.well-known/openid-configuration')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body.issuer).toBeDefined();
      expect(response.body.authorization_endpoint).toContain('/authorize');
      expect(response.body.token_endpoint).toContain('/token');
      expect(response.body.userinfo_endpoint).toContain('/userinfo');
      expect(response.body.jwks_uri).toContain('/jwks.json');
      expect(response.body.grant_types_supported).toContain('authorization_code');
      expect(response.body.response_types_supported).toContain('code');
      expect(response.body.scopes_supported).toContain('openid');
    });
  });

  describe('JWKS Endpoint', () => {
    it('should return public keys for JWT verification', async () => {
      const response = await request(app)
        .get('/.well-known/jwks.json')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body.keys).toBeInstanceOf(Array);
      expect(response.body.keys.length).toBeGreaterThan(0);

      const key = response.body.keys[0];
      expect(key.kty).toBe('RSA');
      expect(key.use).toBe('sig');
      expect(key.kid).toBeDefined();
      expect(key.alg).toBe('RS256');
      expect(key.n).toBeDefined(); // RSA modulus
      expect(key.e).toBeDefined(); // RSA exponent
    });

    it('should include Cache-Control header', async () => {
      const response = await request(app)
        .get('/.well-known/jwks.json')
        .expect(200);

      expect(response.headers['cache-control']).toContain('max-age=3600');
    });
  });

  describe('Authorization Endpoint', () => {
    it('should reject request without required parameters', async () => {
      const response = await request(app)
        .get('/oauth/v2/authorize')
        .expect(400);

      expect(response.body.error).toBe('invalid_request');
    });

    it('should reject unsupported response_type', async () => {
      const response = await request(app)
        .get('/oauth/v2/authorize')
        .query({
          client_id: 'test-client',
          redirect_uri: 'https://app.example.com/callback',
          response_type: 'unsupported',
          scope: 'openid',
        })
        .expect(400);

      expect(response.body.error).toBe('unsupported_response_type');
    });

    it('should generate authorization code for valid request', async () => {
      const response = await request(app)
        .get('/oauth/v2/authorize')
        .query({
          client_id: 'test-client',
          redirect_uri: 'https://app.example.com/callback',
          response_type: 'code',
          scope: 'openid profile',
          state: 'random-state',
          code_challenge: 'challenge123',
          code_challenge_method: 'S256',
        })
        .expect(302); // Redirect

      const location = response.headers['location'] as string;
      expect(location).toContain('https://app.example.com/callback');
      expect(location).toContain('code=');
      expect(location).toContain('state=random-state');
    });
  });

  describe('Token Endpoint', () => {
    it('should reject request without authorization', async () => {
      const response = await request(app)
        .post('/oauth/v2/token')
        .send({
          grant_type: 'authorization_code',
          code: 'invalid-code',
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should reject invalid authorization code', async () => {
      const response = await request(app)
        .post('/oauth/v2/token')
        .auth('test-client', 'test-secret')
        .send({
          grant_type: 'authorization_code',
          code: 'invalid-code',
          redirect_uri: 'https://app.example.com/callback',
        })
        .expect(400);

      expect(response.body.error).toBe('invalid_grant');
    });

    it('should exchange authorization code for tokens', async () => {
      // First get an authorization code
      const tokenStore = getTokenStore();
      const authCode = tokenStore.generateAuthorizationCode({
        client_id: 'test-client',
        redirect_uri: 'https://app.example.com/callback',
        scope: 'openid profile email',
        user_id: 'user-123',
        code_challenge: 'challenge123',
        code_challenge_method: 'plain',
      });

      // Exchange code for tokens
      const response = await request(app)
        .post('/oauth/v2/token')
        .auth('test-client', 'test-secret')
        .send({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: 'https://app.example.com/callback',
          code_verifier: 'challenge123',
        })
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body.access_token).toBeDefined();
      expect(response.body.token_type).toBe('Bearer');
      expect(response.body.expires_in).toBeDefined();
      expect(response.body.refresh_token).toBeDefined();
      expect(response.body.id_token).toBeDefined();
      expect(response.body.scope).toBe('openid profile email');
    });

    it('should refresh access token', async () => {
      // Generate a refresh token
      const tokenStore = getTokenStore();
      const refreshToken = tokenStore.generateRefreshToken({
        user_id: 'user-123',
        client_id: 'test-client',
        scope: 'openid profile',
      });

      const response = await request(app)
        .post('/oauth/v2/token')
        .auth('test-client', 'test-secret')
        .send({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        })
        .expect(200);

      expect(response.body.access_token).toBeDefined();
      expect(response.body.token_type).toBe('Bearer');
    });

    it('should support client credentials grant', async () => {
      const response = await request(app)
        .post('/oauth/v2/token')
        .auth('test-client', 'test-secret')
        .send({
          grant_type: 'client_credentials',
          scope: 'api:read api:write',
        })
        .expect(200);

      expect(response.body.access_token).toBeDefined();
      expect(response.body.token_type).toBe('Bearer');
      expect(response.body.scope).toBe('api:read api:write');
    });
  });

  describe('UserInfo Endpoint', () => {
    it('should reject request without bearer token', async () => {
      await request(app)
        .get('/oidc/v1/userinfo')
        .expect(401);
    });

    it('should reject invalid bearer token', async () => {
      await request(app)
        .get('/oidc/v1/userinfo')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should return user info for valid token', async () => {
      // Generate a valid access token
      const jwt = await keyManager.signJWT(
        {
          sub: 'user-123',
          scope: 'openid profile email',
        },
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/oidc/v1/userinfo')
        .set('Authorization', `Bearer ${jwt}`)
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body.sub).toBe('user-123');
      // Note: Returns mock data currently
    });
  });

  describe('Token Introspection Endpoint', () => {
    it('should require client authentication', async () => {
      await request(app)
        .post('/oauth/v2/introspect')
        .send({ token: 'some-token' })
        .expect(401);
    });

    it('should return active=false for invalid token', async () => {
      const response = await request(app)
        .post('/oauth/v2/introspect')
        .auth('test-client', 'test-secret')
        .send({ token: 'invalid-token' })
        .expect(200);

      expect(response.body.active).toBe(false);
    });

    it('should introspect valid access token', async () => {
      const jwt = await keyManager.signJWT(
        {
          sub: 'user-123',
          scope: 'openid profile',
          client_id: 'test-client',
        },
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post('/oauth/v2/introspect')
        .auth('test-client', 'test-secret')
        .send({ token: jwt })
        .expect(200);

      expect(response.body.active).toBe(true);
      expect(response.body.sub).toBe('user-123');
      expect(response.body.scope).toBe('openid profile');
    });
  });

  describe('Token Revocation Endpoint', () => {
    it('should require client authentication', async () => {
      await request(app)
        .post('/oauth/v2/revoke')
        .send({ token: 'some-token' })
        .expect(401);
    });

    it('should revoke refresh token', async () => {
      const tokenStore = getTokenStore();
      const refreshToken = tokenStore.generateRefreshToken({
        user_id: 'user-123',
        client_id: 'test-client',
        scope: 'openid',
      });

      await request(app)
        .post('/oauth/v2/revoke')
        .auth('test-client', 'test-secret')
        .send({
          token: refreshToken,
          token_type_hint: 'refresh_token',
        })
        .expect(200);

      // Verify token is revoked
      const revoked = tokenStore.getRefreshToken(refreshToken);
      expect(revoked).toBeNull();
    });

    it('should accept request without token_type_hint', async () => {
      await request(app)
        .post('/oauth/v2/revoke')
        .auth('test-client', 'test-secret')
        .send({ token: 'some-token' })
        .expect(200);
    });
  });

  describe('Complete Authorization Code Flow', () => {
    it('should complete full OAuth flow with PKCE', async () => {
      const tokenStore = getTokenStore();

      // Step 1: Authorization request (using plain PKCE for simplicity)
      const codeVerifier = 'test-code-verifier-1234567890';
      const authResponse = await request(app)
        .get('/oauth/v2/authorize')
        .query({
          client_id: 'test-client',
          redirect_uri: 'https://app.example.com/callback',
          response_type: 'code',
          scope: 'openid profile email',
          state: 'state123',
          code_challenge: codeVerifier, // Use plain method - challenge = verifier
          code_challenge_method: 'plain',
          nonce: 'nonce789',
        })
        .expect(302);

      const location = authResponse.headers['location'] as string;
      const code = new URL(location).searchParams.get('code');
      expect(code).not.toBeNull();

      // Step 2: Token exchange
      const tokenResponse = await request(app)
        .post('/oauth/v2/token')
        .auth('test-client', 'test-secret')
        .send({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: 'https://app.example.com/callback',
          code_verifier: codeVerifier, // Must match the challenge for 'plain' method
        })
        .expect(200);

      expect(tokenResponse.body.access_token).toBeDefined();
      expect(tokenResponse.body.refresh_token).toBeDefined();
      expect(tokenResponse.body.id_token).toBeDefined();

      const accessToken = tokenResponse.body.access_token;

      // Step 3: Get user info
      const userinfoResponse = await request(app)
        .get('/oidc/v1/userinfo')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(userinfoResponse.body.sub).toBeDefined();

      // Step 4: Introspect token
      const introspectResponse = await request(app)
        .post('/oauth/v2/introspect')
        .auth('test-client', 'test-secret')
        .send({ token: accessToken })
        .expect(200);

      expect(introspectResponse.body.active).toBe(true);

      // Step 5: Revoke refresh token
      await request(app)
        .post('/oauth/v2/revoke')
        .auth('test-client', 'test-secret')
        .send({
          token: tokenResponse.body.refresh_token,
          token_type_hint: 'refresh_token',
        })
        .expect(200);
    });
  });
});
