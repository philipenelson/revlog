// Outbound port (ADR 0039): access-token signing/verification and refresh-token
// generation/hashing. The application depends on this interface; the JWT
// implementation lives in adapters/token/JwtTokenService.

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

export interface TokenService {
  signAccessToken(payload: AccessTokenPayload): Promise<SignedAccessToken>;
  verifyAccessToken(token: string): Promise<AccessTokenPayload>;
  generateRefreshToken(): { raw: string; hash: string };
  hashRefreshToken(raw: string): string;
}
