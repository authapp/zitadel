/**
 * Discovery Endpoint Tests
 */

import { describe, it, expect } from '@jest/globals';
import { getDiscoveryConfiguration } from '../../../../src/api/oidc/discovery';

describe('OIDC Discovery', () => {
  describe('getDiscoveryConfiguration', () => {
    it('should return complete discovery metadata', () => {
      const baseUrl = 'https://auth.example.com';
      const config = getDiscoveryConfiguration(baseUrl);

      expect(config.issuer).toBe(baseUrl);
      expect(config.authorization_endpoint).toBe(`${baseUrl}/oauth/v2/authorize`);
      expect(config.token_endpoint).toBe(`${baseUrl}/oauth/v2/token`);
      expect(config.userinfo_endpoint).toBe(`${baseUrl}/oidc/v1/userinfo`);
      expect(config.jwks_uri).toBe(`${baseUrl}/.well-known/jwks.json`);
      expect(config.revocation_endpoint).toBe(`${baseUrl}/oauth/v2/revoke`);
      expect(config.introspection_endpoint).toBe(`${baseUrl}/oauth/v2/introspect`);
      expect(config.end_session_endpoint).toBe(`${baseUrl}/oidc/v1/end_session`);
    });

    it('should include all required response types', () => {
      const config = getDiscoveryConfiguration('https://auth.example.com');

      expect(config.response_types_supported).toContain('code');
      expect(config.response_types_supported).toContain('id_token');
      expect(config.response_types_supported).toContain('code id_token');
      expect(config.response_types_supported).toContain('code token');
    });

    it('should include all required grant types', () => {
      const config = getDiscoveryConfiguration('https://auth.example.com');

      expect(config.grant_types_supported).toContain('authorization_code');
      expect(config.grant_types_supported).toContain('implicit');
      expect(config.grant_types_supported).toContain('refresh_token');
      expect(config.grant_types_supported).toContain('client_credentials');
      expect(config.grant_types_supported).toContain('password');
    });

    it('should support PKCE', () => {
      const config = getDiscoveryConfiguration('https://auth.example.com');

      expect(config.code_challenge_methods_supported).toContain('S256');
      expect(config.code_challenge_methods_supported).toContain('plain');
    });

    it('should include standard OIDC scopes', () => {
      const config = getDiscoveryConfiguration('https://auth.example.com');

      expect(config.scopes_supported).toContain('openid');
      expect(config.scopes_supported).toContain('profile');
      expect(config.scopes_supported).toContain('email');
      expect(config.scopes_supported).toContain('address');
      expect(config.scopes_supported).toContain('phone');
      expect(config.scopes_supported).toContain('offline_access');
    });

    it('should include standard claims', () => {
      const config = getDiscoveryConfiguration('https://auth.example.com');

      expect(config.claims_supported).toContain('sub');
      expect(config.claims_supported).toContain('email');
      expect(config.claims_supported).toContain('email_verified');
      expect(config.claims_supported).toContain('name');
      expect(config.claims_supported).toContain('given_name');
      expect(config.claims_supported).toContain('family_name');
    });

    it('should support multiple response modes', () => {
      const config = getDiscoveryConfiguration('https://auth.example.com');

      expect(config.response_modes_supported).toContain('query');
      expect(config.response_modes_supported).toContain('fragment');
      expect(config.response_modes_supported).toContain('form_post');
    });

    it('should support RS256 signing algorithm', () => {
      const config = getDiscoveryConfiguration('https://auth.example.com');

      expect(config.id_token_signing_alg_values_supported).toContain('RS256');
    });

    it('should include multiple token endpoint auth methods', () => {
      const config = getDiscoveryConfiguration('https://auth.example.com');

      expect(config.token_endpoint_auth_methods_supported).toContain('client_secret_basic');
      expect(config.token_endpoint_auth_methods_supported).toContain('client_secret_post');
      expect(config.token_endpoint_auth_methods_supported).toContain('private_key_jwt');
      expect(config.token_endpoint_auth_methods_supported).toContain('none');
    });

    it('should support subject type public', () => {
      const config = getDiscoveryConfiguration('https://auth.example.com');

      expect(config.subject_types_supported).toContain('public');
    });

    it('should enable request parameter support', () => {
      const config = getDiscoveryConfiguration('https://auth.example.com');

      expect(config.request_parameter_supported).toBe(true);
      expect(config.claims_parameter_supported).toBe(true);
    });

    it('should disable request_uri parameter', () => {
      const config = getDiscoveryConfiguration('https://auth.example.com');

      expect(config.request_uri_parameter_supported).toBe(false);
      expect(config.require_request_uri_registration).toBe(false);
    });
  });
});
