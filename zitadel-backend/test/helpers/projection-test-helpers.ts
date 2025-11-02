/**
 * Projection Test Helpers
 * 
 * Utilities for testing projections with real-time event subscriptions
 * instead of arbitrary timeouts
 */

import { ProjectionRegistry } from '../../src/lib/query/projection/projection-registry';
import { Eventstore } from '../../src/lib/eventstore/types';

/**
 * Wait for a projection to process events up to a specific position
 * This uses the projection's current position to determine when events are processed
 * 
 * @param registry - Projection registry
 * @param projectionName - Name of the projection
 * @param targetPosition - Position to wait for (from event)
 * @param timeoutMs - Maximum time to wait (default: 5000ms)
 */
export async function waitForProjectionPosition(
  registry: ProjectionRegistry,
  projectionName: string,
  targetPosition: number,
  timeoutMs: number = 5000
): Promise<void> {
  const startTime = Date.now();
  const checkInterval = 10; // Check every 10ms
  
  while (Date.now() - startTime < timeoutMs) {
    const health = await registry.getProjectionHealth(projectionName);
    
    if (health && health.currentPosition >= targetPosition) {
      // Projection has caught up to or passed the target position
      return;
    }
    
    // Wait a bit before checking again
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  throw new Error(
    `Timeout waiting for projection ${projectionName} to reach position ${targetPosition}`
  );
}

/**
 * Wait for all events in eventstore to be processed by a projection
 * This queries the eventstore's latest position and waits for the projection to catch up
 * 
 * @param registry - Projection registry
 * @param eventstore - Eventstore instance
 * @param projectionName - Name of the projection
 * @param timeoutMs - Maximum time to wait (default: 5000ms)
 */
export async function waitForProjectionCatchUp(
  registry: ProjectionRegistry,
  eventstore: Eventstore,
  projectionName: string,
  timeoutMs: number = 5000
): Promise<void> {
  // Get the latest position in the eventstore
  const latestPosition = await eventstore.latestPosition();
  
  // Wait for projection to reach that position
  await waitForProjectionPosition(
    registry,
    projectionName,
    latestPosition.position,
    timeoutMs
  );
}

/**
 * Wait for multiple projections to catch up
 * Useful when tests involve multiple projections
 * 
 * @param registry - Projection registry
 * @param eventstore - Eventstore instance
 * @param projectionNames - Names of projections to wait for
 * @param timeoutMs - Maximum time to wait (default: 5000ms)
 */
export async function waitForProjectionsCatchUp(
  registry: ProjectionRegistry,
  eventstore: Eventstore,
  projectionNames: string[],
  timeoutMs: number = 5000
): Promise<void> {
  // Wait for all projections in parallel
  await Promise.all(
    projectionNames.map(name =>
      waitForProjectionCatchUp(registry, eventstore, name, timeoutMs)
    )
  );
}

/**
 * Simple delay helper (still useful for giving subscriptions time to establish)
 * @param ms - Milliseconds to wait
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for projection to be in LIVE state (has caught up with all events)
 * 
 * @param registry - Projection registry
 * @param projectionName - Name of the projection
 * @param timeoutMs - Maximum time to wait (default: 5000ms)
 */
export async function waitForProjectionLive(
  registry: ProjectionRegistry,
  projectionName: string,
  timeoutMs: number = 5000
): Promise<void> {
  const startTime = Date.now();
  const checkInterval = 10;
  
  while (Date.now() - startTime < timeoutMs) {
    const health = await registry.getProjectionHealth(projectionName);
    
    if (health && health.state === 'live') {
      return;
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  throw new Error(
    `Timeout waiting for projection ${projectionName} to reach LIVE state`
  );
}
