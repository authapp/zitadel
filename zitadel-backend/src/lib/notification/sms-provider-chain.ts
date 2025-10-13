/**
 * SMS Provider Chain
 * Supports fallback between multiple SMS providers
 * Based on Zitadel Go: internal/notification/channels/chain.go
 */

import { SMSProvider, SMSMetadata } from './sms-service';

export interface SMSChainConfig {
  providers: SMSProvider[];
  continueOnError?: boolean;  // Try all providers even if one succeeds (default: false)
  logErrors?: boolean;         // Log errors from failed providers (default: true)
}

/**
 * SMS Provider Chain
 * Attempts to send SMS through multiple providers with fallback
 */
export class SMSProviderChain implements SMSProvider {
  name = 'chain';
  private providers: SMSProvider[];
  private continueOnError: boolean;
  private logErrors: boolean;

  constructor(config: SMSChainConfig) {
    if (!config.providers || config.providers.length === 0) {
      throw new Error('At least one provider is required for chain');
    }

    this.providers = config.providers;
    this.continueOnError = config.continueOnError ?? false;
    this.logErrors = config.logErrors ?? true;
  }

  async sendSMS(to: string, message: string, metadata?: SMSMetadata): Promise<{ messageId: string }> {
    const errors: Array<{ provider: string; error: Error }> = [];
    
    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      
      try {
        console.log(`[SMS Provider Chain] Attempting provider: ${provider.name} (${i + 1}/${this.providers.length})`);
        
        const result = await provider.sendSMS(to, message, metadata);
        
        console.log(`[SMS Provider Chain] Success with provider: ${provider.name}`);
        
        if (!this.continueOnError) {
          return result;
        }
      } catch (error: any) {
        const errorInfo = {
          provider: provider.name,
          error,
        };
        
        errors.push(errorInfo);
        
        if (this.logErrors) {
          console.error(
            `[SMS Provider Chain] Provider ${provider.name} failed:`,
            error.message
          );
        }
        
        // If this is the last provider and continueOnError is false, throw
        if (i === this.providers.length - 1 && !this.continueOnError) {
          throw this.createChainError(errors);
        }
      }
    }

    // If continueOnError is true and we got here, at least one provider succeeded
    if (this.continueOnError) {
      return { messageId: `chain_${Date.now()}_${Math.random().toString(36).substring(7)}` };
    }

    // All providers failed
    throw this.createChainError(errors);
  }

  private createChainError(errors: Array<{ provider: string; error: Error }>): Error {
    const errorMessages = errors
      .map(e => `${e.provider}: ${e.error.message}`)
      .join('; ');
    
    return new Error(
      `All SMS providers failed. Errors: ${errorMessages}`
    );
  }

  /**
   * Get list of provider names in the chain
   */
  getProviders(): string[] {
    return this.providers.map(p => p.name);
  }

  /**
   * Get number of providers in the chain
   */
  getProviderCount(): number {
    return this.providers.length;
  }
}

/**
 * Builder for creating provider chains
 */
export class SMSProviderChainBuilder {
  private providers: SMSProvider[] = [];
  private continueOnError: boolean = false;
  private logErrors: boolean = true;

  /**
   * Add a provider to the chain
   */
  addProvider(provider: SMSProvider): this {
    this.providers.push(provider);
    return this;
  }

  /**
   * Add multiple providers to the chain
   */
  addProviders(...providers: SMSProvider[]): this {
    this.providers.push(...providers);
    return this;
  }

  /**
   * Set whether to continue on error (broadcast mode)
   */
  setContinueOnError(value: boolean): this {
    this.continueOnError = value;
    return this;
  }

  /**
   * Set whether to log errors
   */
  setLogErrors(value: boolean): this {
    this.logErrors = value;
    return this;
  }

  /**
   * Build the provider chain
   */
  build(): SMSProviderChain {
    return new SMSProviderChain({
      providers: this.providers,
      continueOnError: this.continueOnError,
      logErrors: this.logErrors,
    });
  }
}

/**
 * Create a simple fallback chain
 * Tries primary provider first, falls back to secondary on failure
 */
export function createSMSFallbackChain(
  primary: SMSProvider,
  fallback: SMSProvider
): SMSProviderChain {
  return new SMSProviderChainBuilder()
    .addProvider(primary)
    .addProvider(fallback)
    .build();
}

/**
 * Create a broadcast chain
 * Sends SMS through all providers (for redundancy/testing)
 */
export function createSMSBroadcastChain(...providers: SMSProvider[]): SMSProviderChain {
  return new SMSProviderChainBuilder()
    .addProviders(...providers)
    .setContinueOnError(true)
    .build();
}
