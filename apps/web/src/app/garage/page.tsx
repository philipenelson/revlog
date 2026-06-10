"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/infrastructure/http/apiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { logger } from "@/infrastructure/logging/logger";
import styles from "./garage.module.css";

interface VehicleSummary {
  id: string;
  nickname: string | null;
  make: string;
  model: string;
  year: number;
  mileage: number;
  photoUrl: string | null;
  logEntryCount: number;
}

interface VehiclesResponse {
  vehicles: VehicleSummary[];
}

const CURRENT_USER = { name: "Jordan Reyes", initials: "JR" };

const LOAD_ERROR = "We couldn't load your garage. Our mechanics are on it — try again in a moment.";

type LoadState = "loading" | "loaded" | "error";

export default function GaragePage() {
  const router = useRouter();
  const { session, isRestoring } = useAuth();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [retryToken, setRetryToken] = useState(0);

  function retry() {
    setLoadState("loading");
    setRetryToken((n) => n + 1);
  }

  useEffect(() => {
    // AuthProvider attempts a silent restore on mount (UC-AUTH-7 / ADR 0017) —
    // wait for it to settle before deciding there's no session. Redirecting on
    // the first null would flash this screen away to /login even when the
    // restore was about to succeed.
    if (isRestoring) return;

    if (!session) {
      // Restoration genuinely failed — no valid refresh-token cookie to recover
      // from (expired, revoked, or never signed in). Re-authenticating is the
      // only path forward, so send them there directly rather than showing a
      // load-error whose "Try again" could never succeed.
      router.replace("/login");
      return;
    }

    let cancelled = false;

    apiFetch<VehiclesResponse>("/vehicles", {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
      .then((data) => {
        if (cancelled) return;
        setVehicles(data.vehicles);
        setLoadState("loaded");
      })
      .catch((err) => {
        if (cancelled) return;
        if (!(err instanceof ApiError && err.status < 500)) {
          logger.error("failed to load garage vehicles", { err });
        }
        setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [session, isRestoring, retryToken, router]);

  const hasLoaded = loadState === "loaded";
  const isEmpty = hasLoaded && vehicles.length === 0;
  const isPopulated = hasLoaded && !isEmpty;

  return (
    <div className={styles.scene}>
      <header className={styles.topbar}>
        <div className={styles.topbarLogo}>
          <Logo />
          <div className={styles.wordmark}>
            <span className={styles.wordmarkLight}>Rev</span>
            <span className={styles.wordmarkBold}>log</span>
          </div>
        </div>
        <div className={styles.topbarActions}>
          <Link href="/garage/add" className={styles.btnAdd} data-testid="topbar-add-vehicle-btn">
            <PlusIcon />
            Add vehicle
          </Link>
          <div className={styles.avatar} title={CURRENT_USER.name} data-testid="avatar">
            {CURRENT_USER.initials}
          </div>
        </div>
      </header>

      <main className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <div className={styles.eyebrow}>Your garage</div>
            <h1 className={styles.pageTitle} data-testid="page-title">
              {isPopulated ? (
                <>
                  {vehicles.length} <span className={styles.count}>{pluralize(vehicles.length)}</span>
                </>
              ) : (
                "Your garage"
              )}
            </h1>
          </div>
          {isPopulated && (
            <p className={styles.pageSub} data-testid="page-sub">
              Sorted by most recently logged
            </p>
          )}
        </div>

        {loadState === "loading" && <LoadingState />}
        {loadState === "error" && <ErrorState onRetry={retry} />}
        {isEmpty && <EmptyState />}
        {isPopulated && (
          <div className={styles.vehicleGrid} data-testid="vehicle-grid">
            {vehicles.map((vehicle) => (
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

/* ── Helpers ────────────────────────────────────────────────────── */

function pluralize(count: number): string {
  return count === 1 ? "vehicle" : "vehicles";
}

function vehicleDisplayName(vehicle: VehicleSummary): string {
  return vehicle.nickname?.trim() || `${vehicle.make} ${vehicle.model}`;
}

/* ── Sub-components ─────────────────────────────────────────────── */

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

/* ── Icons ──────────────────────────────────────────────────────── */

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <path d="M 11 30 A 14 14 0 1 1 25 30" stroke="var(--surface-subtle)" strokeWidth="3" strokeLinecap="round" />
      <path d="M 11 30 A 14 14 0 1 1 30.1 11" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <line x1="18" y1="18" x2="27.5" y2="13" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="18" cy="18" r="2.2" fill="var(--accent)" />
      <circle cx="30.1" cy="11" r="1.5" fill="var(--danger)" opacity="0.8" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path
        d="M2.5 7.5h10M8.5 4.5l3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VehicleGlyphIcon() {
  return (
    <svg viewBox="0 0 80 48" fill="none" aria-hidden="true">
      <circle cx="16" cy="36" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="62" cy="36" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M16 36 L30 19 L46 19 L62 36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M30 19 L37 36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M46 19 L41 11 L52 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 13 L33 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DashedVehicleGlyphIcon() {
  return (
    <svg viewBox="0 0 80 48" fill="none" aria-hidden="true">
      <circle cx="16" cy="36" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
      <circle cx="62" cy="36" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
      <path
        d="M16 36 L30 19 L46 19 L62 36"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="3 3"
      />
      <path d="M30 19 L37 36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" />
      <path
        d="M46 19 L41 11 L52 11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="3 3"
      />
    </svg>
  );
}
