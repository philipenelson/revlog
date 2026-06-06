# Nodemailer for transactional email

Managed SDKs (Resend, SendGrid, Postmark) require service accounts and API keys to send any email, including in development. This makes local development dependent on an external service and bypasses the real email code path unless a staging account is configured. Nodemailer speaks plain SMTP: in development it connects to Mailpit (a local SMTP catcher running in Docker); in production it connects to any SMTP relay by changing four environment variables. The code path is identical in both environments.

Mailpit (`axllent/mailpit`) was chosen over MailHog (`mailhog/mailhog`) because MailHog is unmaintained and only ships an `amd64` image, causing platform warnings on Apple Silicon. Mailpit is its actively maintained successor with native `arm64` support and an identical interface.

The production SMTP relay is TBD. Resend is the preferred provider when the time comes — it offers a generous free tier, strong deliverability, and an SMTP bridge that drops in without code changes. See the V1 milestone pre-production checklist.

## Status

accepted

## Trade-offs

- No built-in delivery tracking, bounce handling, or analytics. Acceptable for V1 scale; a managed provider can be dropped in later without code changes.
- Mailpit must be running locally for email to work. `pnpm db` starts it alongside Postgres — this is documented in the README and is the intended dev workflow.
- Nodemailer is CommonJS-first; types are in `@types/nodemailer`. Works cleanly with the API's CommonJS output target.
