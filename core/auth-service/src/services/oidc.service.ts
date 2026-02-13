import jwt, { JwtHeader, SigningKeyCallback } from 'jsonwebtoken';
import jwksClient, { JwksClient } from 'jwks-rsa';
import { config } from '../config';
import { logger } from '../middleware/logger';
import type { JWTPayload, Actor } from '@autoecops/shared-types';

const JWKS_RATELIMIT = true;
const JWKS_CACHE = true;

let client: JwksClient;

export function initJwksClient(): void {
  const jwksUri = config.JWKS_URI
    ?? `${config.OIDC_ISSUER_URL}/protocol/openid-connect/certs`;

  client = jwksClient({
    jwksUri,
    cache: JWKS_CACHE,
    cacheMaxAge: config.JWKS_CACHE_TTL_SECONDS * 1000,
    rateLimit: JWKS_RATELIMIT,
    jwksRequestsPerMinute: 10,
  });

  logger.info({ jwksUri }, 'JWKS client initialized');
}

function getSigningKey(header: JwtHeader, callback: SigningKeyCallback): void {
  if (!header.kid) {
    callback(new Error('JWT header missing kid'));
    return;
  }
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export async function verifyToken(token: string): Promise<JWTPayload> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getSigningKey,
      {
        issuer: config.OIDC_ISSUER_URL,
        audience: config.OIDC_AUDIENCE,
        algorithms: ['RS256', 'RS384', 'RS512', 'ES256', 'ES384'],
        clockTolerance: 5,
      },
      (err, decoded) => {
        if (err) {
          logger.warn({ error: err.message }, 'Token verification failed');
          reject(err);
          return;
        }
        resolve(decoded as JWTPayload);
      },
    );
  });
}

export function extractActorFromPayload(payload: JWTPayload): Actor {
  return {
    id: payload.sub,
    type: 'user',
    roles: payload.roles ?? [],
    permissions: payload.permissions ?? [],
    tenantId: payload.tenantId,
  };
}

export async function introspectToken(token: string): Promise<{ active: boolean; payload?: JWTPayload }> {
  try {
    const payload = await verifyToken(token);
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return { active: false };
    }
    return { active: true, payload };
  } catch {
    return { active: false };
  }
}
