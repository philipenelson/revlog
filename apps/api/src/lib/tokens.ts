import { createHash, randomBytes } from 'crypto';
import { SignJWT, jwtVerify, decodeJwt } from 'jose';

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var is not set');
  return new TextEncoder().encode(secret);
}

export interface AccessTokenPayload {
  sub: string;
  accountId: string;
  role: string;
}

export interface SignedAccessToken {
  token: string;
  /** The token's `exp`, so the client can refresh before it lapses without decoding the JWT. */
  expiresAt: Date;
}

// Access tokens are stateless JWTs — validated on signature + expiry with no DB lookup.
export async function signAccessToken(payload: AccessTokenPayload): Promise<SignedAccessToken> {
  const expiresIn = process.env.JWT_EXPIRES_IN ?? '15m';
  const token = await new SignJWT({ accountId: payload.accountId, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
  // Read back the `exp` jose just computed so the returned expiry is exactly the
  // token's own claim, regardless of how the TTL string was parsed.
  const { exp } = decodeJwt(token);
  return { token, expiresAt: new Date((exp ?? 0) * 1000) };
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return {
    sub: payload.sub as string,
    accountId: payload['accountId'] as string,
    role: payload['role'] as string,
  };
}

// Refresh tokens are opaque random values — only the SHA-256 hash is stored in the DB.
// 32 random bytes = 256 bits of entropy; brute force is infeasible so SHA-256 is sufficient
// (bcrypt's cost factor is unnecessary for high-entropy tokens).
export function generateRefreshToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
