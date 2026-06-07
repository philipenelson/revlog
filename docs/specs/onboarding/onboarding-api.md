# Onboarding API Spec

**Area:** Onboarding  
**Status:** Implemented  
**Last updated:** 2026-06-07

---

## Overview

Backend implementation of UC-ONBOARD-2 (Skip onboarding) from [onboarding-wizard.md](./onboarding-wizard.md) — `POST /onboarding/skip`.

This endpoint exists to give "Skip for now" a real, persisted effect. Before [ADR 0015](../../adr/0015-account-status-state-machine.md), the wizard spec called this out as an open gap: an Owner who skips still has zero Vehicles, so a routing rule based on vehicle count alone would route them straight back into the wizard on their next sign-in — a redirect loop. `POST /onboarding/skip` closes that gap by transitioning the Account out of `ONBOARDING`, the same way completing the wizard does (see [vehicle-creation-api.md](../garage/vehicle-creation-api.md)).

The route requires authentication via the existing `authenticate` middleware (`apps/api/src/middleware/auth.ts`).

---

## POST /onboarding/skip

### Request

```
POST /onboarding/skip
Authorization: Bearer <accessToken>
```

No request body.

### Responses

| Status | Body | When |
|---|---|---|
| 200 | `{ "status": "ACTIVE" }` | Account's onboarding status resolved (transitioned, or already resolved) |
| 401 | `{ "error": "Missing or invalid authorization header" }` / `{ "error": "Invalid or expired access token" }` | No/invalid/expired bearer token |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

### Side effects

Conditionally transitions the authenticated User's Account from `ONBOARDING` to `ACTIVE` (`UPDATE account SET status = 'ACTIVE' WHERE id = ? AND status = 'ONBOARDING'`) — the same idempotent, conditional write `POST /vehicles` uses to resolve onboarding on the "complete" path. See [ADR 0015](../../adr/0015-account-status-state-machine.md).

No Vehicle is created. The Garage remains empty; its empty state carries its own "add your first vehicle" CTA per [onboarding-wizard.md UC-ONBOARD-2](./onboarding-wizard.md#uc-onboard-2--skip-onboarding).

---

## Acceptance Criteria

- [x] `POST /onboarding/skip` with a valid bearer token and an `ONBOARDING` Account returns 200 `{ status: "ACTIVE" }` and transitions the Account to `ACTIVE`
- [x] `POST /onboarding/skip` with a valid bearer token and an already-`ACTIVE` Account returns 200 `{ status: "ACTIVE" }` without error (idempotent — calling skip twice, or after having already completed onboarding, is not an error)
- [x] `POST /onboarding/skip` with no/invalid/expired bearer token returns 401 and does not change the Account's status
- [ ] *(E2E, tracked on the wizard spec)* "Skip for now" calls this endpoint before navigating to `/garage`, and a subsequent sign-in routes the Owner to `/garage` rather than back into the wizard — see [onboarding-wizard.md Next steps](./onboarding-wizard.md#wire-step-2-to-the-real-vehicle-creation-endpoint)

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Response body includes the resulting status | `200 { status: "ACTIVE" }` rather than a bodiless `204` | The client can apply the post-skip routing decision immediately from this response without an extra round trip to re-fetch the Account — same principle as carrying `account.status` on the verify-email response (see [register-api.md](../auth/register-api.md)) |
| Idempotent, not an error, on an already-`ACTIVE` Account | Returns 200, same body, no side effect | Skipping is a "make it so" action, not a strict state-machine assertion — a double-click, a retried request, or an Owner who already completed onboarding hitting a stale "Skip for now" link should all just land in the same resolved state, not surface an error the UI has to handle specially |
| No request body | None needed | The action is unambiguous given the authenticated Account — there is nothing to parametrize |
| Shared transition mechanism with `POST /vehicles` | Both call `accountRepo.markActive(accountId)` | One conditional, idempotent write implements the entire "resolve onboarding" concept from [ADR 0015](../../adr/0015-account-status-state-machine.md) — two call sites, one rule, no risk of the two paths drifting out of sync |

---

## Out of scope

- Persisting *which* path resolved onboarding (skip vs. complete) for analytics — see [ADR 0015 — "Why a unified `status` field"](../../adr/0015-account-status-state-machine.md) for why this is deliberately not modeled as separate enum values
- Restarting/resetting onboarding for an Account that has already resolved it — no V1 use case requires this, and ADR 0015 does not provide a transition back to `ONBOARDING`
- Partial-progress persistence (closing the tab mid-wizard) — tracked as a V2 roadmap item on [onboarding-wizard.md](./onboarding-wizard.md#persisted-partial-progress)
