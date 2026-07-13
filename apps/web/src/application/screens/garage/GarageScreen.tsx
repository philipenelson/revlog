"use client";

import Link from "next/link";
import { useEffect, useRef, type KeyboardEvent } from "react";
import {
  ArrowIcon,
  DashedVehicleGlyphIcon,
  Logo,
  PlusIcon,
  VehicleGlyphIcon,
} from "@/application/components/icons";
import { Wordmark } from "@/application/components/Wordmark";
import { vehicleDisplayName } from "@/domain/types";
import type { UserProfile, VehicleSummary } from "@maintenance-log/api-client";
import { pluralize } from "@/utils/format";
import { initialsFromName, useGarageViewModel, type AccountMenuViewModel } from "./useGarageViewModel";
import styles from "./garage.module.css";

const SUPPORT_EMAIL = "hello@revlog.app";

const LOAD_ERROR = "We couldn't load your garage. Our mechanics are on it — try again in a moment.";

export function GarageScreen() {
  const vm = useGarageViewModel();

  return (
    <div className={styles.scene}>
      <header className={styles.topbar}>
        <div className={styles.topbarLogo}>
          <Logo />
          <Wordmark classes={styles} />
        </div>
        <div className={styles.topbarActions}>
          <Link href="/garage/add" className={styles.btnAdd} data-testid="topbar-add-vehicle-btn">
            <PlusIcon />
            Add vehicle
          </Link>
          <AccountMenuTrigger accountMenu={vm.accountMenu} />
        </div>
      </header>

      <main className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <div className={styles.eyebrow}>Your garage</div>
            <h1 className={styles.pageTitle} data-testid="page-title">
              {vm.isPopulated ? (
                <>
                  {vm.vehicles.length}{" "}
                  <span className={styles.count}>{pluralize(vm.vehicles.length, "vehicle")}</span>
                </>
              ) : (
                "Your garage"
              )}
            </h1>
          </div>
          {vm.isPopulated && (
            <p className={styles.pageSub} data-testid="page-sub">
              Sorted by most recently logged
            </p>
          )}
        </div>

        {vm.loadState === "loading" && <LoadingState />}
        {vm.loadState === "error" && <ErrorState onRetry={() => console.log('TODO: fix error handling')} />}
        {vm.isEmpty && <EmptyState />}
        {vm.isPopulated && (
          <div className={styles.vehicleGrid} data-testid="vehicle-grid">
            {vm.vehicles.map((vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
            <Link href="/garage/add" className={styles.addTile} data-testid="add-tile">
              <span className={styles.addTileBadge}>+</span>
              <span className={styles.addTileLabel}>Add a vehicle</span>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

/* ── Presentational sub-components ──────────────────────────────── */

function AccountMenuTrigger({ accountMenu }: { accountMenu: AccountMenuViewModel }) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Outside-click and Escape both close the menu — same dismiss pattern as
  // the app's other dropdowns/dialogs (e.g. EditVehicleScreen's
  // DeleteConfirmDialog); state itself lives in the viewmodel.
  useEffect(() => {
    if (!accountMenu.isOpen) return;

    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        accountMenu.close();
      }
    }
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") accountMenu.close();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [accountMenu]);

  const displayName = accountMenu.profile?.fullName ?? "";

  return (
    <div className={styles.accountMenuWrap} ref={containerRef}>
      <button
        type="button"
        className={styles.avatar}
        title={displayName || undefined}
        data-testid="avatar"
        aria-haspopup="menu"
        aria-expanded={accountMenu.isOpen}
        onClick={accountMenu.toggle}
      >
        {initialsFromName(displayName)}
      </button>
      {accountMenu.isOpen && <AccountMenu accountMenu={accountMenu} />}
    </div>
  );
}

function AccountMenu({ accountMenu }: { accountMenu: AccountMenuViewModel }) {
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") accountMenu.close();
  }

  return (
    <div
      role="menu"
      className={styles.accountMenu}
      data-testid="account-menu"
      onKeyDown={handleKeyDown}
    >
      <AccountMenuInfo profile={accountMenu.profile} />

      <div className={styles.accountMenuGroup}>
        <Link href="/terms" className={styles.accountMenuItem} role="menuitem" data-testid="account-menu-terms" onClick={accountMenu.close}>
          Terms of Service
        </Link>
        <Link href="/privacy" className={styles.accountMenuItem} role="menuitem" data-testid="account-menu-privacy" onClick={accountMenu.close}>
          Privacy Policy
        </Link>
        <Link href="/cookies" className={styles.accountMenuItem} role="menuitem" data-testid="account-menu-cookies" onClick={accountMenu.close}>
          Cookie Policy
        </Link>
      </div>

      <div className={styles.accountMenuGroup}>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className={styles.accountMenuItem}
          role="menuitem"
          data-testid="account-menu-support"
          onClick={accountMenu.close}
        >
          Support
        </a>
      </div>

      <div className={styles.accountMenuGroup}>
        {accountMenu.logoutError && (
          <p className={styles.accountMenuError} role="alert" data-testid="account-menu-logout-error">
            {accountMenu.logoutError}
          </p>
        )}
        <button
          type="button"
          className={styles.accountMenuLogout}
          role="menuitem"
          data-testid="account-menu-logout"
          disabled={accountMenu.isLoggingOut}
          onClick={accountMenu.onLogout}
        >
          {accountMenu.isLoggingOut ? "Logging out…" : "Log out"}
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

function VehicleCard({ vehicle }: { vehicle: VehicleSummary }) {
  const hasLogEntries = vehicle.logEntryCount > 0;

  return (
    <Link
      href={`/garage/${vehicle.id}`}
      className={styles.vehicleCard}
      data-testid="vehicle-card"
      data-vehicle-id={vehicle.id}
    >
      {vehicle.photoUrl ? (
        <div className={styles.photoStrip}>
          {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded photo served by local Express; next/image optimizer cannot handle this URL without an infra-level proxy */}
          <img
            src={vehicle.photoUrl}
            alt={vehicleDisplayName(vehicle)}
            className={styles.vehiclePhoto}
          />
          <div className={styles.photoStripOverlay} />
        </div>
      ) : (
        <div className={styles.vehicleGlyph}>
          <VehicleGlyphIcon />
        </div>
      )}
      <h2 className={styles.vehicleName}>{vehicleDisplayName(vehicle)}</h2>
      <p className={styles.vehicleMeta}>{`${vehicle.make} · ${vehicle.model} · ${vehicle.year}`}</p>
      <div className={styles.vehicleStats}>
        <div>
          <div className={styles.statValue}>
            {vehicle.mileage.toLocaleString()}
            <span className={styles.unit}>mi</span>
          </div>
          <div className={styles.statLabel}>Odometer</div>
        </div>
        <div>
          <div className={hasLogEntries ? styles.statValue : `${styles.statValue} ${styles.statValueEmpty}`}>
            {hasLogEntries ? vehicle.logEntryCount : "No entries yet"}
          </div>
          <div className={styles.statLabel}>Log entries</div>
        </div>
      </div>
      <span className={styles.vehicleLink}>
        View service history
        <ArrowIcon />
      </span>
    </Link>
  );
}

function LoadingState() {
  return (
    <div className={styles.emptyState} data-testid="loading-state">
      <h2 className={styles.emptyHeadline}>Loading your garage…</h2>
      <p className={styles.emptyBody}>Hang tight while we pull up your vehicles.</p>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={styles.emptyState} data-testid="error-state">
      <h2 className={styles.emptyHeadline}>Something stalled</h2>
      <p className={styles.emptyBody}>{LOAD_ERROR}</p>
      <button type="button" className={styles.btnPrimary} data-testid="retry-btn" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className={styles.emptyState} data-testid="empty-state">
      <div className={styles.emptyIllustration}>
        <div className={styles.emptyBay}>
          <DashedVehicleGlyphIcon />
        </div>
        <div className={styles.emptyPlus}>+</div>
      </div>
      <h2 className={styles.emptyHeadline}>Your garage is empty</h2>
      <p className={styles.emptyBody}>
        Add your first vehicle to start building its service history — every oil
        change, tyre swap, and repair, kept in one place for good.
      </p>
      <Link href="/garage/add" className={styles.btnPrimary} data-testid="empty-cta">
        <PlusIcon />
        Add your first vehicle
      </Link>
    </div>
  );
}
