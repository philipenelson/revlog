"use client";

import Link from "next/link";
import styles from "./garage.module.css";

interface VehicleSummary {
  id: string;
  nickname: string | null;
  make: string;
  model: string;
  year: number;
  odometer: number;
  logEntryCount: number;
}

const CURRENT_USER = { name: "Jordan Reyes", initials: "JR" };

// Stubbed Garage contents — see docs/specs/garage/garage-screen.md "Decisions"
// for why this isn't wired to GET /vehicles yet.
const GARAGE_VEHICLES: VehicleSummary[] = [
  {
    id: "the-daily",
    nickname: "The Daily",
    make: "Triumph",
    model: "Street Triple RS",
    year: 2021,
    odometer: 14230,
    logEntryCount: 12,
  },
  {
    id: "sunday-bike",
    nickname: "Sunday Bike",
    make: "Ducati",
    model: "Scrambler Icon",
    year: 2019,
    odometer: 8402,
    logEntryCount: 7,
  },
  {
    id: "project-garage-find",
    nickname: "Project Garage Find",
    make: "Honda",
    model: "CB350",
    year: 1972,
    odometer: 31118,
    logEntryCount: 0,
  },
];

export default function GaragePage() {
  const vehicles = GARAGE_VEHICLES;
  const isEmpty = vehicles.length === 0;

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
              {isEmpty ? (
                "Your garage"
              ) : (
                <>
                  {vehicles.length} <span className={styles.count}>{pluralize(vehicles.length)}</span>
                </>
              )}
            </h1>
          </div>
          {!isEmpty && (
            <p className={styles.pageSub} data-testid="page-sub">
              Sorted by most recently logged
            </p>
          )}
        </div>

        {isEmpty ? (
          <EmptyState />
        ) : (
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
      <div className={styles.vehicleGlyph}>
        <VehicleGlyphIcon />
      </div>
      <h2 className={styles.vehicleName}>{vehicleDisplayName(vehicle)}</h2>
      <p className={styles.vehicleMeta}>{`${vehicle.make} · ${vehicle.model} · ${vehicle.year}`}</p>
      <div className={styles.vehicleStats}>
        <div>
          <div className={styles.statValue}>
            {vehicle.odometer.toLocaleString()}
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
