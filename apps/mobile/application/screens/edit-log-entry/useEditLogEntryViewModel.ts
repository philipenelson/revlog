import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { type LogEntryTypeId, ITEM_CATEGORY, type ItemCategoryId } from '@maintenance-log/contracts';
import { useDatabase } from '@/application/providers/DatabaseProvider';
import type { CreateLogEntryItemData } from '@/domain/repositories/LogEntryRepository';
import { toIsoDate } from '@/utils/date';

export interface LogItemDraft {
  id: string; // local key, for list rendering/removal — never sent to the repository
  categoryId: ItemCategoryId;
  description: string;
  quantity: string;
  unitCost: string;
}

// Plain strings, not react-hook-form + zodResolver — same reasoning as New
// Log Entry's NewLogEntryFormFields (see useNewLogEntryViewModel.ts).
export interface EditLogEntryFormFields {
  typeId: LogEntryTypeId | '';
  title: string;
  date: string; // "YYYY-MM-DD"
  mileage: string;
  notes: string;
}

export type EditLogEntryFormErrors = Partial<Record<'typeId' | 'title' | 'date' | 'mileage', string>>;

const EMPTY_FIELDS: EditLogEntryFormFields = { typeId: '', title: '', date: '', mileage: '', notes: '' };

type LoadState = 'loading' | 'not-found' | 'ready';

export interface EditLogEntryViewModel {
  loadState: LoadState;
  vehicleName: string;
  fields: EditLogEntryFormFields;
  errors: EditLogEntryFormErrors;
  updateField: (field: keyof EditLogEntryFormFields, value: string) => void;
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
  // UC-MOB-LOG-3 — danger zone / delete confirmation.
  deleteDialogOpen: boolean;
  openDeleteDialog: () => void;
  closeDeleteDialog: () => void;
  isDeleting: boolean;
  deleteError: string | null;
  handleDelete: () => void;
}

export function useEditLogEntryViewModel(): EditLogEntryViewModel {
  const { vehicleId, entryId } = useLocalSearchParams<{ vehicleId: string; entryId: string }>();
  const { vehicleRepository, logEntryRepository } = useDatabase();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [vehicleName, setVehicleName] = useState('');
  const [fields, setFields] = useState<EditLogEntryFormFields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<EditLogEntryFormErrors>({});
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [items, setItems] = useState<LogItemDraft[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!vehicleRepository || !vehicleId) return;
    void vehicleRepository.findById(vehicleId).then((vehicle) => {
      if (!vehicle) return;
      setVehicleName(vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`);
    });
  }, [vehicleRepository, vehicleId]);

  useEffect(() => {
    if (!logEntryRepository || !entryId) return;
    void logEntryRepository.findById(entryId).then((entry) => {
      if (!entry) {
        setLoadState('not-found');
        return;
      }
      setFields({
        typeId: entry.typeId as LogEntryTypeId,
        title: entry.title,
        date: entry.date,
        mileage: entry.mileage !== null ? String(entry.mileage) : '',
        notes: entry.notes ?? '',
      });
      setItems(
        entry.items.map((item, index) => ({
          id: `${index}`,
          categoryId: item.categoryId as ItemCategoryId,
          description: item.description,
          quantity: item.quantity !== null ? String(item.quantity) : '',
          unitCost: item.unitCost !== null ? String(item.unitCost) : '',
        })),
      );
      setLoadState('ready');
    });
  }, [logEntryRepository, entryId]);

  function updateField(field: keyof EditLogEntryFormFields, value: string): void {
    setFields((f) => ({ ...f, [field]: value }));
    setErrors((errs) => (errs[field as keyof EditLogEntryFormErrors] ? { ...errs, [field]: undefined } : errs));
  }

  function openDatePicker(): void {
    setIsDatePickerOpen(true);
  }

  function onDateSelected(date: Date): void {
    // Same iOS/Android picker-dismissal split as New Log Entry — see
    // useNewLogEntryViewModel.ts's onDateSelected.
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

  function validate(): EditLogEntryFormErrors {
    const nextErrors: EditLogEntryFormErrors = {};
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
    if (!logEntryRepository || !vehicleId || !entryId) return;

    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    // Rows left blank are silently dropped, same as New Log Entry's submit.
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
      await logEntryRepository.update(vehicleId, entryId, {
        typeId: fields.typeId as LogEntryTypeId,
        title: fields.title.trim(),
        date: fields.date,
        mileage: Number(fields.mileage.replace(/,/g, '')),
        notes: fields.notes.trim() || null,
        items: itemsData,
      });
      // back(), not push(`/garage/${vehicleId}`) -- this screen was reached
      // by pushing from Vehicle Detail (tapping the entry's card), so
      // pushing the same route again would stack a second instance instead
      // of returning to the one already there. Vehicle Detail's
      // useFocusEffect re-reads local Log Entries on return, so back()
      // still shows the just-saved values.
      router.back();
    } catch {
      setSubmitError("Couldn't save changes. Try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function openDeleteDialog(): void {
    setDeleteError(null);
    setDeleteDialogOpen(true);
  }

  function closeDeleteDialog(): void {
    if (isDeleting) return;
    setDeleteDialogOpen(false);
    setDeleteError(null);
  }

  async function handleDeleteConfirm(): Promise<void> {
    if (!logEntryRepository || !vehicleId || !entryId) return;

    setDeleteError(null);
    setIsDeleting(true);
    try {
      await logEntryRepository.delete(vehicleId, entryId);
      // back(), not dismissTo() -- unlike deleting a Vehicle (which removes
      // the whole Detail screen this Edit screen was pushed from), deleting
      // a Log Entry only removes one entry from a Vehicle Detail that's
      // still valid to show; its own useFocusEffect re-reads local Log
      // Entries on return, so the deleted entry simply stops appearing.
      router.back();
    } catch {
      setDeleteError("Couldn't delete this log entry. Try again in a moment.");
    } finally {
      setIsDeleting(false);
    }
  }

  return {
    loadState,
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
    deleteDialogOpen,
    openDeleteDialog,
    closeDeleteDialog,
    isDeleting,
    deleteError,
    handleDelete: () => void handleDeleteConfirm(),
  };
}

// Mirrors New Log Entry's itemRowTotal()/itemsGrandTotal() (see
// useNewLogEntryViewModel.ts), itself mirroring the web draft's
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
