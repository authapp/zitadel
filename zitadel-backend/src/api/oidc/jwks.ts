/**
 * JWKS Endpoint
 * 
 * JSON Web Key Set endpoint for public key discovery
 */

import { Request, Response, NextFunction } from 'express';
import { getKeyManager } from './key-manager';

/**
 * JWKS endpoint handler
 * GET /.well-known/jwks.json
 */
export async function jwksHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const keyManager = await getKeyManager();
    const jwks = await keyManager.getJWKS();

    // Cache for 1 hour
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(jwks);
  } catch (error) {
    next(error);
  }
}
