import type {
  TokenService,
  AccessTokenPayload,
  SignedAccessToken,
} from '../../application/ports/TokenService';
import {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from '../../lib/tokens';

// Driven adapter (ADR 0039): implements the TokenService port with JWT (jose) +
// SHA-256, delegating to the token utility in lib/tokens.
export class JwtTokenService implements TokenService {
  signAccessToken(payload: AccessTokenPayload): Promise<SignedAccessToken> {
    return signAccessToken(payload);
  }

  verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return verifyAccessToken(token);
  }

  generateRefreshToken(): { raw: string; hash: string } {
    return generateRefreshToken();
  }

  hashRefreshToken(raw: string): string {
    return hashRefreshToken(raw);
  }
}
