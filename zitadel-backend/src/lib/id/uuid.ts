import { v4 as uuidv4, validate as uuidValidate } from 'uuid';

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return uuidv4();
}

/**
 * Validate if a string is a valid UUID
 */
export function isValidUUID(id: string): boolean {
  return uuidValidate(id);
}

/**
 * Generate a command ID (for event sourcing)
 * Command IDs are UUIDs used to track command execution
 */
export function generateCommandId(): string {
  return uuidv4();
}
