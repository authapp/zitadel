/**
 * gRPC Server
 * 
 * Main gRPC server implementation for Zitadel TypeScript backend
 * Handles service registration, middleware, and server lifecycle
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';
import { DatabasePool } from '../../../lib/database';
import { Commands } from '../../../lib/command';
// TODO: Re-enable interceptors after converting them to server-side interceptors
// import { createAuthInterceptor } from '../middleware/auth-interceptor';
// import { createErrorInterceptor } from '../middleware/error-interceptor';
// import { createLoggingInterceptor } from '../middleware/logging-interceptor';
import { HealthService, createHealthService } from './health-service';

export interface GrpcServerConfig {
  port: number;
  host?: string;
  protoPath?: string;
  enableReflection?: boolean;
}

export interface GrpcServerDependencies {
  pool: DatabasePool;
  commands: Commands;
}

/**
 * gRPC Server
 * Manages the gRPC server lifecycle and service registration
 */
export class GrpcServer {
  private server: grpc.Server;
  private config: GrpcServerConfig;
  // @ts-ignore - Stored for future service implementations
  private deps: GrpcServerDependencies;
  private healthService: HealthService;
  private isRunning: boolean = false;
  private servicesRegistered: boolean = false;

  constructor(config: GrpcServerConfig, deps: GrpcServerDependencies) {
    this.config = {
      host: '0.0.0.0',
      protoPath: join(process.cwd(), 'proto'),
      enableReflection: process.env.NODE_ENV !== 'production',
      ...config,
    };
    this.deps = deps;

    // Create server without interceptors for now
    // TODO: Convert client interceptors to server interceptors
    // Server interceptors have a different signature than client interceptors
    this.server = new grpc.Server({
      // interceptors: [
      //   createLoggingInterceptor(),
      //   createAuthInterceptor(),
      //   createErrorInterceptor(),
      // ],
    });

    // Create health service
    this.healthService = createHealthService(deps.pool);
  }

  /**
   * Load proto file and return service definition
   */
  private loadProto(protoFile: string): grpc.GrpcObject {
    const protoPath = join(this.config.protoPath!, protoFile);
    
    const packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [this.config.protoPath!],
    });

    return grpc.loadPackageDefinition(packageDefinition);
  }

  /**
   * Register health service
   */
  private registerHealthService(): void {
    const proto = this.loadProto('zitadel/health.proto') as any;
    const healthService = proto.zitadel.health.v1.HealthService.service;

    this.server.addService(healthService, {
      Check: this.healthService.check.bind(this.healthService),
      Watch: this.healthService.watch.bind(this.healthService),
    });

    console.log('✓ Registered health service');
  }

  /**
   * Register all services
   */
  private registerServices(): void {
    // Only register services once
    if (this.servicesRegistered) {
      return;
    }

    // Register health service
    this.registerHealthService();

    // TODO: Register user service
    // TODO: Register org service
    // TODO: Register project service
    // TODO: Register other services

    this.servicesRegistered = true;
  }

  /**
   * Start the gRPC server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('gRPC server is already running');
    }

    // Register services
    this.registerServices();

    // Bind server
    const address = `${this.config.host}:${this.config.port}`;
    
    return new Promise((resolve, reject) => {
      this.server.bindAsync(
        address,
        grpc.ServerCredentials.createInsecure(),
        (error, port) => {
          if (error) {
            reject(error);
            return;
          }

          this.server.start();
          this.isRunning = true;
          
          console.log(`✓ gRPC server listening on ${address} (bound to port ${port})`);
          resolve();
        }
      );
    });
  }

  /**
   * Stop the gRPC server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    // Stop health monitoring
    this.healthService.stopHealthMonitoring();

    return new Promise((resolve) => {
      this.server.tryShutdown((error) => {
        if (error) {
          console.error('Error during graceful shutdown, forcing:', error);
          this.server.forceShutdown();
        }
        
        this.isRunning = false;
        console.log('✓ gRPC server stopped');
        resolve();
      });
    });
  }

  /**
   * Check if server is running
   */
  isServerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get server instance
   */
  getServer(): grpc.Server {
    return this.server;
  }

  /**
   * Get server address
   */
  getAddress(): string {
    return `${this.config.host}:${this.config.port}`;
  }
}
