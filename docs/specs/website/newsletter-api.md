# Newsletter Subscription API Spec

**Area:** Website
**Status:** Planned
**Last updated:** 2026-06-10

---

## Overview

Backend implementation for UC-WEBSITE-6 and UC-WEBSITE-7 from [`landing-page.md`](./landing-page.md). One endpoint, on the existing `apps/api`:

- `POST /newsletter/subscribe` — records an email address for development/release updates

Validation uses a Zod schema from `packages/domain` (see [ADR 0010](../../adr/0010-zod-validation.md)), following the same routes/services/repositories layering as the rest of `apps/api` (`apps/api/CLAUDE.md`). This endpoint is unauthenticated and unrelated to the Account/User domain — see [ADR 0020](../../adr/0020-marketing-website.md) for why it lives on the existing API rather than a new backend.

---

## POST /newsletter/subscribe

### Request

```
POST /newsletter/subscribe
Content-Type: application/json
```

```json
{
  "email": "string — valid email format"
}
```

### Input sanitization

Applied by a Zod transform in `newsletterSubscribeSchema` before the service receives any data:

| Field | Transform |
|---|---|
| `email` | Trim whitespace, normalize to lowercase, max 254 characters (RFC 5321 limit) |

### Responses

| Status | Body | When |
|---|---|---|
| 201 | `{ "message": "You're subscribed — thanks for following along." }` | New subscriber recorded |
| 200 | `{ "message": "You're subscribed — thanks for following along." }` | Email was already subscribed (idempotent — same body as 201) |
| 400 | `{ "error": "Invalid input", "details": [...] }` | Zod validation failure (missing/empty/malformed/too-long email) |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

### Side effects

1. Look up `NewsletterSubscriber` by email
2. If not found: create a `NewsletterSubscriber` row (`email`, `createdAt`) and log via `logger.info`
3. If found: no write; log via `logger.info` that the email is already subscribed

---

## Acceptance Criteria

- [ ] Valid, new email → 201, one `NewsletterSubscriber` row created with the normalized email
- [ ] Same email submitted again → 200, no duplicate row, same response body as 201
- [ ] `"  Test@Example.COM "` is normalized to `"test@example.com"` before lookup/storage
- [ ] Missing or empty `email` → 400 with Zod details
- [ ] Malformed email (no `@`, etc.) → 400 with Zod details
- [ ] Email longer than 254 characters → 400 with Zod details
- [ ] Unexpected repository failure → 500 via the global error middleware (no raw error exposed)

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Storage | New `NewsletterSubscriber` Prisma model (`id`, `email` unique, `createdAt`), unrelated to `User`/`Account` | Newsletter signups are anonymous and unauthenticated; coupling them to the Account/User domain would be incorrect and would complicate the auth schema |
| Idempotent resubscribe | `findByEmail` then conditional `create`; both branches return the same message body (200 vs 201 only) | A repeat signup is not an error from the visitor's perspective — the form should show the same confirmation either way (UC-WEBSITE-6) |
| Max length | 254 characters | RFC 5321 maximum total email address length |
| Email normalization | Trim + lowercase, same as `registerSchema`/`loginSchema` (see [`packages/domain/src/schemas/auth.ts`](../../../packages/domain/src/schemas/auth.ts)) | Consistency with existing email handling; ensures `Test@Example.COM` and `test@example.com` are treated as the same subscriber |

---

## Out of scope

- Unsubscribe endpoint / unsubscribe links (V2)
- Double opt-in confirmation email (V2)
- Sending actual newsletter campaigns / email service provider integration (V2 — separate ADR when implemented)
- Rate limiting (V2, same as `POST /auth/register` — see [register-api.md](../auth/register-api.md) Out of scope)
