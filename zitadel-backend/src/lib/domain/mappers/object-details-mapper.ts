/**
 * Object Details Mapper
 * 
 * Maps between domain ObjectDetails and other representations
 */

import { ObjectDetails } from '../types';

/**
 * Create ObjectDetails from event metadata
 */
export function createObjectDetails(
  id: string,
  resourceOwner: string,
  sequence: bigint,
  creationDate: Date,
  eventDate: Date
): ObjectDetails {
  return {
    id,
    resourceOwner,
    sequence,
    creationDate,
    eventDate,
  };
}

/**
 * Update ObjectDetails with new event
 */
export function updateObjectDetails(
  existing: ObjectDetails,
  sequence: bigint,
  eventDate: Date
): ObjectDetails {
  return {
    ...existing,
    sequence,
    eventDate,
  };
}

/**
 * Map ObjectDetails to API response
 */
export interface ObjectDetailsResponse {
  sequence: string;
  eventDate: string;
  creationDate: string;
  resourceOwner: string;
}

export function toObjectDetailsResponse(details: ObjectDetails): ObjectDetailsResponse {
  return {
    sequence: details.sequence.toString(),
    eventDate: details.eventDate.toISOString(),
    creationDate: details.creationDate.toISOString(),
    resourceOwner: details.resourceOwner,
  };
}

/**
 * Parse ObjectDetails from API request
 */
export function fromObjectDetailsResponse(response: ObjectDetailsResponse): ObjectDetails {
  return {
    id: '', // ID is typically provided separately
    resourceOwner: response.resourceOwner,
    sequence: BigInt(response.sequence),
    creationDate: new Date(response.creationDate),
    eventDate: new Date(response.eventDate),
  };
}
