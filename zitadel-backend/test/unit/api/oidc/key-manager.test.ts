/**
 * Key Manager Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { KeyManager, resetKeyManager } from '../../../../src/api/oidc/key-manager';

describe('KeyManager', () => {
  let keyManager: KeyManager;

  beforeEach(async () => {
    resetKeyManager();
    keyManager = new KeyManager();
    await keyManager.initialize();
  });

  describe('initialize', () => {
    it('should generate a default key pair', async () => {
      const currentKey = keyManager.getCurrentKey();
      
      expect(currentKey).not.toBeNull();
      expect(currentKey!.kid).toBeDefined();
      expect(currentKey!.algorithm).toBe('RS256');
      expect(currentKey!.publicKey).toBeDefined();
      expect(currentKey!.privateKey).toBeDefined();
    });
  });

  describe('generateKeyPair', () => {
    it('should generate a new RSA key pair', async () => {
      const keyPair = await keyManager.generateKeyPair();
      
      expect(keyPair.kid).toBeDefined();
      expect(keyPair.algorithm).toBe('RS256');
      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
      expect(keyPair.createdAt).toBeInstanceOf(Date);
    });

    it('should generate unique key IDs', async () => {
      const keyPair1 = await keyManager.generateKeyPair();
      const keyPair2 = await keyManager.generateKeyPair();
      
      expect(keyPair1.kid).not.toBe(keyPair2.kid);
    });
  });

  describe('getCurrentKey', () => {
    it('should return the current signing key', () => {
      const currentKey = keyManager.getCurrentKey();
      
      expect(currentKey).not.toBeNull();
      expect(currentKey!.kid).toBeDefined();
    });

    it('should return null when no keys exist', () => {
      const emptyKeyManager = new KeyManager();
      
      expect(emptyKeyManager.getCurrentKey()).toBeNull();
    });
  });

  describe('getKey', () => {
    it('should retrieve a key by ID', async () => {
      const keyPair = await keyManager.generateKeyPair();
      const retrieved = keyManager.getKey(keyPair.kid);
      
      expect(retrieved).not.toBeNull();
      expect(retrieved!.kid).toBe(keyPair.kid);
    });

    it('should return null for non-existent key ID', () => {
      const retrieved = keyManager.getKey('non-existent-id');
      
      expect(retrieved).toBeNull();
    });
  });

  describe('getAllKeys', () => {
    it('should return all key pairs', async () => {
      const initialKeys = keyManager.getAllKeys();
      const initialCount = initialKeys.length;
      
      await keyManager.generateKeyPair();
      const updatedKeys = keyManager.getAllKeys();
      
      expect(updatedKeys.length).toBe(initialCount + 1);
    });
  });

  describe('signJWT', () => {
    it('should sign a JWT with the current key', async () => {
      const payload = { sub: 'user123', name: 'Test User' };
      const jwt = await keyManager.signJWT(payload, { expiresIn: '1h' });
      
      expect(jwt).toBeDefined();
      expect(typeof jwt).toBe('string');
      expect(jwt.split('.')).toHaveLength(3); // header.payload.signature
    });

    it('should include kid in JWT header', async () => {
      const payload = { sub: 'user123' };
      const jwt = await keyManager.signJWT(payload);
      
      const headerBase64 = jwt.split('.')[0];
      const header = JSON.parse(Buffer.from(headerBase64, 'base64url').toString());
      
      expect(header.kid).toBeDefined();
      expect(header.alg).toBe('RS256');
      expect(header.typ).toBe('JWT');
    });

    it('should sign with specific key ID', async () => {
      const newKeyPair = await keyManager.generateKeyPair();
      const payload = { sub: 'user123' };
      const jwt = await keyManager.signJWT(payload, { kid: newKeyPair.kid });
      
      const headerBase64 = jwt.split('.')[0];
      const header = JSON.parse(Buffer.from(headerBase64, 'base64url').toString());
      
      expect(header.kid).toBe(newKeyPair.kid);
    });

    it('should throw error when no key available', async () => {
      const emptyKeyManager = new KeyManager();
      
      await expect(
        emptyKeyManager.signJWT({ sub: 'user123' })
      ).rejects.toThrow('No signing key available');
    });
  });

  describe('verifyJWT', () => {
    it('should verify a valid JWT', async () => {
      const payload = { sub: 'user123', name: 'Test User' };
      const jwt = await keyManager.signJWT(payload, { expiresIn: '1h' });
      
      const result = await keyManager.verifyJWT(jwt);
      
      expect(result.payload.sub).toBe('user123');
      expect(result.payload.name).toBe('Test User');
    });

    it('should reject JWT with invalid format', async () => {
      await expect(
        keyManager.verifyJWT('invalid.jwt')
      ).rejects.toThrow();
    });

    it('should reject JWT with missing kid', async () => {
      const jwt = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIn0.signature';
      
      await expect(
        keyManager.verifyJWT(jwt)
      ).rejects.toThrow();
    });

    it('should reject JWT with unknown kid', async () => {
      // Create a JWT with a kid that doesn't exist
      const payload = { sub: 'user123' };
      const jwt = await keyManager.signJWT(payload);
      
      // Create new key manager (won't have the key)
      resetKeyManager();
      const newKeyManager = new KeyManager();
      await newKeyManager.initialize();
      
      await expect(
        newKeyManager.verifyJWT(jwt)
      ).rejects.toThrow();
    });
  });

  describe('getJWKS', () => {
    it('should return JWKS with all public keys', async () => {
      await keyManager.generateKeyPair();
      const jwks = await keyManager.getJWKS();
      
      expect(jwks.keys).toBeDefined();
      expect(jwks.keys.length).toBeGreaterThan(0);
    });

    it('should include required JWK fields', async () => {
      const jwks = await keyManager.getJWKS();
      const key = jwks.keys[0];
      
      expect(key.kty).toBe('RSA');
      expect(key.use).toBe('sig');
      expect(key.kid).toBeDefined();
      expect(key.alg).toBe('RS256');
      expect(key.n).toBeDefined(); // RSA modulus
      expect(key.e).toBeDefined(); // RSA exponent
    });
  });

  describe('rotateKeys', () => {
    it('should generate new key and set as current', async () => {
      const oldKey = keyManager.getCurrentKey();
      const oldKid = oldKey!.kid;
      
      const newKeyPair = await keyManager.rotateKeys();
      const currentKey = keyManager.getCurrentKey();
      
      expect(newKeyPair.kid).not.toBe(oldKid);
      expect(currentKey!.kid).toBe(newKeyPair.kid);
    });

    it('should keep old keys after rotation', async () => {
      const oldKey = keyManager.getCurrentKey();
      const oldKid = oldKey!.kid;
      
      await keyManager.rotateKeys();
      
      const retrievedOldKey = keyManager.getKey(oldKid);
      expect(retrievedOldKey).not.toBeNull();
    });
  });

  describe('cleanupOldKeys', () => {
    it('should remove keys older than maxAge', async () => {
      // Generate a key and manually set old creation date
      const oldKey = await keyManager.generateKeyPair();
      const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000); // 31 days ago
      oldKey.createdAt = oldDate;
      
      // Rotate to new key
      await keyManager.rotateKeys();
      
      // Cleanup with 30 day threshold
      keyManager.cleanupOldKeys(30 * 24 * 60 * 60 * 1000);
      
      // Old key should be removed
      const retrieved = keyManager.getKey(oldKey.kid);
      expect(retrieved).toBeNull();
    });

    it('should not remove current key', async () => {
      const currentKey = keyManager.getCurrentKey();
      const currentKid = currentKey!.kid;
      
      // Manually set old creation date
      currentKey!.createdAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      
      keyManager.cleanupOldKeys(30 * 24 * 60 * 60 * 1000);
      
      // Current key should still exist
      const retrieved = keyManager.getKey(currentKid);
      expect(retrieved).not.toBeNull();
    });
  });
});
