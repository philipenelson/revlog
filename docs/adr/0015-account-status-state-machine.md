# Account status state machine for onboarding completion

## Context

The onboarding wizard spec (`docs/specs/onboarding/onboarding-wizard.md`) ships a 3-step flow that asks a brand-new Owner to add their first Vehicle, with a "Skip for now" escape hatch. The post-login/post-verification routing rule that decides whether to show the wizard at all was specified as:

> 0 vehicles in Garage → redirect to Onboarding wizard
> 1+ vehicles → redirect to Garage

The spec itself flagged this as incomplete:

> A user who skips still has 0 vehicles, so without an explicit "onboarding skipped/completed" signal stored somewhere, they'd be routed straight back into the wizard on their next sign-in — a redirect loop.

It proposed two candidate shapes for that missing signal:

- An **Account-level status field**, e.g. `onboardingStatus: PENDING | SKIPPED | COMPLETED`
- A **User-level preference/config object**

Both were left open pending an ADR ("this is an architecture decision — it needs an ADR once chosen").

## Decision

Add a `status` field directly to `Account` — not a separate `onboardingStatus` field, and not anything on `User`:

```prisma
enum AccountStatus {
  ONBOARDING
  ACTIVE
}

model Account {
  ...
  status AccountStatus @default(ONBOARDING)
}
```

This is a **two-state, one-way funnel** — there are no transitions back to `ONBOARDING` in V1:

| State | Meaning | Entered when |
|---|---|---|
| `ONBOARDING` | The Garage has not yet been resolved — the wizard should be shown | Account creation (default) |
| `ACTIVE` | The Garage has been resolved, one way or another | Either: (a) the Owner adds a first Vehicle (`POST /vehicles` while `ONBOARDING`), or (b) the Owner explicitly skips (`POST /onboarding/skip`) |

The post-login/post-verification routing rule collapses to a single check: `status === 'ONBOARDING'` → Onboarding wizard, `status === 'ACTIVE'` → Garage. This directly closes the redirect-loop gap — skipping now has a real, persisted effect.

### Why Account, not User

`CONTEXT.md` is explicit that "Vehicles belong to an Account, not to individual Users," and that Garage is "a user's collection of registered vehicles" scoped at the Account level. Onboarding exists *to populate the Garage* — it is therefore an Account-level concern, the same way the Garage itself is. This also "naturally extends to multi-User Accounts in V2 (the Account 'completes' onboarding once, not each User)," which the spec called out as a desirable property of the Account-level shape.

### Why a unified `status` field, not a parallel `onboardingStatus` field

The spec's first candidate shape (`onboardingStatus: PENDING | SKIPPED | COMPLETED` as a field alongside whatever else `Account` tracks) would have created a second piece of lifecycle state to keep in sync. In V1, "has the Garage been resolved" *is* the Account's entire lifecycle story after creation — there is nothing else for an Account-level status to mean yet. Folding it into the Account's own `status` avoids a parallel field that exists solely to answer one question, and gives the Account a general-purpose lifecycle slot that V2 states (e.g. `SUSPENDED`) can extend later without restructuring.

We collapsed the spec's three proposed values (`PENDING | SKIPPED | COMPLETED`) down to two (`ONBOARDING | ACTIVE`). `SKIPPED` and `COMPLETED` would only ever matter for analytics ("how many Owners skip vs. complete"), not for routing — both resolve the Garage and both should land an Owner in the same place next time they sign in. Conflating a routing signal with an analytics signal in one enum would force every future routing check to enumerate both terminal values. If skip-vs-complete analytics become a real need, that's a separate, additive concern (e.g. an event log), not a reason to grow this state machine.

## Alternatives considered

### Three states: `NEW → ONBOARDING → ACTIVE`

An earlier framing of this decision considered adding a third state representing "registered, nobody has verified their email yet," to give the Account-level status full lifecycle coverage from creation. This was rejected: **email verification is already a User-level concern**, fully captured by `User.emailVerified`. Mirroring it at the Account level would create a second source of truth for the same fact, and raises a question V1 doesn't need to answer: in a V2 multi-User Account, *which* User's verification flips the Account out of "new"? Keeping `AccountStatus` scoped to "has the Garage been resolved" avoids that question entirely — it has exactly one job, and User-level facts stay on `User`.

### User-level field (the spec's second candidate shape)

Rejected for the same domain-model reason as above: onboarding exists to populate the *Garage*, and the Garage belongs to the *Account*. A User-level field would also need an explicit rule for what happens to a multi-User V2 Account where one User has "completed" onboarding and another hasn't — a rule that the Account-level shape sidesteps by construction (the Garage either has Vehicles or it doesn't, regardless of who's looking at it).

### Keep the vehicle-count check, just persist "skipped" separately

Rejected because it's strictly worse than a status field along a different axis: vehicle count is **not monotonic**. An Owner who completes onboarding and later deletes their only Vehicle would, under a count-based rule, be funneled straight back into the wizard — even though they've already been through it. `AccountStatus.ACTIVE` is a one-way door: once the Garage has been resolved, it stays resolved, independent of how many Vehicles exist at any later point in time.

## Consequences

- The post-login/post-verification routing rule becomes a single field check instead of a vehicle-count query — simpler and cheaper
- `POST /vehicles` and `POST /onboarding/skip` both need to transition `ONBOARDING → ACTIVE`; both do so via the same idempotent, conditional repository write (`UPDATE account SET status = 'ACTIVE' WHERE id = ? AND status = 'ONBOARDING'`) — see `docs/specs/garage/vehicle-creation-api.md` and `docs/specs/onboarding/onboarding-api.md`
- `GET /auth/verify-email` (and, later, `POST /auth/login`) must surface `account.status` in its response so the client can apply the routing rule without an extra round trip
- No migration path back to `ONBOARDING` is needed or provided in V1 — if a future requirement needs to re-run onboarding for an existing Account, that's a new decision to make at that time, not a gap in this one
