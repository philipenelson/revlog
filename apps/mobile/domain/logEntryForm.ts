// Shared pure core for the mobile log-entry forms — new-log-entry and
// edit-log-entry (ADR 0043). No React, no I/O. Mirrors the web draft's
// itemRowTotal/itemsGrandTotal (apps/web/src/domain/logEntryDraft.ts).

interface LogItemAmounts {
  quantity: string;
  unitCost: string;
}

// The line total for an item (quantity × unit cost), or null if either is blank
// / non-numeric.
export function itemRowTotal(item: LogItemAmounts): string | null {
  const q = parseFloat(item.quantity);
  const u = parseFloat(item.unitCost);
  if (!isNaN(q) && !isNaN(u)) return (q * u).toFixed(2);
  return null;
}

// The sum of every item's line total, or null when no item has a computable
// total.
export function itemsGrandTotal(items: LogItemAmounts[]): string | null {
  let sum = 0;
  let hasAny = false;
  for (const item of items) {
    const t = itemRowTotal(item);
    if (t !== null) {
      sum += parseFloat(t);
      hasAny = true;
    }
  }
  return hasAny ? sum.toFixed(2) : null;
}

interface LogEntryFormFieldsLike {
  typeId: string;
  title: string;
  date: string;
  mileage: string;
}

export type LogEntryFieldError = 'typeId' | 'title' | 'date' | 'mileage';

// Local validation (mobile requires mileage where the shared schema treats it
// as optional, so this validates directly rather than via the Zod schema).
export function validateLogEntryFields(fields: LogEntryFormFieldsLike): Partial<Record<LogEntryFieldError, string>> {
  const errors: Partial<Record<LogEntryFieldError, string>> = {};
  if (!fields.typeId) errors.typeId = 'Select a type';
  if (!fields.title.trim()) errors.title = 'Title is required';
  else if (fields.title.trim().length > 100) errors.title = 'Title must be 100 characters or fewer';
  if (!fields.date) errors.date = 'Date is required';
  const mileageDigits = fields.mileage.replace(/,/g, '').trim();
  if (!mileageDigits) errors.mileage = 'Mileage is required';
  else if (!/^\d+$/.test(mileageDigits)) errors.mileage = 'Enter a valid mileage';
  return errors;
}

interface LogItemDraftLike {
  categoryId: string;
  description: string;
  quantity: string;
  unitCost: string;
}

interface LogItemData<C> {
  categoryId: C;
  description: string;
  quantity: number | null;
  unitCost: number | null;
}

// Drops blank-description rows (an Owner may back out of an "add item" tap) and
// numbers the amounts — the shape the repository's create/update expects.
export function buildLogItemsData<T extends LogItemDraftLike>(items: T[]): LogItemData<T['categoryId']>[] {
  return items
    .filter((item) => item.description.trim())
    .map((item) => ({
      categoryId: item.categoryId,
      description: item.description.trim(),
      quantity: item.quantity.trim() ? parseFloat(item.quantity) : null,
      unitCost: item.unitCost.trim() ? parseFloat(item.unitCost) : null,
    }));
}
