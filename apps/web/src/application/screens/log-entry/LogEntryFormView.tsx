"use client";

import Link from "next/link";
import { useRef } from "react";
import { AttachIcon, BackArrowIcon } from "@/application/components/icons";
import { itemRowTotal, type LogEntryFormState } from "@/model/logEntryDraft";
import { useLogEntryFormViewModel } from "./useLogEntryFormViewModel";
import styles from "./log-entry.module.css";

/* ── Display constants ──────────────────────────────────────────── */

const TYPE_META: Record<string, { label: string; tooltip: string; icon: string }> = {
  MAINTENANCE: { label: 'Maintenance', tooltip: 'Routine upkeep — oil change, tyre swap, chain service', icon: '🔧' },
  REPAIR: { label: 'Repair', tooltip: 'Fixing something broken or damaged', icon: '🛠' },
  INSPECTION: { label: 'Inspection', tooltip: 'Periodic checks, pre-trip, annual inspection', icon: '🔍' },
  MODIFICATION: { label: 'Modification', tooltip: "Aftermarket parts, upgrades, customisation", icon: '⚡' },
  INCIDENT: { label: 'Incident', tooltip: "Crash, damage, breakdown — the \"oh no\" log", icon: '⚠️' },
  EVENT: { label: 'Event', tooltip: 'Track day, rally, road trip', icon: '🏁' },
  OTHER: { label: 'Other', tooltip: "Anything that doesn't fit the above", icon: '📋' },
};

const CATEGORY_META: Record<string, { label: string; tooltip: string }> = {
  PART: { label: 'Part', tooltip: 'A physical component used or replaced' },
  LABOR: { label: 'Labor', tooltip: 'Work performed' },
  FEE: { label: 'Fee', tooltip: 'Shop fee, disposal, tax' },
  OTHER: { label: 'Other', tooltip: 'Anything else' },
};

export interface LogEntryFormViewProps {
  vehicleId: string;
  mode: 'create' | 'edit';
  state: LogEntryFormState;
  onChange: (next: LogEntryFormState) => void;
  onSave: () => void;
  onDelete?: () => void;
  isSaving: boolean;
  error: string | null;
}

