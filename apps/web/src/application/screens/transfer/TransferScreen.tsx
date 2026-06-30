"use client";

import Link from "next/link";
import { VehicleGlyphIcon } from "@/application/components/icons";
import { Wordmark } from "@/application/components/Wordmark";
import { vehicleDisplayName } from "@/domain/types";
import { formatShortDate } from "@/utils/format";
import { useTransferViewModel } from "./useTransferViewModel";
import type { TransferDetails } from "@maintenance-log/api-client";
import styles from "./transfer.module.css";

export function TransferScreen() {
  const vm = useTransferViewModel();

  return (
    <div className={styles.scene} data-testid="transfer-page">
      <div className={styles.card}>
        <Wordmark classes={styles} />

        {vm.loadState === "loading" && <LoadingState />}
        {vm.loadState === "not-found" && <NotFoundState />}
        {vm.loadState === "error" && <ErrorState />}

        {vm.loadState === "pending" && vm.transfer && (
          <PendingState
            transfer={vm.transfer}
            accepting={vm.accepting}
            declining={vm.declining}
            actionError={vm.actionError}
            onAccept={vm.handleAccept}
            onDecline={vm.handleDecline}
          />
        )}

        {vm.loadState === "accepted" && <AcceptedState />}
        {vm.loadState === "declined" && <DeclinedState />}
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function LoadingState() {
  return (
    <div data-testid="transfer-loading">
      <h2 className={styles.headline}>Loading…</h2>
      <p className={styles.body}>Checking your transfer.</p>
    </div>
  );
}

function NotFoundState() {
  return (
    <div data-testid="transfer-not-found">
      <div className={styles.stateIcon}>🔗</div>
      <h2 className={styles.headline}>Transfer not found</h2>
      <p className={styles.body}>
        This transfer link has expired, was already accepted, or does not exist.
      </p>
      <Link href="/garage" className={styles.btnLink}>
        Go to Garage
      </Link>
    </div>
  );
}

function ErrorState() {
  return (
    <div data-testid="transfer-error">
      <h2 className={styles.headline}>Something went wrong</h2>
      <p className={styles.body}>
        We couldn&apos;t load this transfer — try again in a moment.
      </p>
      <Link href="/garage" className={styles.btnLink}>
        Go to Garage
      </Link>
    </div>
  );
}

function AcceptedState() {
  return (
    <div data-testid="transfer-accepted">
      <div className={styles.stateIcon}>🎉</div>
      <h2 className={styles.headline}>Vehicle added to your Garage</h2>
      <p className={styles.body}>
        The vehicle and its full service history are now in your Revlog account.
      </p>
      <Link href="/garage" className={styles.btnPrimary} data-testid="go-to-garage-btn">
        View Garage
      </Link>
    </div>
  );
}

function DeclinedState() {
  return (
    <div data-testid="transfer-declined">
      <div className={styles.stateIcon}>✓</div>
      <h2 className={styles.headline}>Transfer declined</h2>
      <p className={styles.body}>
        The sender has been notified. No action was taken on your account.
      </p>
      <Link href="/garage" className={styles.btnLink}>
        Go to Garage
      </Link>
    </div>
  );
}

function PendingState({
  transfer,
  accepting,
  declining,
  actionError,
  onAccept,
  onDecline,
}: {
  transfer: TransferDetails;
  accepting: boolean;
  declining: boolean;
  actionError: string | null;
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
}) {
  const displayName = vehicleDisplayName(transfer.vehicle);

  return (
    <div data-testid="transfer-pending">
      <h2 className={styles.headline}>
        {transfer.senderName} wants to transfer a vehicle to you
      </h2>

      <div className={styles.vehicleBlock} data-testid="transfer-vehicle-block">
        {transfer.vehicle.photoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element -- user-uploaded photo */
          <img
            src={transfer.vehicle.photoUrl}
            alt={displayName}
            className={styles.vehicleThumb}
          />
        ) : (
          <div className={styles.vehicleThumbPlaceholder} aria-hidden="true">
            <VehicleGlyphIcon />
          </div>
        )}
        <div>
          <div className={styles.vehicleName}>{displayName}</div>
          <div className={styles.vehicleMeta}>
            {transfer.vehicle.make} · {transfer.vehicle.model} · {transfer.vehicle.year}
          </div>
          <div className={styles.vehicleMeta}>
            {transfer.vehicle.logEntryCount}{" "}
            {transfer.vehicle.logEntryCount === 1 ? "log entry" : "log entries"} in service history
          </div>
        </div>
      </div>

      <p className={styles.meta}>
        This transfer expires {formatShortDate(transfer.expiresAt)}.
      </p>

      {actionError && (
        <p className={styles.actionError} data-testid="transfer-action-error">
          {actionError}
        </p>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={onAccept}
          disabled={accepting || declining}
          data-testid="accept-transfer-btn"
        >
          {accepting ? "Accepting…" : "Accept transfer"}
        </button>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={onDecline}
          disabled={accepting || declining}
          data-testid="decline-transfer-btn"
        >
          {declining ? "Declining…" : "Decline"}
        </button>
      </div>
    </div>
  );
}
