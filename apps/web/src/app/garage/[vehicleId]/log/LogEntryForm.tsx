'use client';

import Link from 'next/link';
import { useState, useRef } from 'react';
import type { MediaRef } from '@/lib/media/MediaStore';
import styles from './log-entry.module.css';

/* ── Constants ─────────────────────────────────────────────────── */

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

const MAX_MEDIA_FILES = 10;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ── Types ─────────────────────────────────────────────────────── */

export interface LogItemDraft {
  id: string; // local key
  categoryId: string;
  description: string;
  quantity: string;
  unitCost: string;
}

export interface MediaDraft {
  id: string; // local key
  file: File;
  url: string;
  caption: string;
  savedRef?: MediaRef; // set after mediaStore.save()
}

export interface LogEntryFormState {
  typeId: string;
  title: string;
  date: string;
  time: string;
  mileage: string;
  notes: string;
  items: LogItemDraft[];
  mediaDrafts: MediaDraft[];
}

export function emptyFormState(): LogEntryFormState {
  return {
    typeId: '',
    title: '',
    date: todayIso(),
    time: '',
    mileage: '',
    notes: '',
    items: [],
    mediaDrafts: [],
  };
}

export interface LogEntryFormProps {
  vehicleId: string;
  mode: 'create' | 'edit';
  state: LogEntryFormState;
  onChange: (next: LogEntryFormState) => void;
  onSave: () => void;
  onDelete?: () => void;
  isSaving: boolean;
  error: string | null;
}

/* ── Helpers ────────────────────────────────────────────────────── */

function rowTotal(item: LogItemDraft): string | null {
  const q = parseFloat(item.quantity);
  const u = parseFloat(item.unitCost);
  if (!isNaN(q) && !isNaN(u)) return (q * u).toFixed(2);
  return null;
}

function grandTotal(items: LogItemDraft[]): string | null {
  let sum = 0;
  let hasAny = false;
  for (const item of items) {
    const t = rowTotal(item);
    if (t !== null) {
      sum += parseFloat(t);
      hasAny = true;
    }
  }
  return hasAny ? sum.toFixed(2) : null;
}

/* ── Component ──────────────────────────────────────────────────── */

export function LogEntryForm({
  vehicleId,
  mode,
  state,
  onChange,
  onSave,
  onDelete,
  isSaving,
  error,
}: LogEntryFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const canSave = state.typeId.length > 0 && state.title.trim().length > 0 && !isSaving;

  function setField<K extends keyof LogEntryFormState>(key: K, value: LogEntryFormState[K]) {
    onChange({ ...state, [key]: value });
  }

  function addItem() {
    const newItem: LogItemDraft = {
      id: crypto.randomUUID(),
      categoryId: 'PART',
      description: '',
      quantity: '',
      unitCost: '',
    };
    onChange({ ...state, items: [...state.items, newItem] });
  }

  function updateItem(id: string, patch: Partial<LogItemDraft>) {
    onChange({
      ...state,
      items: state.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  }

  function removeItem(id: string) {
    onChange({ ...state, items: state.items.filter((item) => item.id !== id) });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setMediaError(null);
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    if (state.mediaDrafts.length + files.length > MAX_MEDIA_FILES) {
      setMediaError(`Maximum ${MAX_MEDIA_FILES} files allowed`);
      return;
    }

    const newDrafts: MediaDraft[] = [];
    for (const file of files) {
      const isVideo = file.type.startsWith('video/');
      const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (file.size > maxBytes) {
        const limit = isVideo ? '100 MB' : '10 MB';
        setMediaError(`"${file.name}" exceeds the ${limit} limit`);
        continue;
      }
      newDrafts.push({
        id: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file),
        caption: '',
      });
    }

    onChange({ ...state, mediaDrafts: [...state.mediaDrafts, ...newDrafts] });
    // reset so the same file can be picked again
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeMedia(id: string) {
    const draft = state.mediaDrafts.find((m) => m.id === id);
    if (draft) URL.revokeObjectURL(draft.url);
    onChange({ ...state, mediaDrafts: state.mediaDrafts.filter((m) => m.id !== id) });
  }

  function updateCaption(id: string, caption: string) {
    onChange({
      ...state,
      mediaDrafts: state.mediaDrafts.map((m) => (m.id === id ? { ...m, caption } : m)),
    });
  }

  const total = grandTotal(state.items);

  return (
    <div className={styles.scene}>
      {/* Sticky header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href={`/garage/${vehicleId}`} className={styles.backLink} data-testid="back-link">
            <BackIcon />
            Back
          </Link>
          <span className={styles.headerTitle} data-testid="page-heading">
            {mode === 'create' ? 'New log entry' : 'Edit log entry'}
          </span>
        </div>
        <button
          type="button"
          className={styles.btnSave}
          disabled={!canSave}
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
                onClick={() => setField('typeId', id)}
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
              onChange={(e) => setField('title', e.target.value)}
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
                onChange={(e) => setField('date', e.target.value)}
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
                onChange={(e) => setField('time', e.target.value)}
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
                  onChange={(e) => setField('mileage', e.target.value)}
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
              onChange={(e) => setField('notes', e.target.value)}
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
              onClick={addItem}
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
                const t = rowTotal(item);
                return (
                  <div key={item.id} className={styles.itemRow} data-testid="item-row">
                    <input
                      type="text"
                      className={styles.input}
                      value={item.description}
                      onChange={(e) => updateItem(item.id, { description: e.target.value })}
                      placeholder="Description"
                      data-testid="item-description"
                    />
                    <select
                      className={styles.select}
                      value={item.categoryId}
                      onChange={(e) => updateItem(item.id, { categoryId: e.target.value })}
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
                      onChange={(e) => updateItem(item.id, { quantity: e.target.value })}
                      placeholder="1"
                      data-testid="item-quantity"
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={styles.input}
                      value={item.unitCost}
                      onChange={(e) => updateItem(item.id, { unitCost: e.target.value })}
                      placeholder="0.00"
                      data-testid="item-unit-cost"
                    />
                    <div className={styles.rowTotal} data-testid="item-row-total">
                      {t !== null ? `$${t}` : '—'}
                    </div>
                    <button
                      type="button"
                      className={styles.btnRemoveRow}
                      onClick={() => removeItem(item.id)}
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
                <span className={styles.itemsTotalValue}>{total !== null ? `$${total}` : '—'}</span>
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
                      onClick={() => removeMedia(m.id)}
                      aria-label="Remove"
                      data-testid="media-remove-btn"
                    >
                      ×
                    </button>
                    <input
                      type="text"
                      className={styles.mediaCaptionInput}
                      value={m.caption}
                      onChange={(e) => updateCaption(m.id, e.target.value)}
                      placeholder="Caption…"
                      maxLength={300}
                      data-testid="media-caption-input"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {mediaError && <div className={styles.errorBanner}>{mediaError}</div>}

          {state.mediaDrafts.length < MAX_MEDIA_FILES && (
            <label className={styles.fileInputWrapper} data-testid="file-input-label">
              <input
                ref={fileInputRef}
                type="file"
                className={styles.fileInput}
                accept="image/*,video/*"
                multiple
                onChange={handleFileChange}
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
            disabled={!canSave}
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

/* ── Icons ──────────────────────────────────────────────────────── */

function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path
        d="M12.5 7.5h-10M6.5 4.5l-3 3 3 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AttachIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path
        d="M13 6.5L6.5 13a4 4 0 01-5.657-5.657L8.5 0.5l3.535 3.536L4.5 11.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