export function LogEntryFormView({
  vehicleId,
  mode,
  state,
  onChange,
  onSave,
  onDelete,
  isSaving,
  error,
}: LogEntryFormViewProps) {
  const vm = useLogEntryFormViewModel(state, onChange, isSaving);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={styles.scene}>
      {/* Sticky header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href={`/garage/${vehicleId}`} className={styles.backLink} data-testid="back-link">
            <BackArrowIcon size={14} />
            Back
          </Link>
          <span className={styles.headerTitle} data-testid="page-heading">
            {mode === 'create' ? 'New log entry' : 'Edit log entry'}
          </span>
        </div>
        <button
          type="button"
          className={styles.btnSave}
          disabled={!vm.canSave}
          onClick={onSave}
          data-testid="save-btn"
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
      </header>

      <div className={styles.form}>
        {/* Type pills */}
        <section className={styles.section} data-testid="type-section">
          <div className={styles.sectionTitle}>Type</div>
          <div className={styles.typePills} data-testid="type-pills">
            {Object.entries(TYPE_META).map(([id, meta]) => (
              <button
                key={id}
                type="button"
                title={meta.tooltip}
                className={`${styles.pill} ${state.typeId === id ? styles.pillActive : ''}`}
                onClick={() => vm.setField('typeId', id)}
                data-testid={`type-pill-${id}`}
                data-active={state.typeId === id ? 'true' : 'false'}
              >
                <span>{meta.icon}</span>
                {meta.label}
              </button>
            ))}
          </div>
        </section>

        {/* Title */}
        <section className={styles.section}>
          <div className={styles.fieldGroup}>
            <label htmlFor="entry-title" className={`${styles.label} ${styles.labelRequired}`}>
              Title
            </label>
            <input
              id="entry-title"
              type="text"
              className={styles.input}
              value={state.title}
              onChange={(e) => vm.setField('title', e.target.value)}
              maxLength={100}
              placeholder="e.g. 10,000 km service"
              data-testid="title-input"
            />
            {state.title.length > 80 && (
              <div className={`${styles.charCounter} ${state.title.length >= 100 ? styles.charCounterWarn : ''}`}>
                {state.title.length}/100
              </div>
            )}
          </div>
        </section>

        {/* Date / Time / Odometer row */}
        <section className={styles.section}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup}>
              <label htmlFor="entry-date" className={styles.label}>Date</label>
              <input
                id="entry-date"
                type="date"
                className={styles.input}
                value={state.date}
                onChange={(e) => vm.setField('date', e.target.value)}
                data-testid="date-input"
              />
            </div>
            <div className={styles.fieldGroup}>
              <label htmlFor="entry-time" className={styles.label}>Time (optional)</label>
              <input
                id="entry-time"
                type="text"
                className={styles.input}
                value={state.time}
                onChange={(e) => vm.setField('time', e.target.value)}
                placeholder="e.g. 14:30"
                data-testid="time-input"
              />
            </div>
            <div className={styles.fieldGroup}>
              <label htmlFor="entry-mileage" className={styles.label}>Odometer (optional)</label>
              <div className={styles.inputWithSuffix}>
                <input
                  id="entry-mileage"
                  type="number"
                  min={0}
                  className={styles.input}
                  value={state.mileage}
                  onChange={(e) => vm.setField('mileage', e.target.value)}
                  placeholder="e.g. 15000"
                  data-testid="mileage-input"
                />
                <span className={styles.inputSuffix}>km</span>
              </div>
              <div className={styles.helperText}>Updates your vehicle&apos;s odometer if higher than current reading</div>
            </div>
          </div>
        </section>

        {/* Notes */}
        <section className={styles.section}>
          <div className={styles.fieldGroup}>
            <label htmlFor="entry-notes" className={styles.label}>Notes (optional)</label>
            <textarea
              id="entry-notes"
              className={styles.textarea}
              value={state.notes}
              onChange={(e) => vm.setField('notes', e.target.value)}
              maxLength={5000}
              placeholder="Any additional details..."
              rows={4}
              data-testid="notes-input"
            />
          </div>
        </section>

        {/* Items & costs */}
        <section className={styles.section} data-testid="items-section">
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>Items & costs</div>
            <button
              type="button"
              className={styles.btnAddItem}
              onClick={vm.addItem}
              data-testid="add-item-btn"
            >
              + Add item
            </button>
          </div>

          {state.items.length > 0 && (
            <div className={styles.itemsTable} data-testid="items-table">
              <div className={styles.itemRow}>
                <div className={styles.itemRowHeader}>Description</div>
                <div className={styles.itemRowHeader}>Category</div>
                <div className={styles.itemRowHeader}>Qty</div>
                <div className={styles.itemRowHeader}>Unit cost</div>
                <div className={styles.itemRowHeader}>Total</div>
                <div />
              </div>
              {state.items.map((item) => {
                const t = itemRowTotal(item);
                return (
                  <div key={item.id} className={styles.itemRow} data-testid="item-row">
                    <input
                      type="text"
                      className={styles.input}
                      value={item.description}
                      onChange={(e) => vm.updateItem(item.id, { description: e.target.value })}
                      placeholder="Description"
                      data-testid="item-description"
                    />
                    <select
                      className={styles.select}
                      value={item.categoryId}
                      onChange={(e) => vm.updateItem(item.id, { categoryId: e.target.value })}
                      data-testid="item-category"
                    >
                      {Object.entries(CATEGORY_META).map(([id, meta]) => (
                        <option key={id} value={id} title={meta.tooltip}>
                          {meta.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className={styles.input}
                      value={item.quantity}
                      onChange={(e) => vm.updateItem(item.id, { quantity: e.target.value })}
                      placeholder="1"
                      data-testid="item-quantity"
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={styles.input}
                      value={item.unitCost}
                      onChange={(e) => vm.updateItem(item.id, { unitCost: e.target.value })}
                      placeholder="0.00"
                      data-testid="item-unit-cost"
                    />
                    <div className={styles.rowTotal} data-testid="item-row-total">
                      {t !== null ? `$${t}` : '—'}
                    </div>
                    <button
                      type="button"
                      className={styles.btnRemoveRow}
                      onClick={() => vm.removeItem(item.id)}
                      aria-label="Remove item"
                      data-testid="remove-item-btn"
                    >
                      ×
                    </button>
                  </div>
                );
              })}

              <div className={styles.itemsTotal} data-testid="items-total">
                <span className={styles.itemsTotalLabel}>Total</span>
                <span className={styles.itemsTotalValue}>{vm.total !== null ? `$${vm.total}` : '—'}</span>
              </div>
            </div>
          )}
        </section>

        {/* Photos & videos */}
        <section className={styles.section} data-testid="media-section">
          <div className={styles.sectionTitle}>Photos & videos</div>

          {state.mediaDrafts.length > 0 && (
            <div className={styles.mediaGrid} data-testid="media-grid">
              {state.mediaDrafts.map((m) => {
                const isVideo = m.file.type.startsWith('video/');
                return (
                  <div key={m.id} className={styles.mediaThumb} data-testid="media-thumb">
                    {isVideo ? (
                      <video src={m.url} className={styles.mediaThumbVideo} muted playsInline />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- local object URL, next/image can't optimize it
                      <img src={m.url} alt="" className={styles.mediaThumbImg} />
                    )}
                    <button
                      type="button"
                      className={styles.mediaRemoveBtn}
                      onClick={() => vm.removeMedia(m.id)}
                      aria-label="Remove"
                      data-testid="media-remove-btn"
                    >
                      ×
                    </button>
                    <input
                      type="text"
                      className={styles.mediaCaptionInput}
                      value={m.caption}
                      onChange={(e) => vm.updateCaption(m.id, e.target.value)}
                      placeholder="Caption…"
                      maxLength={300}
                      data-testid="media-caption-input"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {vm.mediaError && <div className={styles.errorBanner}>{vm.mediaError}</div>}

          {vm.canAttachMore && (
            <label className={styles.fileInputWrapper} data-testid="file-input-label">
              <input
                ref={fileInputRef}
                type="file"
                className={styles.fileInput}
                accept="image/*,video/*"
                multiple
                onChange={(e) => vm.handleFileChange(e, fileInputRef.current)}
                data-testid="file-input"
              />
              <span className={styles.fileInputLabel}>
                <AttachIcon />
                Attach photos or videos
              </span>
            </label>
          )}
        </section>

        {/* Bottom actions */}
        <div className={styles.bottomActions}>
          {mode === 'edit' && onDelete ? (
            <button type="button" className={styles.btnDelete} onClick={onDelete} data-testid="delete-btn">
              Delete entry
            </button>
          ) : (
            <div />
          )}
          <button
            type="button"
            className={styles.btnSave}
            disabled={!vm.canSave}
            onClick={onSave}
            data-testid="save-btn-bottom"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>

        {error && <div className={styles.errorBanner} data-testid="form-error">{error}</div>}
      </div>
    </div>
  );
}
