/**
 * SMTP TLS Fallback Tests
 */

import { describe, it, expect } from '@jest/globals';
import { SMTPEmailProvider } from '../../../src/lib/notification/smtp-email-service';

describe('SMTP TLS Fallback', () => {
  describe('Configuration', () => {
    it('should accept enableTlsFallback option', () => {
      const provider = new SMTPEmailProvider({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        from: 'test@example.com',
        fromName: 'Test',
        enableTlsFallback: true,
      });

      expect(provider).toBeDefined();
      expect(provider.name).toBe('smtp');
    });

    it('should work without enableTlsFallback (default false)', () => {
      const provider = new SMTPEmailProvider({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        from: 'test@example.com',
        fromName: 'Test',
      });

      expect(provider).toBeDefined();
    });
  });

  describe('Fallback Logic', () => {
    it('should generate correct fallback configs from port 587', () => {
      const provider = new SMTPEmailProvider({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        from: 'test@example.com',
        fromName: 'Test',
        enableTlsFallback: true,
      });

      // Access private method for testing
      const configs = (provider as any).getTlsFallbackConfigs();

      expect(configs.length).toBeGreaterThan(0);
      expect(configs[0].name).toContain('Original');
      expect(configs.some((c: any) => c.name.includes('465'))).toBe(true);
      expect(configs.some((c: any) => c.name.includes('25'))).toBe(true);
    });

    it('should generate correct fallback configs from port 465', () => {
      const provider = new SMTPEmailProvider({
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        from: 'test@example.com',
        fromName: 'Test',
        enableTlsFallback: true,
      });

      const configs = (provider as any).getTlsFallbackConfigs();

      expect(configs[0].name).toContain('Original');
      expect(configs.some((c: any) => c.name.includes('587'))).toBe(true);
      expect(configs.some((c: any) => c.name.includes('25'))).toBe(true);
    });

    it('should not include current port in fallback list', () => {
      const provider = new SMTPEmailProvider({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        from: 'test@example.com',
        fromName: 'Test',
        enableTlsFallback: true,
      });

      const configs = (provider as any).getTlsFallbackConfigs();
      
      // Original config should be first
      expect(configs[0].config.port).toBe(587);
      
      // Should not have duplicate 587 in fallbacks
      const portCounts = configs.filter((c: any) => c.config.port === 587).length;
      expect(portCounts).toBe(1); // Only the original
    });

    it('should set secure flag correctly for each port', () => {
      const provider = new SMTPEmailProvider({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        from: 'test@example.com',
        fromName: 'Test',
        enableTlsFallback: true,
      });

      const configs = (provider as any).getTlsFallbackConfigs();
      
      // Port 465 should be secure
      const tls465 = configs.find((c: any) => c.config.port === 465);
      if (tls465) {
        expect(tls465.config.secure).toBe(true);
      }
      
      // Port 587 and 25 should not be secure
      const starttls587 = configs.find((c: any) => c.config.port === 587);
      if (starttls587) {
        expect(starttls587.config.secure).toBe(false);
      }
    });

    it('should prevent recursive fallback', () => {
      const provider = new SMTPEmailProvider({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        from: 'test@example.com',
        fromName: 'Test',
        enableTlsFallback: true,
      });

      const configs = (provider as any).getTlsFallbackConfigs();
      
      // All fallback configs should have enableTlsFallback: false
      configs.forEach((config: any) => {
        expect(config.config.enableTlsFallback).toBe(false);
      });
    });
  });

  describe('Fallback Order', () => {
    it('should try original config first', () => {
      const provider = new SMTPEmailProvider({
        host: 'smtp.example.com',
        port: 2525, // Custom port
        secure: false,
        from: 'test@example.com',
        fromName: 'Test',
        enableTlsFallback: true,
      });

      const configs = (provider as any).getTlsFallbackConfigs();
      
      expect(configs[0].name).toContain('Original');
      expect(configs[0].config.port).toBe(2525);
    });

    it('should prioritize TLS (465) over STARTTLS (587)', () => {
      const provider = new SMTPEmailProvider({
        host: 'smtp.example.com',
        port: 25, // Starting from plain
        secure: false,
        from: 'test@example.com',
        fromName: 'Test',
        enableTlsFallback: true,
      });

      const configs = (provider as any).getTlsFallbackConfigs();
      
      // Find indices of 465 and 587
      const tls465Index = configs.findIndex((c: any) => c.config.port === 465);
      const starttls587Index = configs.findIndex((c: any) => c.config.port === 587);
      
      // 465 should come before 587
      expect(tls465Index).toBeLessThan(starttls587Index);
    });

    it('should use plain (25) as last resort', () => {
      const provider = new SMTPEmailProvider({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        from: 'test@example.com',
        fromName: 'Test',
        enableTlsFallback: true,
      });

      const configs = (provider as any).getTlsFallbackConfigs();
      
      // Port 25 should be last
      const lastConfig = configs[configs.length - 1];
      expect(lastConfig.config.port).toBe(25);
      expect(lastConfig.name).toContain('Plain');
    });
  });

  describe('Configuration Preservation', () => {
    it('should preserve auth credentials across fallback configs', () => {
      const provider = new SMTPEmailProvider({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'testuser',
          pass: 'testpass',
        },
        from: 'test@example.com',
        fromName: 'Test',
        enableTlsFallback: true,
      });

      const configs = (provider as any).getTlsFallbackConfigs();
      
      // All configs should have the same auth
      configs.forEach((config: any) => {
        expect(config.config.auth).toEqual({
          user: 'testuser',
          pass: 'testpass',
        });
      });
    });

    it('should preserve host across fallback configs', () => {
      const provider = new SMTPEmailProvider({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        from: 'test@example.com',
        fromName: 'Test',
        enableTlsFallback: true,
      });

      const configs = (provider as any).getTlsFallbackConfigs();
      
      // All configs should have the same host
      configs.forEach((config: any) => {
        expect(config.config.host).toBe('smtp.example.com');
      });
    });

    it('should preserve from/fromName across fallback configs', () => {
      const provider = new SMTPEmailProvider({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        from: 'test@example.com',
        fromName: 'Test Sender',
        enableTlsFallback: true,
      });

      const configs = (provider as any).getTlsFallbackConfigs();
      
      configs.forEach((config: any) => {
        expect(config.config.from).toBe('test@example.com');
        expect(config.config.fromName).toBe('Test Sender');
      });
    });
  });
});
