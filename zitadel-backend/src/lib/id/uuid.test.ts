import { generateUUID, isValidUUID, generateCommandId } from './uuid';

describe('UUID functions', () => {
  describe('generateUUID', () => {
    it('should generate valid UUID v4', () => {
      const uuid = generateUUID();

      expect(typeof uuid).toBe('string');
      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('should generate unique UUIDs', () => {
      const uuids = new Set<string>();

      for (let i = 0; i < 1000; i++) {
        uuids.add(generateUUID());
      }

      expect(uuids.size).toBe(1000);
    });

    it('should generate different UUIDs on each call', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      const uuid3 = generateUUID();

      expect(uuid1).not.toBe(uuid2);
      expect(uuid2).not.toBe(uuid3);
      expect(uuid1).not.toBe(uuid3);
    });
  });

  describe('isValidUUID', () => {
    it('should validate correct UUID v4', () => {
      const uuid = generateUUID();
      expect(isValidUUID(uuid)).toBe(true);
    });

    it('should validate manually created UUID v4', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(isValidUUID(uuid)).toBe(true);
    });

    it('should reject invalid UUID formats', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('123')).toBe(false);
      expect(isValidUUID('')).toBe(false);
      expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false); // Too short
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000-extra')).toBe(false); // Too long
    });

    it('should reject UUID with invalid characters', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-44665544000g')).toBe(false);
      expect(isValidUUID('550e8400-e29b-41d4-a716-44665544000G')).toBe(false);
    });

    it('should reject malformed UUIDs', () => {
      expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false); // No dashes
      expect(isValidUUID('550e8400-e29b-41d4-a716_446655440000')).toBe(false); // Wrong separator
    });
  });

  describe('generateCommandId', () => {
    it('should generate valid command ID', () => {
      const commandId = generateCommandId();

      expect(typeof commandId).toBe('string');
      expect(isValidUUID(commandId)).toBe(true);
    });

    it('should generate unique command IDs', () => {
      const commandIds = new Set<string>();

      for (let i = 0; i < 1000; i++) {
        commandIds.add(generateCommandId());
      }

      expect(commandIds.size).toBe(1000);
    });

    it('should generate different command IDs on each call', () => {
      const id1 = generateCommandId();
      const id2 = generateCommandId();
      const id3 = generateCommandId();

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });
  });
});
