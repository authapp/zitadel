import {
  PasswordHasher,
  SecretHasher,
  generateSecret,
  generateToken,
  generateNumericCode,
  generateAlphanumericCode,
  sha256,
  sha512,
  hmacSign,
  hmacVerify,
} from './hash';

describe('PasswordHasher', () => {
  describe('constructor', () => {
    it('should create hasher with default cost', () => {
      const hasher = new PasswordHasher();
      expect(hasher).toBeInstanceOf(PasswordHasher);
    });

    it('should create hasher with custom cost', () => {
      const hasher = new PasswordHasher({ cost: 10 });
      expect(hasher).toBeInstanceOf(PasswordHasher);
    });

    it('should throw error for invalid cost', () => {
      expect(() => new PasswordHasher({ cost: 3 })).toThrow('Bcrypt cost must be between 4 and 31');
      expect(() => new PasswordHasher({ cost: 32 })).toThrow(
        'Bcrypt cost must be between 4 and 31',
      );
    });

    it('should accept valid cost range', () => {
      expect(() => new PasswordHasher({ cost: 4 })).not.toThrow();
      expect(() => new PasswordHasher({ cost: 31 })).not.toThrow();
    });
  });

  describe('hash', () => {
    const hasher = new PasswordHasher({ cost: 4 }); // Low cost for faster tests

    it('should hash password', async () => {
      const hash = await hasher.hash('password123');

      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
      expect(hash).toMatch(/^\$2[aby]\$/); // Bcrypt format
    });

    it('should produce different hashes for same password', async () => {
      const hash1 = await hasher.hash('password123');
      const hash2 = await hasher.hash('password123');

      expect(hash1).not.toBe(hash2); // Different due to salt
    });

    it('should hash empty password', async () => {
      const hash = await hasher.hash('');
      expect(typeof hash).toBe('string');
    });

    it('should hash long password', async () => {
      const longPassword = 'a'.repeat(100);
      const hash = await hasher.hash(longPassword);
      expect(typeof hash).toBe('string');
    });

    it('should hash password with special characters', async () => {
      const hash = await hasher.hash('p@ssw0rd!#$%^&*()');
      expect(typeof hash).toBe('string');
    });

    it('should hash password with unicode characters', async () => {
      const hash = await hasher.hash('пароль密码🔒');
      expect(typeof hash).toBe('string');
    });
  });

  describe('verify', () => {
    const hasher = new PasswordHasher({ cost: 4 });

    it('should verify correct password', async () => {
      const password = 'password123';
      const hash = await hasher.hash(password);
      const isValid = await hasher.verify(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const hash = await hasher.hash('password123');
      const isValid = await hasher.verify('wrongpassword', hash);

      expect(isValid).toBe(false);
    });

    it('should reject similar but different password', async () => {
      const hash = await hasher.hash('password123');
      const isValid = await hasher.verify('password124', hash);

      expect(isValid).toBe(false);
    });

    it('should be case sensitive', async () => {
      const hash = await hasher.hash('Password123');
      const isValid = await hasher.verify('password123', hash);

      expect(isValid).toBe(false);
    });

    it('should handle empty password verification', async () => {
      const hash = await hasher.hash('');
      const isValid = await hasher.verify('', hash);

      expect(isValid).toBe(true);
    });
  });

  describe('needsRehash', () => {
    it('should return false for hash with same cost', async () => {
      const hasher = new PasswordHasher({ cost: 10 });
      const hash = await hasher.hash('password');

      expect(hasher.needsRehash(hash)).toBe(false);
    });

    it('should return true for hash with different cost', async () => {
      const hasher1 = new PasswordHasher({ cost: 10 });
      const hash = await hasher1.hash('password');

      const hasher2 = new PasswordHasher({ cost: 12 });
      expect(hasher2.needsRehash(hash)).toBe(true);
    });

    it('should return true for invalid hash', () => {
      const hasher = new PasswordHasher({ cost: 10 });
      expect(hasher.needsRehash('invalid-hash')).toBe(true);
    });
  });
});

describe('SecretHasher', () => {
  const hasher = new SecretHasher();

  describe('hash', () => {
    it('should hash secret', () => {
      const hash = hasher.hash('my-secret-key');

      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 produces 64 hex characters
      expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
    });

    it('should produce consistent hash for same input', () => {
      const hash1 = hasher.hash('my-secret-key');
      const hash2 = hasher.hash('my-secret-key');

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different input', () => {
      const hash1 = hasher.hash('secret1');
      const hash2 = hasher.hash('secret2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verify', () => {
    it('should verify correct secret', () => {
      const secret = 'my-secret-key';
      const hash = hasher.hash(secret);
      const isValid = hasher.verify(secret, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect secret', () => {
      const hash = hasher.hash('my-secret-key');
      const isValid = hasher.verify('wrong-secret', hash);

      expect(isValid).toBe(false);
    });

    it('should use timing-safe comparison', () => {
      // This test ensures the verify method exists and works
      // Actual timing-safe behavior is handled by Node.js crypto
      const hash = hasher.hash('secret');
      expect(hasher.verify('secret', hash)).toBe(true);
      expect(hasher.verify('secre', hash)).toBe(false);
    });
  });
});

describe('Token and code generation', () => {
  describe('generateSecret', () => {
    it('should generate secret with default length', () => {
      const secret = generateSecret();

      expect(typeof secret).toBe('string');
      expect(secret.length).toBeGreaterThan(0);
    });

    it('should generate secret with custom length', () => {
      const secret = generateSecret(16);

      expect(typeof secret).toBe('string');
      // Base64url encoding, length varies but should be reasonable
      expect(secret.length).toBeGreaterThan(10);
    });

    it('should generate unique secrets', () => {
      const secrets = new Set<string>();

      for (let i = 0; i < 100; i++) {
        secrets.add(generateSecret());
      }

      expect(secrets.size).toBe(100);
    });

    it('should use base64url encoding (no special chars)', () => {
      const secret = generateSecret(32);

      // Base64url uses: A-Z, a-z, 0-9, -, _
      expect(/^[A-Za-z0-9_-]+$/.test(secret)).toBe(true);
    });
  });

  describe('generateToken', () => {
    it('should generate token with default length', () => {
      const token = generateToken();

      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('should generate token with custom length', () => {
      const token = generateToken(16);

      expect(token.length).toBe(32); // 16 bytes = 32 hex chars
    });

    it('should generate unique tokens', () => {
      const tokens = new Set<string>();

      for (let i = 0; i < 100; i++) {
        tokens.add(generateToken());
      }

      expect(tokens.size).toBe(100);
    });

    it('should use hex encoding', () => {
      const token = generateToken();
      expect(/^[0-9a-f]+$/.test(token)).toBe(true);
    });
  });

  describe('generateNumericCode', () => {
    it('should generate 6-digit code by default', () => {
      const code = generateNumericCode();

      expect(typeof code).toBe('string');
      expect(code.length).toBe(6);
      expect(/^\d{6}$/.test(code)).toBe(true);
    });

    it('should generate code with custom length', () => {
      const code = generateNumericCode(4);

      expect(code.length).toBe(4);
      expect(/^\d{4}$/.test(code)).toBe(true);
    });

    it('should pad with leading zeros', () => {
      // Generate many codes to likely get one with leading zeros
      const codes = Array.from({ length: 100 }, () => generateNumericCode(6));

      // All should be 6 digits
      codes.forEach((code) => {
        expect(code.length).toBe(6);
        expect(/^\d{6}$/.test(code)).toBe(true);
      });
    });

    it('should generate unique codes', () => {
      const codes = new Set<string>();

      for (let i = 0; i < 100; i++) {
        codes.add(generateNumericCode());
      }

      // Should have high uniqueness (allowing for some collisions in 1M space)
      expect(codes.size).toBeGreaterThan(90);
    });
  });

  describe('generateAlphanumericCode', () => {
    it('should generate 8-character code by default', () => {
      const code = generateAlphanumericCode();

      expect(typeof code).toBe('string');
      expect(code.length).toBe(8);
      expect(/^[A-Z0-9]{8}$/.test(code)).toBe(true);
    });

    it('should generate code with custom length', () => {
      const code = generateAlphanumericCode(12);

      expect(code.length).toBe(12);
      expect(/^[A-Z0-9]{12}$/.test(code)).toBe(true);
    });

    it('should only use uppercase letters and numbers', () => {
      const code = generateAlphanumericCode(20);
      expect(/^[A-Z0-9]+$/.test(code)).toBe(true);
      expect(/[a-z]/.test(code)).toBe(false); // No lowercase
    });

    it('should generate unique codes', () => {
      const codes = new Set<string>();

      for (let i = 0; i < 100; i++) {
        codes.add(generateAlphanumericCode());
      }

      expect(codes.size).toBe(100);
    });
  });
});

describe('Hash functions', () => {
  describe('sha256', () => {
    it('should hash string', () => {
      const hash = sha256('test data');

      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // 256 bits = 64 hex chars
      expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
    });

    it('should hash buffer', () => {
      const hash = sha256(Buffer.from('test data'));

      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64);
    });

    it('should produce consistent hash', () => {
      const hash1 = sha256('test data');
      const hash2 = sha256('test data');

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different input', () => {
      const hash1 = sha256('data1');
      const hash2 = sha256('data2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('sha512', () => {
    it('should hash string', () => {
      const hash = sha512('test data');

      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(128); // 512 bits = 128 hex chars
      expect(/^[0-9a-f]{128}$/.test(hash)).toBe(true);
    });

    it('should produce consistent hash', () => {
      const hash1 = sha512('test data');
      const hash2 = sha512('test data');

      expect(hash1).toBe(hash2);
    });
  });
});

describe('HMAC functions', () => {
  const secret = 'my-secret-key';

  describe('hmacSign', () => {
    it('should sign data with SHA-256', () => {
      const signature = hmacSign('test data', secret);

      expect(typeof signature).toBe('string');
      expect(signature.length).toBe(64); // SHA-256 = 64 hex chars
      expect(/^[0-9a-f]{64}$/.test(signature)).toBe(true);
    });

    it('should sign data with SHA-512', () => {
      const signature = hmacSign('test data', secret, 'sha512');

      expect(typeof signature).toBe('string');
      expect(signature.length).toBe(128); // SHA-512 = 128 hex chars
    });

    it('should produce consistent signature', () => {
      const sig1 = hmacSign('test data', secret);
      const sig2 = hmacSign('test data', secret);

      expect(sig1).toBe(sig2);
    });

    it('should produce different signature for different data', () => {
      const sig1 = hmacSign('data1', secret);
      const sig2 = hmacSign('data2', secret);

      expect(sig1).not.toBe(sig2);
    });

    it('should produce different signature for different secret', () => {
      const sig1 = hmacSign('test data', 'secret1');
      const sig2 = hmacSign('test data', 'secret2');

      expect(sig1).not.toBe(sig2);
    });
  });

  describe('hmacVerify', () => {
    it('should verify correct signature', () => {
      const data = 'test data';
      const signature = hmacSign(data, secret);
      const isValid = hmacVerify(data, signature, secret);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect signature', () => {
      const data = 'test data';
      const isValid = hmacVerify(data, 'wrong-signature', secret);

      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong secret', () => {
      const data = 'test data';
      const signature = hmacSign(data, 'secret1');
      const isValid = hmacVerify(data, signature, 'secret2');

      expect(isValid).toBe(false);
    });

    it('should reject signature for different data', () => {
      const signature = hmacSign('data1', secret);
      const isValid = hmacVerify('data2', signature, secret);

      expect(isValid).toBe(false);
    });

    it('should verify with SHA-512', () => {
      const data = 'test data';
      const signature = hmacSign(data, secret, 'sha512');
      const isValid = hmacVerify(data, signature, secret, 'sha512');

      expect(isValid).toBe(true);
    });
  });
});
