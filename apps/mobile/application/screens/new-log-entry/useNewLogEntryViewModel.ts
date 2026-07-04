import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { type LogEntryTypeId, ITEM_CATEGORY, type ItemCategoryId } from '@maintenance-log/domain';
import { useDatabase } from '@/application/providers/DatabaseProvider';
import type { CreateLogEntryItemData } from '@/domain/repositories/LogEntryRepository';
import { todayIso, toIsoDate } from '@/utils/date';

export interface LogItemDraft {
  id: string; // local key, for list rendering/removal — never sent to the repository
  categoryId: ItemCategoryId;
  description: string;
  quantity: string;
  unitCost: string;
}

// Plain strings, not react-hook-form + zodResolver: mirrors Add/Edit
// Vehicle's VehicleFormFields reasoning, plus mobile requires `mileage`
// (UC-MOB-LOG-1) where the shared createLogEntrySchema
// (@maintenance-log/domain) treats it as optional/nullable to match the web
// spec — the two products have genuinely different rules here, so this
// validates locally instead of forcing a schema mismatch. `typeId`, `title`,
// `date`, and item shape limits (title <=100 etc.) still mirror the shared
// schema's own rules.
export interface NewLogEntryFormFields {
  typeId: LogEntryTypeId | '';
  title: string;
  date: string; // "YYYY-MM-DD"
  mileage: string;
  notes: string;
}

export type NewLogEntryFormErrors = Partial<Record<'typeId' | 'title' | 'date' | 'mileage', string>>;

const EMPTY_FIELDS: NewLogEntryFormFields = {
  typeId: '',
  title: '',
  date: todayIso(),
  mileage: '',
  notes: '',
};

export interface NewLogEntryViewModel {
  vehicleName: string;
  fields: NewLogEntryFormFields;
  errors: NewLogEntryFormErrors;
  updateField: (field: keyof NewLogEntryFormFields, value: string) => void;
  isDatePickerOpen: boolean;
  openDatePicker: () => void;
  onDateSelected: (date: Date) => void;
  onDatePickerDismiss: () => void;
  items: LogItemDraft[];
  addItem: () => void;
  updateItem: (id: string, patch: Partial<LogItemDraft>) => void;
  removeItem: (id: string) => void;
  itemRowTotal: (item: LogItemDraft) => string | null;
  itemsTotal: string | null;
  isSubmitting: boolean;
  submitError: string | null;
  submit: () => void;
  onCancel: () => void;
}

export function useNewLogEntryViewModel(): NewLogEntryViewModel {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const { vehicleRepository, logEntryRepository } = useDatabase();
  const [vehicleName, setVehicleName] = useState('');
  const [fields, setFields] = useState<NewLogEntryFormFields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<NewLogEntryFormErrors>({});
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [items, setItems] = useState<LogItemDraft[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!vehicleRepository || !vehicleId) return;
    void vehicleRepository.findById(vehicleId).then((vehicle) => {
      if (!vehicle) return;
      setVehicleName(vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`);
    });
  }, [vehicleRepository, vehicleId]);

  function updateField(field: keyof NewLogEntryFormFields, value: string): void {
    setFields((f) => ({ ...f, [field]: value }));
    setErrors((errs) => (errs[field as keyof NewLogEntryFormErrors] ? { ...errs, [field]: undefined } : errs));
  }

  function openDatePicker(): void {
    setIsDatePickerOpen(true);
  }

  function onDateSelected(date: Date): void {
    // Android's picker is a self-dismissing dialog (fires once, then gone);
    // iOS's inline display stays mounted until the Owner taps elsewhere, so
    // only Android closes itself here.
    setIsDatePickerOpen(Platform.OS === 'ios');
    updateField('date', toIsoDate(date));
  }

  function onDatePickerDismiss(): void {
    setIsDatePickerOpen(false);
  }

  function addItem(): void {
    setItems((current) => [
      ...current,
      { id: `${Date.now()}-${current.length}`, categoryId: ITEM_CATEGORY.PART, description: '', quantity: '', unitCost: '' },
    ]);
  }

  function updateItem(id: string, patch: Partial<LogItemDraft>): void {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeItem(id: string): void {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function validate(): NewLogEntryFormErrors {
    const nextErrors: NewLogEntryFormErrors = {};
    if (!fields.typeId) nextErrors.typeId = 'Select a type';
    if (!fields.title.trim()) nextErrors.title = 'Title is required';
    else if (fields.title.trim().length > 100) nextErrors.title = 'Title must be 100 characters or fewer';
    if (!fields.date) nextErrors.date = 'Date is required';
    const mileageDigits = fields.mileage.replace(/,/g, '').trim();
    if (!mileageDigits) nextErrors.mileage = 'Mileage is required';
    else if (!/^\d+$/.test(mileageDigits)) nextErrors.mileage = 'Enter a valid mileage';
    return nextErrors;
  }

  async function handleSubmit(): Promise<void> {
    if (!logEntryRepository || !vehicleId) return;

    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    // Rows left blank after the Owner backs out of an "add item" tap are
    // silently dropped, same as the web draft's buildLogEntryPayload().
    const itemsData: CreateLogEntryItemData[] = items
      .filter((item) => item.description.trim())
      .map((item) => ({
        categoryId: item.categoryId,
        description: item.description.trim(),
        quantity: item.quantity.trim() ? parseFloat(item.quantity) : null,
        unitCost: item.unitCost.trim() ? parseFloat(item.unitCost) : null,
      }));

    setErrors({});
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await logEntryRepository.create(vehicleId, {
        typeId: fields.typeId as LogEntryTypeId,
        title: fields.title.trim(),
        date: fields.date,
        mileage: Number(fields.mileage.replace(/,/g, '')),
        notes: fields.notes.trim() || null,
        items: itemsData,
      });
      // back(), not push(`/garage/${vehicleId}`) -- this screen was reached
      // by pushing from Vehicle Detail (UC-MOB-LOG-1's precondition), so
      // push()ing the same route again would stack a second instance
      // instead of returning to the first. Vehicle Detail's useFocusEffect
      // re-reads local Log Entries on return, so back() still shows the
      // just-created entry.
      router.back();
    } catch {
      setSubmitError("Couldn't save this log entry. Try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    vehicleName,
    fields,
    errors,
    updateField,
    isDatePickerOpen,
    openDatePicker,
    onDateSelected,
    onDatePickerDismiss,
    items,
    addItem,
    updateItem,
    removeItem,
    itemRowTotal,
    itemsTotal: itemsGrandTotal(items),
    isSubmitting,
    submitError,
    submit: () => void handleSubmit(),
    onCancel: () => router.back(),
  };
}

// Mirrors the web draft's itemRowTotal()/itemsGrandTotal()
// (apps/web/src/domain/logEntryDraft.ts).
function itemRowTotal(item: LogItemDraft): string | null {
  const q = parseFloat(item.quantity);
  const u = parseFloat(item.unitCost);
  if (!isNaN(q) && !isNaN(u)) return (q * u).toFixed(2);
  return null;
}

function itemsGrandTotal(items: LogItemDraft[]): string | null {
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
