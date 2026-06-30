import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/application/components/icons";
import styles from "./legal.module.css";

const YEAR = 2026;

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/cookies", label: "Cookie Policy" },
];

export function LegalPageShell({
  children,
  currentPath,
}: {
  children: ReactNode;
  currentPath: "/terms" | "/privacy" | "/cookies";
}) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/login" className={styles.logo} aria-label="Revlog home">
            <Logo size={28} />
            <span className={styles.wordmark}>
              <span className={styles.wordmarkLight}>rev</span>
              <span className={styles.wordmarkBold}>log</span>
            </span>
          </Link>
          <Link href="/login" className={styles.backLink}>
            ← Back to sign in
          </Link>
        </div>
      </header>

      <main className={styles.content}>{children}</main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <nav className={styles.footerLinks} aria-label="Legal pages">
            {LEGAL_LINKS.filter((l) => l.href !== currentPath).map((l) => (
              <Link key={l.href} href={l.href} className={styles.footerLink}>
                {l.label}
              </Link>
            ))}
          </nav>
          <p className={styles.footerCopy}>
            &copy; {YEAR} Revlog. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
