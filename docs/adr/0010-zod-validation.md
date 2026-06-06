# Zod for input validation, shared via packages/domain

`express-validator` is Express-idiomatic but lives only in the API — validation logic cannot be shared with the web app. `joi` is mature but not TypeScript-native and produces types separately from schemas. Zod was chosen because schemas are the types: `z.infer<typeof schema>` eliminates a separate type-declaration layer, and schemas placed in `packages/domain` are importable by both the API and the Next.js frontend.

The primary motivator is the password validation rule (Unicode-aware: `\p{L}`, `\p{N}`). This rule must be identical on client and server. Defining it once in `packages/domain` and importing it in both places prevents drift.

## Status

accepted

## Trade-offs

- `packages/domain` gains its first runtime dependency. Zod is zero-dependency itself, so the footprint is minimal — acceptable.
- `packages/domain` is imported by the mobile app. The Zod schemas in `auth.ts` are not used by mobile in V1, but the dependency is present. This is fine; Zod works in React Native.
- Zod parse errors are detailed objects, not strings. Route handlers must map them to HTTP responses explicitly — this is intentional (no magic error formatting).
