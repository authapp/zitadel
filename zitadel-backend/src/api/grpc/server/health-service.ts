/**
 * Health Service Implementation
 * 
 * Provides health check functionality for the gRPC server
 */

import * as grpc from '@grpc/grpc-js';
import { DatabasePool } from '../../../lib/database';

export enum HealthStatus {
  UNKNOWN = 0,
  SERVING = 1,
  NOT_SERVING = 2,
  SERVICE_UNKNOWN = 3,
}

export interface HealthCheckRequest {
  service?: string;
}

export interface HealthCheckResponse {
  status: HealthStatus;
}

/**
 * Health Service
 * Implements gRPC health checking protocol
 */
export class HealthService {
  private serviceStatus: Map<string, HealthStatus> = new Map();
  private watchers: Map<string, Set<grpc.ServerWritableStream<HealthCheckRequest, HealthCheckResponse>>> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(private pool: DatabasePool) {
    // Set default status
    this.serviceStatus.set('', HealthStatus.SERVING);
    
    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Check health status
   */
  check(
    call: grpc.ServerUnaryCall<HealthCheckRequest, HealthCheckResponse>,
    callback: grpc.sendUnaryData<HealthCheckResponse>
  ): void {
    const service = call.request.service || '';
    const status = this.serviceStatus.get(service) ?? HealthStatus.SERVICE_UNKNOWN;

    callback(null, { status });
  }

  /**
   * Watch health status changes
   */
  watch(call: grpc.ServerWritableStream<HealthCheckRequest, HealthCheckResponse>): void {
    const service = call.request.service || '';
    
    // Add watcher
    if (!this.watchers.has(service)) {
      this.watchers.set(service, new Set());
    }
    this.watchers.get(service)!.add(call);

    // Send initial status
    const status = this.serviceStatus.get(service) ?? HealthStatus.SERVICE_UNKNOWN;
    call.write({ status });

    // Handle client disconnect
    call.on('cancelled', () => {
      this.watchers.get(service)?.delete(call);
    });
  }

  /**
   * Set service status
   */
  setStatus(service: string, status: HealthStatus): void {
    this.serviceStatus.set(service, status);

    // Notify watchers
    const watchers = this.watchers.get(service);
    if (watchers) {
      for (const watcher of watchers) {
        try {
          watcher.write({ status });
        } catch (error) {
          // Remove dead watchers
          watchers.delete(watcher);
        }
      }
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    // Check database health every 10 seconds
    this.healthCheckInterval = setInterval(async () => {
      try {
        const isHealthy = await this.checkDatabaseHealth();
        const newStatus = isHealthy ? HealthStatus.SERVING : HealthStatus.NOT_SERVING;
        
        if (this.serviceStatus.get('') !== newStatus) {
          this.setStatus('', newStatus);
        }
      } catch (error) {
        console.error('Health check error:', error);
        this.setStatus('', HealthStatus.NOT_SERVING);
      }
    }, 10000);
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      // Simple query to check database connectivity
      await this.pool.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * Get current status
   */
  getStatus(service: string = ''): HealthStatus {
    return this.serviceStatus.get(service) ?? HealthStatus.SERVICE_UNKNOWN;
  }
}

/**
 * Create health service instance
 */
export function createHealthService(pool: DatabasePool): HealthService {
  return new HealthService(pool);
}
