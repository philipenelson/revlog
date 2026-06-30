import Link from "next/link";
import { LegalPageShell } from "./LegalPageShell";
import styles from "./legal.module.css";

export function PrivacyScreen() {
  return (
    <LegalPageShell currentPath="/privacy">
      <h1 className={styles.title}>Privacy Policy</h1>
      <p className={styles.effectiveDate}>Effective: 30 June 2026</p>

      <div className={styles.section}>
        <h2 className={styles.sectionHeading}>What we collect</h2>
        <div className={styles.body}>
          <p>
            To provide the Revlog service we collect and store the following
            information:
          </p>
          <ul>
            <li>
              <strong>Account data</strong> — your full name, email address,
              and hashed password when you register
            </li>
            <li>
              <strong>Vehicle data</strong> — make, model, year, mileage, VIN,
              colour, and any photos you upload for vehicles you add to your
              Garage
            </li>
            <li>
              <strong>Service history</strong> — log entries you create,
              including dates, mileage, entry type, parts used, costs, and any
              notes or media you attach
            </li>
            <li>
              <strong>Insurance records</strong> — insurer name, policy number,
              and cover dates if you choose to add them
            </li>
            <li>
              <strong>Usage data</strong> — server logs (IP address, timestamps,
              HTTP method and path) retained for up to 90 days for security and
              debugging purposes
            </li>
          </ul>
          <p>
            We do not collect payment information. There is no paid tier in V1
            of Revlog.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionHeading}>How we use your data</h2>
        <div className={styles.body}>
          <p>We use the data we collect solely to:</p>
          <ul>
            <li>Provide and operate the Revlog service</li>
            <li>
              Authenticate you and keep your session secure (see our{" "}
              <Link href="/cookies" className={styles.bodyLink}>
                Cookie Policy
              </Link>
              )
            </li>
            <li>Send transactional emails you request (email verification, password reset)</li>
            <li>Diagnose and fix bugs and security issues</li>
          </ul>
          <p>
            We do not sell your data. We do not share your personal data with
            third parties for marketing or analytics purposes.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionHeading}>Data storage and retention</h2>
        <div className={styles.body}>
          <p>
            Your data is stored on servers in the European Union. We retain your
            account data and service history for as long as your account remains
            active. If you delete your account we will remove all associated
            personal data within 30 days.
          </p>
          <p>
            Server logs are retained for up to 90 days and then deleted
            automatically.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionHeading}>Third-party services</h2>
        <div className={styles.body}>
          <p>
            Revlog V1 does not share your personal data with any third-party
            services. We use no third-party analytics, advertising networks, or
            social tracking on the application.
          </p>
          <p>
            Transactional emails (verification links, password resets) are
            delivered via an SMTP relay. The email relay processes only your
            email address and the content of the email being sent; it does not
            receive your service history or vehicle data.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionHeading}>Your rights (GDPR — EU/EEA)</h2>
        <div className={styles.body}>
          <p>
            If you are located in the EU or EEA, you have the following rights
            under the General Data Protection Regulation:
          </p>
          <ul>
            <li>
              <strong>Access</strong> — request a copy of the personal data we
              hold about you
            </li>
            <li>
              <strong>Rectification</strong> — ask us to correct inaccurate or
              incomplete data
            </li>
            <li>
              <strong>Erasure</strong> — request deletion of your personal data
              (&ldquo;right to be forgotten&rdquo;)
            </li>
            <li>
              <strong>Restriction</strong> — ask us to restrict how we process
              your data in certain circumstances
            </li>
            <li>
              <strong>Portability</strong> — receive your data in a
              machine-readable format
            </li>
            <li>
              <strong>Objection</strong> — object to processing based on
              legitimate interests
            </li>
          </ul>
          <p>
            To exercise any of these rights email us at{" "}
            <a href="mailto:hello@revlog.app" className={styles.bodyLink}>
              hello@revlog.app
            </a>
            . We will respond within 30 days.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionHeading}>
          Your rights (CCPA — California)
        </h2>
        <div className={styles.body}>
          <p>
            If you are a California resident, you have the right to know what
            personal information we collect, the right to delete your personal
            information, and the right to opt out of the sale of your personal
            information. We do not sell personal information.
          </p>
          <p>
            To submit a CCPA request email us at{" "}
            <a href="mailto:hello@revlog.app" className={styles.bodyLink}>
              hello@revlog.app
            </a>
            .
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionHeading}>Cookies</h2>
        <div className={styles.body}>
          <p>
            We use a single strictly necessary cookie to keep you signed in.
            See our{" "}
            <Link href="/cookies" className={styles.bodyLink}>
              Cookie Policy
            </Link>{" "}
            for details.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionHeading}>Changes to this policy</h2>
        <div className={styles.body}>
          <p>
            We may update this Privacy Policy from time to time. When we make
            material changes we will notify you by email at least 14 days
            before the change takes effect. The effective date at the top of
            this page always reflects the most recent version.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionHeading}>Contact</h2>
        <div className={styles.body}>
          <p>
            Questions or data requests? Email us at{" "}
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
