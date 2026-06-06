# Dependency injection over global singletons in services

## Context

A common pattern in Express and Next.js apps (including large open-source projects like Cal.com) is to import a global Prisma singleton directly inside service functions:

```ts
// Global singleton pattern
import { prisma } from '../lib/prisma';

export class AuthService {
  async register(input) {
    const existing = await prisma.user.findUnique(...); // coupled to Prisma
  }
}
```

This is simple and works at runtime, but has one hard consequence: **the service cannot be unit-tested without either hitting a real database or mocking the entire Prisma module**. Both paths are undesirable — real DB in unit tests is slow and couples tests to migration state; module mocking is brittle and tests Prisma internals rather than business logic.

## Decision

Services receive **all I/O-touching dependencies through the constructor** — repositories (as domain interfaces), email service, and any other collaborator that performs I/O. Services never import concrete infrastructure modules directly.

```ts
// DI pattern
export class AuthService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly refreshTokenRepo: IRefreshTokenRepository,
    private readonly emailService: IEmailService,
  ) {}

  async register(input) {
    const existing = await this.userRepo.findByEmail(input.email); // interface, not Prisma
  }
}
```

The **composition root** is `src/app.ts` — the only place that instantiates concrete implementations and wires them together:

```ts
const authService = new AuthService(
  new PrismaUserRepository(prisma),
  new PrismaRefreshTokenRepository(prisma),
  { sendVerificationEmail },
);
app.use('/auth', createAuthRouter(authService));
```

Routes are also factories (`createAuthRouter(authService)`) so they can be tested with a mock service injected.

## Why not a DI container (tsyringe, InversifyJS)?

A DI container adds decorator syntax, reflect-metadata, and non-trivial configuration for a codebase with one API service and a handful of routes. Constructor injection with explicit wiring in `app.ts` is sufficient and immediately readable. Introduce a container if the manual wiring in `app.ts` becomes unmanageable (a dozen+ services).

## Trade-offs

- Slightly more boilerplate at the composition root vs. import-and-call globals.
- Dependencies are explicit and visible in the constructor signature — considered a feature, not a cost.
- Unit tests pass fake implementations that implement the same interface — no mocking framework needed for the happy path.
- Global singletons like the logger (`logger.info(...)`) are acceptable exceptions — they have no state, no I/O side effects in tests, and are not worth injecting.
