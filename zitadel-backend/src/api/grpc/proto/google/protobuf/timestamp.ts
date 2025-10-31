/**
 * Google Protobuf Timestamp
 * 
 * TypeScript representation of google.protobuf.Timestamp
 */

export interface Timestamp {
  seconds: number;
  nanos: number;
}

/**
 * Convert Date to Timestamp
 */
export function dateToTimestamp(date: Date): Timestamp {
  const milliseconds = date.getTime();
  return {
    seconds: Math.floor(milliseconds / 1000),
    nanos: (milliseconds % 1000) * 1_000_000,
  };
}

/**
 * Convert Timestamp to Date
 */
export function timestampToDate(timestamp: Timestamp): Date {
  return new Date(timestamp.seconds * 1000 + timestamp.nanos / 1_000_000);
}

/**
 * Get current timestamp
 */
export function now(): Timestamp {
  return dateToTimestamp(new Date());
}
