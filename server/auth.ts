/**
 * Verifies the Microsoft Entra ID token the intranet SPA sends as `Authorization: Bearer <id_token>`.
 *
 * The SPA's Graph access tokens can't be verified by a third party, so protected routes accept the
 * MSAL ID token instead: RS256-signed by Entra, audience = the intranet app registration. Signing
 * keys come from the tenant's JWKS endpoint and are cached in the Lambda container.
 *
 * Env (optional overrides; defaults match src/authConfig.ts):
 *   INTRANET_TENANT_ID, INTRANET_CLIENT_ID
 *   INTRANET_API_AUTH_DISABLED=1 — local dev only; skips verification.
 */

import { createPublicKey, createVerify, KeyObject } from 'crypto';
import { fetchWithTimeout } from './fetchWithTimeout';

const DEFAULT_TENANT_ID = '63fbe43e-8963-4cb6-8f87-2ecc3cd029b4';
const DEFAULT_CLIENT_ID = '543ae09d-95e7-47bb-b679-e4428c20918e';
const CLOCK_SKEW_S = 5 * 60;
const JWKS_CACHE_MS = 60 * 60_000;
const JWKS_REFETCH_MIN_INTERVAL_MS = 5 * 60_000;

export class AuthError extends Error {}

/** Signing keys couldn't be loaded (Entra unreachable), so no token can be verified right now. */
export class AuthServiceError extends Error {
  constructor() {
    super('Sign-in verification is temporarily unavailable');
  }
}

export type AuthenticatedUser = {
  email: string;
  name: string;
};

type Jwk = { kid?: string; kty?: string; n?: string; e?: string };
type JwtHeader = { alg?: string; kid?: string; typ?: string };
type JwtClaims = {
  iss?: string;
  aud?: string;
  tid?: string;
  exp?: number;
  nbf?: number;
  preferred_username?: string;
  email?: string;
  upn?: string;
  name?: string;
};

const tenantId = () => process.env.INTRANET_TENANT_ID || DEFAULT_TENANT_ID;
const clientId = () => process.env.INTRANET_CLIENT_ID || DEFAULT_CLIENT_ID;

let jwksCache: { at: number; keys: Map<string, KeyObject> } | null = null;
let jwksInFlight: Promise<void> | null = null;
let lastJwksFetchAt = 0;

async function fetchJwks(): Promise<void> {
  const res = await fetchWithTimeout(`https://login.microsoftonline.com/${tenantId()}/discovery/v2.0/keys`);
  if (!res.ok) throw new Error(`Entra JWKS fetch failed (${res.status})`);
  const body = (await res.json()) as { keys?: Jwk[] };
  const keys = new Map<string, KeyObject>();
  for (const jwk of body.keys || []) {
    if (jwk.kid && jwk.kty === 'RSA') keys.set(jwk.kid, createPublicKey({ key: jwk, format: 'jwk' }));
  }
  jwksCache = { at: Date.now(), keys };
}

/** One shared JWKS fetch at a time; a failure keeps whatever keys are already cached. */
function refreshJwks(): Promise<void> {
  if (!jwksInFlight) {
    lastJwksFetchAt = Date.now();
    jwksInFlight = fetchJwks()
      .catch((err) => {
        console.error('[auth] JWKS fetch failed', err);
      })
      .finally(() => {
        jwksInFlight = null;
      });
  }
  return jwksInFlight;
}

async function getSigningKey(kid: string): Promise<KeyObject> {
  // Refetch when the cache is old or the kid is unknown (Entra rotates keys), but at most every
  // few minutes so tokens with made-up kids or an Entra outage can't make every request hit Entra.
  const stale = !!jwksCache && Date.now() - jwksCache.at >= JWKS_CACHE_MS;
  const unknownKid = !!jwksCache && !jwksCache.keys.has(kid);
  const mayRefetch = Date.now() - lastJwksFetchAt >= JWKS_REFETCH_MIN_INTERVAL_MS;
  if (!jwksCache || ((stale || unknownKid) && mayRefetch)) await refreshJwks();

  if (!jwksCache) throw new AuthServiceError();
  const key = jwksCache.keys.get(kid);
  if (!key) throw new AuthError('Unknown token signing key');
  return key;
}

function decodeSegment<T>(segment: string): T {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as T;
  } catch {
    throw new AuthError('Malformed token');
  }
}

/** Verify an Entra ID token (signature, issuer, audience, tenant, lifetime) and return the user. */
export async function verifyIdToken(token: string): Promise<AuthenticatedUser> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new AuthError('Malformed token');
  const [headerB64, payloadB64, signatureB64] = parts;
  const header = decodeSegment<JwtHeader>(headerB64);
  const claims = decodeSegment<JwtClaims>(payloadB64);

  if (header.alg !== 'RS256' || !header.kid) throw new AuthError('Unsupported token algorithm');
  const key = await getSigningKey(header.kid);
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  if (!verifier.verify(key, Buffer.from(signatureB64, 'base64url'))) {
    throw new AuthError('Invalid token signature');
  }

  const now = Math.floor(Date.now() / 1000);
  if (claims.tid !== tenantId()) throw new AuthError('Token is from another tenant');
  if (claims.iss !== `https://login.microsoftonline.com/${tenantId()}/v2.0`) {
    throw new AuthError('Unexpected token issuer');
  }
  if (claims.aud !== clientId()) throw new AuthError('Token is not for the intranet');
  if (!claims.exp || claims.exp + CLOCK_SKEW_S < now) throw new AuthError('Token expired');
  if (claims.nbf && claims.nbf - CLOCK_SKEW_S > now) throw new AuthError('Token not yet valid');

  const email = (claims.preferred_username || claims.email || claims.upn || '').toLowerCase();
  if (!email) throw new AuthError('Token has no user');
  return { email, name: claims.name || email };
}

/**
 * Authenticate a request from its Authorization header. Returns null when auth is disabled
 * for local dev (INTRANET_API_AUTH_DISABLED=1); throws AuthError when the caller isn't signed in.
 */
export async function authenticateRequest(
  authorizationHeader: string | undefined
): Promise<AuthenticatedUser | null> {
  // Local dev only: never honour the bypass inside Lambda, even if the env var is set there.
  if (process.env.INTRANET_API_AUTH_DISABLED === '1' && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader || '');
  if (!match) throw new AuthError('Sign in to use this endpoint');
  return verifyIdToken(match[1].trim());
}
