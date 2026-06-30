import { LegalPageShell } from "./LegalPageShell";
import styles from "./legal.module.css";

export function CookiesScreen() {
  return (
    <LegalPageShell currentPath="/cookies">
      <h1 className={styles.title}>Cookie Policy</h1>
      <p className={styles.effectiveDate}>Effective: 30 June 2026</p>

      <div className={styles.section}>
        <h2 className={styles.sectionHeading}>What is a cookie?</h2>
        <div className={styles.body}>
          <p>
            A cookie is a small piece of text that a website stores in your
            browser. Cookies serve many purposes: keeping you logged in,
            remembering preferences, tracking behaviour across sites, and more.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionHeading}>The one cookie Revlog uses</h2>
        <div className={styles.body}>
          <p>
            Revlog uses exactly one cookie. It is strictly necessary for the
            service to function.
          </p>
          <ul>
            <li>
              <strong>Name:</strong> <code>refreshToken</code>
            </li>
            <li>
              <strong>Purpose:</strong> Keeps you signed in between page loads.
              Without it you would need to re-enter your password every time you
              navigate to a new page.
            </li>
            <li>
              <strong>Type:</strong> HttpOnly, Secure, SameSite=Strict — it
              cannot be read by JavaScript, cannot be sent over unencrypted
              connections, and cannot be sent in cross-site requests.
            </li>
            <li>
              <strong>Lifetime:</strong> Browser session — the cookie is deleted
              automatically when you close your browser tab or window. No
              persistent login in V1.
            </li>
            <li>
              <strong>Set by:</strong> revlog.app (first-party only)
            </li>
          </ul>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionHeading}>No tracking or analytics cookies</h2>
        <div className={styles.body}>
          <p>
            We do not use advertising cookies, social media tracking pixels,
            analytics tools (such as Google Analytics), or any other cookies
            that monitor your behaviour across websites. The only data the
            cookie carries is a signed authentication token — nothing about
            what you do on the site.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionHeading}>Do we need your consent?</h2>
        <div className={styles.body}>
          <p>
            Under GDPR and the UK/EU Privacy and Electronic Communications
            Regulations (PECR), strictly necessary cookies do not require your
            consent because the service cannot be provided without them. We
            inform you of their use here as a matter of transparency rather
            than legal requirement.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionHeading}>How to clear cookies</h2>
        <div className={styles.body}>
          <p>
            You can delete or block cookies at any time through your browser
            settings. Clearing the Revlog cookie will sign you out. To find
            the option in your browser, look for &ldquo;Privacy and
            Security&rdquo; or &ldquo;Clear browsing data&rdquo; in the
            settings menu.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionHeading}>Questions</h2>
        <div className={styles.body}>
          <p>
            Questions about how we use cookies? Email us at{" "}
            <a href="mailto:hello@revlog.app" className={styles.bodyLink}>
              hello@revlog.app
            </a>
            .
          </p>
        </div>
      </div>
    </LegalPageShell>
  );
}
