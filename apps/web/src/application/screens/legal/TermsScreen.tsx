import Link from "next/link";
import { LegalPageShell } from "./LegalPageShell";
import styles from "./legal.module.css";

export function TermsScreen() {
  return (
    <LegalPageShell currentPath="/terms">
      <h1 className={styles.title}>Terms of Service</h1>
      <p className={styles.effectiveDate}>Effective: 30 June 2026</p>

      <div className={styles.section}>
        <h2 className={styles.sectionHeading}>About Revlog</h2>
        <div className={styles.body}>
          <p>
            Revlog is a web and mobile application that lets motorcycle owners
            log maintenance events, track service history, and export records.
            These Terms of Service govern your use of the Revlog service. By
            creating an account you agree to these terms.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionHeading}>Account eligibility</h2>
        <div className={styles.body}>
          <p>
            You must be at least 16 years old to create an account. By
            registering you confirm that the information you provide is accurate
            and that you have the authority to bind yourself (or the
            organisation you represent) to these terms.
          </p>
          <p>
            One account per person. You are responsible for keeping your login
            credentials confidential and for all activity that takes place under
            your account.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionHeading}>Your data belongs to you</h2>
        <div className={styles.body}>
          <p>
            Any vehicle records, service history, log entries, and other
            content you create in Revlog belongs to you. We do not claim
            ownership of your data. We process it only to provide and improve
            the service you&apos;ve signed up for, as described in our{" "}
            <Link href="/privacy" className={styles.bodyLink}>
              Privacy Policy
            </Link>
            .
          </p>
          <p>
            You can export or delete your data at any time by contacting us (see
            below). When you delete your account all associated data is
            permanently removed from our systems within 30 days.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionHeading}>Acceptable use</h2>
        <div className={styles.body}>
          <p>You agree not to:</p>
          <ul>
            <li>Use Revlog for any unlawful purpose</li>
            <li>
              Attempt to gain unauthorised access to other users&apos; accounts
              or our systems
            </li>
            <li>
              Submit false or misleading information, or impersonate another
              person
            </li>
            <li>
              Use automated tools to scrape, crawl, or overload our service
            </li>
            <li>
              Reverse-engineer or attempt to extract the source code of the
              service
            </li>
          </ul>
          <p>
            We reserve the right to suspend or terminate accounts that violate
            these rules.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionHeading}>Service availability</h2>
        <div className={styles.body}>
          <p>
            We aim to keep Revlog running reliably, but we make no guarantee
            of uninterrupted availability. We may perform maintenance, fix
            bugs, or roll out updates at any time. We are not liable for any
            loss or inconvenience caused by downtime.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionHeading}>Termination and data deletion</h2>
        <div className={styles.body}>
          <p>
            You can close your account at any time by emailing us at{" "}
            <a href="mailto:hello@revlog.app" className={styles.bodyLink}>
              hello@revlog.app
            </a>
            . We will delete your account and all associated data within 30
            days of your request.
          </p>
          <p>
            We may suspend or terminate your account if you breach these terms,
            if required by law, or if we discontinue the service. Where
            possible we will give you advance notice and an opportunity to
            export your data.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionHeading}>Limitation of liability</h2>
        <div className={styles.body}>
          <p>
            Revlog is provided &ldquo;as is&rdquo; without warranties of any
            kind. To the maximum extent permitted by law, we are not liable for
            any indirect, incidental, or consequential damages arising from your
            use of the service — including but not limited to data loss or
            service interruptions.
          </p>
          <p>
            Nothing in these terms limits liability for death or personal
            injury caused by negligence, fraud, or any other liability that
            cannot be excluded by law.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionHeading}>Changes to these terms</h2>
        <div className={styles.body}>
          <p>
            We may update these terms from time to time. We will notify you by
            email at least 14 days before any material change takes effect. If
            you continue using Revlog after the effective date you accept the
            new terms. If you do not agree, you may close your account before
            the change takes effect.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionHeading}>Contact</h2>
        <div className={styles.body}>
          <p>
            Questions about these terms? Email us at{" "}
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
