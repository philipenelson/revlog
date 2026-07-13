"use client";

import Link from "next/link";
import { useEffect, useRef, type KeyboardEvent } from "react";
import type { UserProfile } from "@maintenance-log/api-client";
import { initialsFromName, useAccountMenuViewModel, type AccountMenuViewModel } from "./useAccountMenuViewModel";
import styles from "./account-menu.module.css";

const SUPPORT_EMAIL = "hello@revlog.app";

export function AccountMenu() {
  const vm = useAccountMenuViewModel();
  const containerRef = useRef<HTMLDivElement>(null);

  // Outside-click and Escape both close the menu — same dismiss pattern as
  // the app's other dropdowns/dialogs (e.g. EditVehicleScreen's
  // DeleteConfirmDialog); state itself lives in the viewmodel.
  useEffect(() => {
    if (!vm.isOpen) return;

    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        vm.close();
      }
    }
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") vm.close();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [vm]);

  const displayName = vm.profile?.fullName ?? "";

  return (
    <div className={styles.accountMenuWrap} ref={containerRef}>
      <button
        type="button"
        className={styles.avatar}
        title={displayName || undefined}
        data-testid="avatar"
        aria-haspopup="menu"
        aria-expanded={vm.isOpen}
        onClick={vm.toggle}
      >
        {initialsFromName(displayName)}
      </button>
      {vm.isOpen && <AccountMenuDropdown vm={vm} />}
    </div>
  );
}

/* ── Presentational sub-components ──────────────────────────────── */

function AccountMenuDropdown({ vm }: { vm: AccountMenuViewModel }) {
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") vm.close();
  }

  return (
    <div role="menu" className={styles.accountMenu} data-testid="account-menu" onKeyDown={handleKeyDown}>
      <AccountMenuInfo profile={vm.profile} />

      <div className={styles.accountMenuGroup}>
        <Link href="/terms" className={styles.accountMenuItem} role="menuitem" data-testid="account-menu-terms" onClick={vm.close}>
          Terms of Service
        </Link>
        <Link href="/privacy" className={styles.accountMenuItem} role="menuitem" data-testid="account-menu-privacy" onClick={vm.close}>
          Privacy Policy
        </Link>
        <Link href="/cookies" className={styles.accountMenuItem} role="menuitem" data-testid="account-menu-cookies" onClick={vm.close}>
          Cookie Policy
        </Link>
      </div>

      <div className={styles.accountMenuGroup}>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className={styles.accountMenuItem}
          role="menuitem"
          data-testid="account-menu-support"
          onClick={vm.close}
        >
          Support
        </a>
      </div>

      <div className={styles.accountMenuGroup}>
        {vm.logoutError && (
          <p className={styles.accountMenuError} role="alert" data-testid="account-menu-logout-error">
            {vm.logoutError}
          </p>
        )}
        <button
          type="button"
          className={styles.accountMenuLogout}
          role="menuitem"
          data-testid="account-menu-logout"
          disabled={vm.isLoggingOut}
          onClick={vm.onLogout}
        >
          {vm.isLoggingOut ? "Logging out…" : "Log out"}
        </button>
      </div>
    </div>
  );
}

function AccountMenuInfo({ profile }: { profile: UserProfile | null }) {
  return (
    <div className={styles.accountMenuInfo}>
      <p className={styles.accountMenuName} data-testid="account-menu-name">
        {profile?.fullName ?? "—"}
      </p>
      <p className={styles.accountMenuEmail} data-testid="account-menu-email">
        {profile?.email ?? "—"}
      </p>
    </div>
  );
}
