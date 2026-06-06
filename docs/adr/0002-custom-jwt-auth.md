# Custom JWT auth over NextAuth

NextAuth v5 (Auth.js) would be the obvious choice for a Next.js app, but it abstracts away the patterns interviewers actually ask about. Rolling fully custom would require building OAuth flows from scratch — high time cost, high testing burden. The middle ground: custom JWT auth using `jose` (signing/verification) and `bcrypt` (password hashing), credentials-only for V1. The auth layer is ~200–300 lines across the stack, fully owned and explainable, with no framework magic. Express middleware validates tokens; Next.js middleware does the same for page/route protection; React Native stores tokens in SecureStore.

## Status

accepted

## Token design

Authentication is performed against a **User**, not an Account (see `CONTEXT.md` — a single Account can hold multiple Users with different roles). The JWT access token payload must therefore carry User-level identity:

```json
{
  "sub": "<userId>",
  "accountId": "<accountId>",
  "role": "owner",
  "iat": 1234567890,
  "exp": 1234568790
}
```

- `sub` — the User's ID (standard JWT subject claim)
- `accountId` — the Account the User belongs to; used for data scoping
- `role` — the User's role within their Account; used for authorisation

The refresh token carries only `sub` (userId) and its own expiry. It is stored as an HTTP-only, Secure, SameSite=Strict session cookie (no `Max-Age` in V1). It is rotated on every use.

## V2 consideration

Add OAuth sign-in on top of the existing JWT infrastructure. The custom JWT layer stays underneath — OAuth only handles the identity verification step, not the session model. Evaluate available auth libraries at implementation time (Auth.js, Lucia, Better Auth, Clerk); provider support depends on the chosen library.
