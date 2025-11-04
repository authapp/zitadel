/**
 * SAML LogoutRequest Parser
 * 
 * Parses SAML LogoutRequest from Service Provider
 */

import { Request } from 'express';
import * as zlib from 'zlib';
import { promisify } from 'util';

const inflateRaw = promisify(zlib.inflateRaw);

export interface SAMLLogoutRequest {
  id: string;
  issuer: string;
  nameID?: string;
  sessionIndex?: string;
  destination?: string;
}

export interface ParsedLogoutRequest {
  samlRequest: SAMLLogoutRequest | null;
  relayState?: string;
  binding: 'HTTP-POST' | 'HTTP-Redirect';
}

/**
 * Parse SAML LogoutRequest from HTTP request
 */
export async function parseSAMLLogoutRequest(req: Request): Promise<ParsedLogoutRequest> {
  const binding = req.method === 'POST' ? 'HTTP-POST' : 'HTTP-Redirect';
  const samlRequestEncoded = (req.body?.SAMLRequest || req.query?.SAMLRequest) as string;
  const relayState = (req.body?.RelayState || req.query?.RelayState) as string | undefined;

  if (!samlRequestEncoded) {
    return { samlRequest: null, relayState, binding };
  }

  try {
    // Decode base64
    let samlRequestXML: string;
    
    if (binding === 'HTTP-Redirect') {
      // HTTP-Redirect uses deflate compression
      const compressed = Buffer.from(samlRequestEncoded, 'base64');
      const decompressed = await inflateRaw(compressed);
      samlRequestXML = decompressed.toString('utf8');
    } else {
      // HTTP-POST uses plain base64
      samlRequestXML = Buffer.from(samlRequestEncoded, 'base64').toString('utf8');
    }

    // Parse XML using simple regex (production should use proper XML parser)
    const idMatch = samlRequestXML.match(/ID="([^"]+)"/);
    const issuerMatch = samlRequestXML.match(/<saml:Issuer[^>]*>([^<]+)<\/saml:Issuer>/) ||
                        samlRequestXML.match(/<Issuer[^>]*>([^<]+)<\/Issuer>/);
    const nameIDMatch = samlRequestXML.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/) ||
                        samlRequestXML.match(/<NameID[^>]*>([^<]+)<\/NameID>/);
    const sessionIndexMatch = samlRequestXML.match(/<saml:SessionIndex[^>]*>([^<]+)<\/saml:SessionIndex>/) ||
                               samlRequestXML.match(/<SessionIndex[^>]*>([^<]+)<\/SessionIndex>/);
    const destinationMatch = samlRequestXML.match(/Destination="([^"]+)"/);

    if (!idMatch || !issuerMatch) {
      throw new Error('Invalid LogoutRequest: Missing ID or Issuer');
    }

    const samlRequest: SAMLLogoutRequest = {
      id: idMatch[1],
      issuer: issuerMatch[1],
      nameID: nameIDMatch ? nameIDMatch[1] : undefined,
      sessionIndex: sessionIndexMatch ? sessionIndexMatch[1] : undefined,
      destination: destinationMatch ? destinationMatch[1] : undefined,
    };

    return { samlRequest, relayState, binding };
  } catch (error: any) {
    console.error('Failed to parse SAMLRequest:', error.message);
    return { samlRequest: null, relayState, binding };
  }
}
