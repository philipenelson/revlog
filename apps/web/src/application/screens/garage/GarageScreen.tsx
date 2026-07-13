"use client";

import Link from "next/link";
import {
  ArrowIcon,
  DashedVehicleGlyphIcon,
  Logo,
  PlusIcon,
  VehicleGlyphIcon,
} from "@/application/components/icons";
import { Wordmark } from "@/application/components/Wordmark";
import { AccountMenu } from "@/application/screens/account-menu/AccountMenu";
import { vehicleDisplayName } from "@/domain/types";
import type { VehicleSummary } from "@maintenance-log/api-client";
import { pluralize } from "@/utils/format";
import { useGarageViewModel } from "./useGarageViewModel";
import styles from "./garage.module.css";

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
          <AccountMenu />
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
