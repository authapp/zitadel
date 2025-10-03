import {
  AESEncryption,
  CryptoType,
  encryptValue,
  decryptValue,
  decryptValueString,
  serializeCryptoValue,
  deserializeCryptoValue,
} from './encryption';

describe('AESEncryption', () => {
  // Generate a valid 32-byte key for AES-256
  const validKey = Buffer.from('a'.repeat(32)).toString('base64');
  const validKey128 = Buffer.from('a'.repeat(16)).toString('base64');

  describe('constructor', () => {
    it('should create AES-256-GCM encryption with valid key', () => {
      const encryption = new AESEncryption({
        key: validKey,
        keyId: 'test-key-1',
      });

      expect(encryption.algorithm()).toBe('aes-256-gcm');
      expect(encryption.encryptionKeyId()).toBe('test-key-1');
      expect(encryption.decryptionKeyIds()).toEqual(['test-key-1']);
    });

    it('should create AES-128-GCM encryption with valid key', () => {
      const encryption = new AESEncryption({
        key: validKey128,
        keyId: 'test-key-1',
        algorithm: 'aes-128-gcm',
      });

      expect(encryption.algorithm()).toBe('aes-128-gcm');
    });

    it('should throw error for invalid key encoding', () => {
      expect(() => {
        new AESEncryption({
          key: 'not-base64!!!',
          keyId: 'test-key',
        });
      }).toThrow();
    });

    it('should throw error for wrong key length (AES-256)', () => {
      const shortKey = Buffer.from('short').toString('base64');

      expect(() => {
        new AESEncryption({
          key: shortKey,
          keyId: 'test-key',
        });
      }).toThrow('Key length must be 32 bytes');
    });

    it('should throw error for wrong key length (AES-128)', () => {
      const wrongKey = Buffer.from('a'.repeat(20)).toString('base64');

      expect(() => {
        new AESEncryption({
          key: wrongKey,
          keyId: 'test-key',
          algorithm: 'aes-128-gcm',
        });
      }).toThrow('Key length must be 16 bytes');
    });
  });

  describe('encrypt and decrypt', () => {
    const encryption = new AESEncryption({
      key: validKey,
      keyId: 'test-key-1',
    });

    it('should encrypt and decrypt data correctly', async () => {
      const plaintext = Buffer.from('Hello, World!', 'utf8');
      const encrypted = await encryption.encrypt(plaintext);
      const decrypted = await encryption.decrypt(encrypted, 'test-key-1');

      expect(decrypted.toString('utf8')).toBe('Hello, World!');
    });

    it('should encrypt and decrypt empty data', async () => {
      const plaintext = Buffer.from('', 'utf8');
      const encrypted = await encryption.encrypt(plaintext);
      const decrypted = await encryption.decrypt(encrypted, 'test-key-1');

      expect(decrypted.toString('utf8')).toBe('');
    });

    it('should encrypt and decrypt binary data', async () => {
      const plaintext = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
      const encrypted = await encryption.encrypt(plaintext);
      const decrypted = await encryption.decrypt(encrypted, 'test-key-1');

      expect(decrypted).toEqual(plaintext);
    });

    it('should produce different ciphertext for same plaintext', async () => {
      const plaintext = Buffer.from('Same text', 'utf8');
      const encrypted1 = await encryption.encrypt(plaintext);
      const encrypted2 = await encryption.encrypt(plaintext);

      // Different because of random IV
      expect(encrypted1).not.toEqual(encrypted2);

      // But both decrypt to same plaintext
      const decrypted1 = await encryption.decrypt(encrypted1, 'test-key-1');
      const decrypted2 = await encryption.decrypt(encrypted2, 'test-key-1');

      expect(decrypted1.toString('utf8')).toBe('Same text');
      expect(decrypted2.toString('utf8')).toBe('Same text');
    });

    it('should encrypt large data', async () => {
      const largeData = Buffer.from('x'.repeat(10000), 'utf8');
      const encrypted = await encryption.encrypt(largeData);
      const decrypted = await encryption.decrypt(encrypted, 'test-key-1');

      expect(decrypted).toEqual(largeData);
    });

    it('should throw error for wrong key ID', async () => {
      const plaintext = Buffer.from('Test', 'utf8');
      const encrypted = await encryption.encrypt(plaintext);

      await expect(encryption.decrypt(encrypted, 'wrong-key-id')).rejects.toThrow(
        'Unknown key ID',
      );
    });

    it('should throw error for tampered ciphertext', async () => {
      const plaintext = Buffer.from('Test', 'utf8');
      const encrypted = await encryption.encrypt(plaintext);

      // Tamper with the ciphertext
      encrypted[20] = encrypted[20] ^ 0xff;

      await expect(encryption.decrypt(encrypted, 'test-key-1')).rejects.toThrow();
    });

    it('should throw error for truncated ciphertext', async () => {
      const plaintext = Buffer.from('Test', 'utf8');
      const encrypted = await encryption.encrypt(plaintext);

      // Truncate the ciphertext
      const truncated = encrypted.subarray(0, 10);

      await expect(encryption.decrypt(truncated, 'test-key-1')).rejects.toThrow();
    });
  });

  describe('decryptString', () => {
    const encryption = new AESEncryption({
      key: validKey,
      keyId: 'test-key-1',
    });

    it('should decrypt to UTF-8 string', async () => {
      const plaintext = Buffer.from('Hello, UTF-8! 你好', 'utf8');
      const encrypted = await encryption.encrypt(plaintext);
      const decrypted = await encryption.decryptString(encrypted, 'test-key-1');

      expect(decrypted).toBe('Hello, UTF-8! 你好');
    });

    it('should handle special characters', async () => {
      const plaintext = Buffer.from('Special: !@#$%^&*()', 'utf8');
      const encrypted = await encryption.encrypt(plaintext);
      const decrypted = await encryption.decryptString(encrypted, 'test-key-1');

      expect(decrypted).toBe('Special: !@#$%^&*()');
    });

    it('should handle emojis', async () => {
      const plaintext = Buffer.from('Emojis: 🎉🚀✅', 'utf8');
      const encrypted = await encryption.encrypt(plaintext);
      const decrypted = await encryption.decryptString(encrypted, 'test-key-1');

      expect(decrypted).toBe('Emojis: 🎉🚀✅');
    });
  });
});

