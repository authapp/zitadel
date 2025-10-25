/**
 * Encryption Key Commands
 * Manages encryption keys for cryptographic operations
 * Direct storage (not event-sourced) for security reasons
 * Based on Zitadel Go internal/crypto/keys.go
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { validateRequired } from '../validation';
import { throwInvalidArgument, throwNotFound, throwAlreadyExists } from '@/zerrors/errors';

/**
 * Encryption Algorithm Types
 */
export enum EncryptionAlgorithm {
  AES256 = 'aes256',
  RSA2048 = 'rsa2048',
  RSA4096 = 'rsa4096',
}

/**
 * Encryption Key Data
 */
export interface EncryptionKeyData {
  algorithm: EncryptionAlgorithm;
  identifier: string;
  keyData: Buffer; // Encrypted key material
}

/**
 * Encryption Key Result
 */
export interface EncryptionKey {
  id: string;
  instanceID: string;
  algorithm: string;
  identifier: string;
  keyData: Buffer;
  createdAt: Date;
}

/**
 * Add Encryption Key
 * Stores an encryption key (direct table insert, no events)
 * Based on Go: AddEncryptionKey
 */
export async function addEncryptionKey(
  this: Commands,
  ctx: Context,
  data: EncryptionKeyData
): Promise<{ id: string; createdAt: Date }> {
  // 1. Validation
  validateRequired(data.identifier, 'identifier');
  validateRequired(data.keyData, 'keyData');

  if (!Object.values(EncryptionAlgorithm).includes(data.algorithm)) {
    throwInvalidArgument('Invalid encryption algorithm', 'CRYPTO-001');
  }

  if (data.keyData.length === 0) {
    throwInvalidArgument('Key data cannot be empty', 'CRYPTO-002');
  }

  // 2. Check database availability
  if (!this.database) {
    throw new Error('Database not available for encryption key operations');
  }

  // 3. Generate ID
  const keyID = await this.nextID();

  // 4. Check if identifier already exists
  const existing = await this.database!.queryOne(
    `SELECT id FROM encryption_keys 
     WHERE instance_id = $1 AND identifier = $2`,
    [ctx.instanceID, data.identifier]
  );

  if (existing) {
    throwAlreadyExists('Encryption key with this identifier already exists', 'CRYPTO-003');
  }

  // 5. Insert key (direct table access)
  const result = await this.database!.queryOne(
    `INSERT INTO encryption_keys (
      id, instance_id, algorithm, key_data, identifier, created_at
    ) VALUES ($1, $2, $3, $4, $5, NOW())
    RETURNING id, created_at`,
    [keyID, ctx.instanceID, data.algorithm, data.keyData, data.identifier]
  );

  return {
    id: result.id,
    createdAt: result.created_at,
  };
}

/**
 * Get Encryption Key
 * Retrieves an encryption key by ID or identifier
 * Based on Go: GetEncryptionKey
 */
export async function getEncryptionKey(
  this: Commands,
  ctx: Context,
  idOrIdentifier: string
): Promise<EncryptionKey | null> {
  // 1. Validation
  validateRequired(idOrIdentifier, 'idOrIdentifier');

  // 2. Check database availability
  if (!this.database) {
    throw new Error('Database not available for encryption key operations');
  }

  // 3. Query by ID or identifier
  const result = await this.database!.queryOne(
    `SELECT id, instance_id, algorithm, key_data, identifier, created_at
     FROM encryption_keys 
     WHERE instance_id = $1 AND (id = $2 OR identifier = $2)`,
    [ctx.instanceID, idOrIdentifier]
  );

  if (!result) {
    return null;
  }

  return {
    id: result.id,
    instanceID: result.instance_id,
    algorithm: result.algorithm,
    identifier: result.identifier,
    keyData: result.key_data,
    createdAt: result.created_at,
  };
}

/**
 * List Encryption Keys
 * Lists all encryption keys for the instance
 * Based on Go: ListEncryptionKeys
 */
export async function listEncryptionKeys(
  this: Commands,
  ctx: Context,
  algorithm?: EncryptionAlgorithm
): Promise<EncryptionKey[]> {
  // 1. Check database availability
  if (!this.database) {
    throw new Error('Database not available for encryption key operations');
  }

  // 2. Build query
  let query = `
    SELECT id, instance_id, algorithm, key_data, identifier, created_at
    FROM encryption_keys 
    WHERE instance_id = $1
  `;
  const params: any[] = [ctx.instanceID];

  if (algorithm) {
    query += ` AND algorithm = $2`;
    params.push(algorithm);
  }

  query += ` ORDER BY created_at DESC`;

  // 3. Execute query
  const results = await this.database!.query(query, params);

  return results.rows.map((row: any) => ({
    id: row.id,
    instanceID: row.instance_id,
    algorithm: row.algorithm,
    identifier: row.identifier,
    keyData: row.key_data,
    createdAt: row.created_at,
  }));
}

/**
 * Remove Encryption Key
 * Deletes an encryption key permanently
 * Based on Go: RemoveEncryptionKey
 */
export async function removeEncryptionKey(
  this: Commands,
  ctx: Context,
  keyID: string
): Promise<void> {
  // 1. Validation
  validateRequired(keyID, 'keyID');

  // 2. Check database availability
  if (!this.database) {
    throw new Error('Database not available for encryption key operations');
  }

  // 3. Check if exists
  const existing = await this.database!.queryOne(
    `SELECT id FROM encryption_keys 
     WHERE instance_id = $1 AND id = $2`,
    [ctx.instanceID, keyID]
  );

  if (!existing) {
    throwNotFound('Encryption key not found', 'CRYPTO-004');
  }

  // 4. Delete key
  await this.database!.query(
    `DELETE FROM encryption_keys 
     WHERE instance_id = $1 AND id = $2`,
    [ctx.instanceID, keyID]
  );
}
