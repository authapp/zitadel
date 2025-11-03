/**
 * SAML IdP Metadata Handler
 * 
 * Provides SAML metadata endpoint for Service Providers
 */

import { Request, Response } from 'express';
import { generateIdPMetadata } from '../utils/saml-generator';
import { SAMLIdPMetadata, SAMLNameIDFormat } from '../types';

/**
 * GET /saml/metadata
 * 
 * Returns SAML IdP metadata XML for SP configuration
 */
export async function getMetadata(req: Request, res: Response): Promise<void> {
  try {
    // Get base URL from request
    const protocol = req.protocol;
    const host = req.get('host') || 'localhost:3000';
    const baseURL = `${protocol}://${host}`;

    // TODO: In production, load cert from secure storage
    // For now, generate a placeholder certificate
    const placeholderCert = generatePlaceholderCertificate();

    const metadata: SAMLIdPMetadata = {
      entityID: `${baseURL}/saml/metadata`,
      singleSignOnServiceURL: `${baseURL}/saml/sso`,
      singleLogoutServiceURL: `${baseURL}/saml/logout`,
      x509Certificate: placeholderCert,
      nameIDFormats: [
        SAMLNameIDFormat.EMAIL,
        SAMLNameIDFormat.PERSISTENT,
        SAMLNameIDFormat.TRANSIENT
      ],
      wantAuthnRequestsSigned: false // Set to true in production
    };

    const metadataXML = generateIdPMetadata(metadata);

    res.set('Content-Type', 'application/samlmetadata+xml');
    res.send(metadataXML);

    console.log('✓ SAML IdP metadata provided');
  } catch (error) {
    console.error('Error generating SAML metadata:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to generate SAML metadata'
    });
  }
}

/**
 * Generate placeholder X.509 certificate for testing
 * 
 * In production, this should load actual certificate from:
 * - Key Management Service (KMS)
 * - Secure environment variables
 * - Database with encryption
 */
function generatePlaceholderCertificate(): string {
  // This is a self-signed test certificate (not for production!)
  // In production, use proper PKI infrastructure
  return `MIIDXTCCAkWgAwIBAgIJAKJ8YzgzMjU5MA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
BAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX
aWRnaXRzIFB0eSBMdGQwHhcNMjMwMTAxMDAwMDAwWhcNMjQwMTAxMDAwMDAwWjBF
MQswCQYDVQQGEwJBVTETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50
ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB
CgKCAQEA4dGQ1m3VJMzk8xVG7qV7YJxKqJ5I7NZJKqF8vK4xNNl5fJ2z7xRqKl5G
7qV7YJxKqJ5I7NZJKqF8vK4xNNl5fJ2z7xRqKl5G7qV7YJxKqJ5I7NZJKqF8vK4x
NNl5fJ2z7xRqKl5G7qV7YJxKqJ5I7NZJKqF8vK4xNNl5fJ2z7xRqKl5G7qV7YJxK
qJ5I7NZJKqF8vK4xNNl5fJ2z7xRqKl5GwIDAQABo1AwTjAdBgNVHQ4EFgQU4dGQ
1m3VJMzk8xVG7qV7YJxKqJ4wHwYDVR0jBBgwFoAU4dGQ1m3VJMzk8xVG7qV7YJxK
qJ4wDAYDVR0TBAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEA4dGQ1m3VJMzk8xVG
7qV7YJxKqJ5I7NZJKqF8vK4xNNl5fJ2z7xRqKl5G7qV7YJxKqJ5I7NZJKqF8vK4x
NNl5fJ2z7xRqKl5G7qV7YJxKqJ5I7NZJKqF8vK4xNNl5fJ2z7xRqKl5G`.replace(/\n/g, '');
}
