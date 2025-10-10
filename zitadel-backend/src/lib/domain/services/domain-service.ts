/**
 * Domain Service
 * 
 * Business logic for domain validation and management
 */

import { DomainName } from '../value-objects';
import { OrgDomain, DomainValidationType } from '../entities/organization';
import { throwInvalidArgument, throwAlreadyExists } from '@/zerrors/errors';

/**
 * Domain service for validation and generation
 */
export class DomainService {
  /**
   * Generate IAM domain from organization name
   */
  static generateIAMDomain(orgName: string, iamDomain: string): string {
    // Convert org name to valid domain label
    let label = orgName
      .toLowerCase()
      .replace(/\s+/g, '-')  // Replace spaces with hyphens
      .replace(/[^a-z0-9-]/g, '')  // Remove invalid characters
      .substring(0, 63);  // Max 63 characters per label
    
    // Remove leading/trailing hyphens
    label = label.replace(/^-+|-+$/g, '');
    
    if (label.length === 0) {
      label = 'org';
    }
    
    return `${label}.${iamDomain}`;
  }

  /**
   * Validate domain format
   */
  static validateDomain(domain: string): void {
    try {
      new DomainName(domain);
    } catch (error) {
      throwInvalidArgument('Invalid domain format', 'DOMAIN-SERVICE-001');
    }
  }

  /**
   * Check if domain is unique in list
   */
  static isDomainUnique(domain: string, existingDomains: OrgDomain[]): boolean {
    const normalizedDomain = domain.toLowerCase();
    return !existingDomains.some(
      d => d.domain.toLowerCase() === normalizedDomain
    );
  }

  /**
   * Validate domain is unique, throw if not
   */
  static ensureDomainUnique(domain: string, existingDomains: OrgDomain[]): void {
    if (!this.isDomainUnique(domain, existingDomains)) {
      throwAlreadyExists('Domain already exists', 'DOMAIN-SERVICE-002');
    }
  }

  /**
   * Get primary domain from list
   */
  static getPrimaryDomain(domains: OrgDomain[]): OrgDomain | undefined {
    return domains.find(d => d.isPrimary);
  }

  /**
   * Get verified domains from list
   */
  static getVerifiedDomains(domains: OrgDomain[]): OrgDomain[] {
    return domains.filter(d => d.isVerified);
  }

  /**
   * Generate DNS TXT record for verification
   */
  static generateDNSTXTRecord(verificationCode: string): string {
    return `zitadel-verification=${verificationCode}`;
  }

  /**
   * Generate HTTP verification URL
   */
  static generateHTTPVerificationURL(domain: string, verificationCode: string): string {
    return `https://${domain}/.well-known/zitadel-challenge/${verificationCode}`;
  }

  /**
   * Validate verification code format
   */
  static validateVerificationCode(code: string): void {
    if (!code || code.length === 0) {
      throwInvalidArgument('Verification code cannot be empty', 'DOMAIN-SERVICE-003');
    }

    if (!/^[A-Za-z0-9]{16,64}$/.test(code)) {
      throwInvalidArgument(
        'Verification code must be alphanumeric, 16-64 characters',
        'DOMAIN-SERVICE-004'
      );
    }
  }
}

/**
 * Domain verification service
 */
export class DomainVerificationService {
  /**
   * Verify domain via HTTP
   */
  async verifyHTTP(domain: string, verificationCode: string): Promise<boolean> {
    try {
      const url = DomainService.generateHTTPVerificationURL(domain, verificationCode);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Zitadel-Domain-Verification/1.0',
        },
      });

      if (!response.ok) {
        return false;
      }

      const content = await response.text();
      return content.trim() === verificationCode;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verify domain via DNS TXT record
   */
  async verifyDNS(domain: string, verificationCode: string): Promise<boolean> {
    try {
      const dns = require('dns').promises;
      const txtRecords = await dns.resolveTxt(domain);
      
      const expectedRecord = DomainService.generateDNSTXTRecord(verificationCode);
      
      for (const record of txtRecords) {
        const recordValue = Array.isArray(record) ? record.join('') : record;
        if (recordValue === expectedRecord) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verify domain based on validation type
   */
  async verify(
    domain: OrgDomain,
    verificationCode: string
  ): Promise<boolean> {
    DomainService.validateVerificationCode(verificationCode);

    switch (domain.validationType) {
      case DomainValidationType.HTTP:
        return this.verifyHTTP(domain.domain, verificationCode);
      case DomainValidationType.DNS:
        return this.verifyDNS(domain.domain, verificationCode);
      default:
        return false;
    }
  }
}