describe('CryptoValue functions', () => {
  const encryption = new AESEncryption({
    key: Buffer.from('a'.repeat(32)).toString('base64'),
    keyId: 'test-key-1',
  });

  describe('encryptValue', () => {
    it('should encrypt string value', async () => {
      const cryptoValue = await encryptValue(encryption, 'secret data');

      expect(cryptoValue.cryptoType).toBe(CryptoType.ENCRYPTION);
      expect(cryptoValue.algorithm).toBe('aes-256-gcm');
      expect(cryptoValue.keyId).toBe('test-key-1');
      expect(cryptoValue.crypted).toBeInstanceOf(Buffer);
    });

    it('should encrypt buffer value', async () => {
      const buffer = Buffer.from('secret data', 'utf8');
      const cryptoValue = await encryptValue(encryption, buffer);

      expect(cryptoValue.cryptoType).toBe(CryptoType.ENCRYPTION);
      expect(cryptoValue.crypted).toBeInstanceOf(Buffer);
    });
  });

  describe('decryptValue', () => {
    it('should decrypt CryptoValue to buffer', async () => {
      const original = 'secret data';
      const cryptoValue = await encryptValue(encryption, original);
      const decrypted = await decryptValue(encryption, cryptoValue);

      expect(decrypted.toString('utf8')).toBe(original);
    });
  });

  describe('decryptValueString', () => {
    it('should decrypt CryptoValue to string', async () => {
      const original = 'secret data';
      const cryptoValue = await encryptValue(encryption, original);
      const decrypted = await decryptValueString(encryption, cryptoValue);

      expect(decrypted).toBe(original);
    });
  });

  describe('serializeCryptoValue and deserializeCryptoValue', () => {
    it('should serialize and deserialize CryptoValue', async () => {
      const original = 'secret data';
      const cryptoValue = await encryptValue(encryption, original);

      const serialized = serializeCryptoValue(cryptoValue);
      expect(typeof serialized).toBe('string');

      const deserialized = deserializeCryptoValue(serialized);
      expect(deserialized.cryptoType).toBe(cryptoValue.cryptoType);
      expect(deserialized.algorithm).toBe(cryptoValue.algorithm);
      expect(deserialized.keyId).toBe(cryptoValue.keyId);
      expect(deserialized.crypted).toEqual(cryptoValue.crypted);

      // Should be able to decrypt deserialized value
      const decrypted = await decryptValueString(encryption, deserialized);
      expect(decrypted).toBe(original);
    });

    it('should handle JSON serialization correctly', async () => {
      const cryptoValue = await encryptValue(encryption, 'test');
      const serialized = serializeCryptoValue(cryptoValue);

      // Should be valid JSON
      expect(() => JSON.parse(serialized)).not.toThrow();

      const parsed = JSON.parse(serialized);
      expect(parsed).toHaveProperty('cryptoType');
      expect(parsed).toHaveProperty('algorithm');
      expect(parsed).toHaveProperty('keyId');
      expect(parsed).toHaveProperty('crypted');
    });
  });
});

describe('CryptoType enum', () => {
  it('should have correct values', () => {
    expect(CryptoType.ENCRYPTION).toBe('encryption');
    expect(CryptoType.HASH).toBe('hash');
  });
});
