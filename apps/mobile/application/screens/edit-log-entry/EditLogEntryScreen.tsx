import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, spacing, fontSize, fontWeight, fontFamily, radius } from '@maintenance-log/ui-tokens';
import type { LogEntryTypeId, ItemCategoryId } from '@maintenance-log/contracts';
import { formatShortDate } from '@/utils/format';
import { parseIsoDate } from '@/utils/date';
import { useEditLogEntryViewModel, type LogItemDraft } from './useEditLogEntryViewModel';

const TYPE_LABELS: Record<LogEntryTypeId, string> = {
  MAINTENANCE: 'Maintenance',
  REPAIR: 'Repair',
  INSPECTION: 'Inspection',
  MODIFICATION: 'Modification',
  INCIDENT: 'Incident',
  EVENT: 'Event',
  OTHER: 'Other',
};

const CATEGORY_LABELS: Record<ItemCategoryId, string> = {
  PART: 'Part',
  LABOR: 'Labor',
  FEE: 'Fee',
  OTHER: 'Other',
};

function ChevronLeftIcon() {
  return (
    <Svg width={8} height={14} viewBox="0 0 8 14" fill="none" aria-hidden>
      <Path
        d="M7 1L1 7l6 6"
        stroke={colors.teal[500]}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function PlusIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 14 14" fill="none" aria-hidden>
      <Path d="M7 2.5v9M2.5 7h9" stroke={colors.teal[400]} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function TrashIcon({ size = 13 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
      <Path
        d="M2 4h10M5 4V2.5h4V4M5.5 6.5v4M8.5 6.5v4M3 4l.7 7.5A1 1 0 004.7 13h4.6a1 1 0 001-.95L11 4"
        stroke={colors.danger[500]}
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface ItemRowProps {
  item: LogItemDraft;
  rowTotal: string | null;
  onChange: (patch: Partial<LogItemDraft>) => void;
  onRemove: () => void;
}

function ItemRow({ item, rowTotal, onChange, onRemove }: ItemRowProps) {
  return (
    <View style={styles.itemCard} testID="edit-log-entry-item-row">
      <View style={styles.itemCardTop}>
        <TextInput
          style={styles.itemDescriptionInput}
          placeholder="Description"
          placeholderTextColor={colors.neutral[400]}
          value={item.description}
          onChangeText={(text) => onChange({ description: text })}
          testID="edit-log-entry-item-description"
        />
        <Pressable onPress={onRemove} hitSlop={8} testID="edit-log-entry-item-remove-btn">
          <Text style={styles.itemRemoveLabel}>×</Text>
        </Pressable>
      </View>

      <View style={styles.categoryRow}>
        {(Object.keys(CATEGORY_LABELS) as ItemCategoryId[]).map((id) => {
          const active = item.categoryId === id;
          return (
            <Pressable
              key={id}
              style={[styles.categoryChip, active && styles.categoryChipActive]}
              onPress={() => onChange({ categoryId: id })}
              testID={`edit-log-entry-item-category-${id}`}
            >
              <Text style={[styles.categoryChipLabel, active && styles.categoryChipLabelActive]}>
                {CATEGORY_LABELS[id]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.itemCardBottom}>
        <TextInput
          style={[styles.itemNumberInput, styles.itemQty]}
          placeholder="Qty"
          placeholderTextColor={colors.neutral[400]}
          keyboardType="decimal-pad"
          value={item.quantity}
          onChangeText={(text) => onChange({ quantity: text })}
          testID="edit-log-entry-item-quantity"
        />
        <TextInput
          style={[styles.itemNumberInput, styles.itemUnitCost]}
          placeholder="Unit cost"
          placeholderTextColor={colors.neutral[400]}
          keyboardType="decimal-pad"
          value={item.unitCost}
          onChangeText={(text) => onChange({ unitCost: text })}
          testID="edit-log-entry-item-unit-cost"
        />
        <Text style={styles.itemRowTotal} testID="edit-log-entry-item-row-total">
          {rowTotal !== null ? `$${rowTotal}` : '—'}
        </Text>
      </View>
    </View>
  );
}

export function EditLogEntryScreen() {
  const vm = useEditLogEntryViewModel();

  if (vm.loadState === 'loading') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered} testID="edit-log-entry-loading">
          <ActivityIndicator color={colors.teal[500]} />
        </View>
      </SafeAreaView>
    );
  }

  if (vm.loadState === 'not-found') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered} testID="edit-log-entry-not-found">
          <Text style={styles.notFoundTitle}>Log entry not found</Text>
          <Pressable onPress={vm.onCancel} testID="edit-log-entry-not-found-back">
            <Text style={styles.notFoundLink}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backLink} onPress={vm.onCancel} testID="edit-log-entry-cancel-btn">
          <ChevronLeftIcon />
          <Text style={styles.backLabel} numberOfLines={1}>
            {vm.vehicleName || 'Vehicle'}
          </Text>
        </Pressable>
        <Text style={styles.headerTitle}>Edit Log Entry</Text>
        <Pressable onPress={vm.submit} disabled={vm.isSubmitting} hitSlop={8} testID="edit-log-entry-save-btn">
          <Text style={[styles.saveLabel, vm.isSubmitting && styles.saveLabelDisabled]}>
            {vm.isSubmitting ? 'Saving…' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionLabel}>Type</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.typeRow}
          >
            {(Object.keys(TYPE_LABELS) as LogEntryTypeId[]).map((id) => {
              const active = vm.fields.typeId === id;
              return (
                <Pressable
                  key={id}
                  style={[styles.typeChip, active && styles.typeChipActive]}
                  onPress={() => vm.updateField('typeId', id)}
                  testID={`edit-log-entry-type-${id}`}
                >
                  <Text style={[styles.typeChipLabel, active && styles.typeChipLabelActive]}>{TYPE_LABELS[id]}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {vm.errors.typeId && (
            <Text style={styles.fieldError} testID="edit-log-entry-typeId-error">
              {vm.errors.typeId}
            </Text>
          )}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. 25,000 mi service"
              placeholderTextColor={colors.neutral[400]}
              value={vm.fields.title}
              onChangeText={(text) => vm.updateField('title', text)}
              maxLength={100}
              testID="edit-log-entry-title-input"
            />
          </View>
          {vm.errors.title && (
            <Text style={styles.fieldError} testID="edit-log-entry-title-error">
              {vm.errors.title}
            </Text>
          )}

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Pressable onPress={vm.openDatePicker} testID="edit-log-entry-date-field">
                <Text style={styles.fieldLabel}>Date</Text>
                <Text style={styles.fieldValue}>{formatShortDate(vm.fields.date)}</Text>
              </Pressable>
              {vm.errors.date && (
                <Text style={styles.fieldError} testID="edit-log-entry-date-error">
                  {vm.errors.date}
                </Text>
              )}
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Mileage (mi)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. 12,400"
                placeholderTextColor={colors.neutral[400]}
                keyboardType="number-pad"
                value={vm.fields.mileage}
                onChangeText={(text) => vm.updateField('mileage', text)}
                testID="edit-log-entry-mileage-input"
              />
              {vm.errors.mileage && (
                <Text style={styles.fieldError} testID="edit-log-entry-mileage-error">
                  {vm.errors.mileage}
                </Text>
              )}
            </View>
          </View>

          {vm.isDatePickerOpen && (
            <DateTimePicker
              value={parseIsoDate(vm.fields.date)}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onValueChange={(_event, date) => vm.onDateSelected(date)}
              onDismiss={vm.onDatePickerDismiss}
              testID="edit-log-entry-date-picker"
            />
          )}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.fieldInput, styles.notesInput]}
              placeholder="Full synthetic 10W-40. Next change at 15,000 mi."
              placeholderTextColor={colors.neutral[400]}
              value={vm.fields.notes}
              onChangeText={(text) => vm.updateField('notes', text)}
              multiline
              maxLength={5000}
              testID="edit-log-entry-notes-input"
            />
          </View>

          <Text style={styles.sectionLabel}>Items</Text>

          {vm.items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              rowTotal={vm.itemRowTotal(item)}
              onChange={(patch) => vm.updateItem(item.id, patch)}
              onRemove={() => vm.removeItem(item.id)}
            />
          ))}

          <Pressable style={styles.addItemBtn} onPress={vm.addItem} testID="edit-log-entry-add-item-btn">
            <PlusIcon />
            <Text style={styles.addItemLabel}>Add item</Text>
          </Pressable>

          {vm.itemsTotal !== null && (
            <View style={styles.itemsTotalRow}>
              <Text style={styles.itemsTotalLabel}>Total</Text>
              <Text style={styles.itemsTotalValue} testID="edit-log-entry-items-total">
                ${vm.itemsTotal}
              </Text>
            </View>
          )}

          {vm.submitError && (
            <Text style={styles.submitError} accessibilityRole="alert" testID="edit-log-entry-submit-error">
              {vm.submitError}
            </Text>
          )}

          <Pressable
            style={[styles.saveBtn, vm.isSubmitting && styles.saveBtnDisabled]}
            onPress={vm.submit}
            disabled={vm.isSubmitting}
            testID="edit-log-entry-save-btn-bottom"
          >
            <Text style={styles.saveBtnLabel}>{vm.isSubmitting ? 'Saving…' : 'Save Log Entry'}</Text>
          </Pressable>

          <View style={styles.dangerZone} testID="edit-log-entry-danger-zone">
            <Text style={styles.dangerTitle}>Danger zone</Text>
            <Text style={styles.dangerBody}>Deleting this log entry cannot be undone.</Text>
            <Pressable style={styles.deleteBtn} onPress={vm.openDeleteDialog} testID="edit-log-entry-delete-btn">
              <TrashIcon />
              <Text style={styles.deleteBtnLabel}>Delete entry</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        transparent
        animationType="fade"
        visible={vm.deleteDialogOpen}
        onRequestClose={vm.closeDeleteDialog}
        testID="edit-log-entry-delete-dialog"
      >
        <View style={styles.dialogWrapper}>
          <Pressable
            style={styles.dialogBackdrop}
            onPress={vm.closeDeleteDialog}
            testID="edit-log-entry-delete-dialog-backdrop"
          />
          <View style={styles.dialogBox}>
            <View style={styles.dialogIcon}>
              <TrashIcon size={20} />
            </View>
            <Text style={styles.dialogTitle} testID="edit-log-entry-delete-dialog-title">
              Delete this log entry?
            </Text>
            <Text style={styles.dialogBody}>This cannot be undone.</Text>
            {vm.deleteError && (
              <Text style={styles.dialogError} accessibilityRole="alert" testID="edit-log-entry-delete-error">
                {vm.deleteError}
              </Text>
            )}
            <View style={styles.dialogActions}>
              <Pressable
                style={styles.dialogBtnCancel}
                onPress={vm.closeDeleteDialog}
                disabled={vm.isDeleting}
                testID="edit-log-entry-delete-dialog-cancel-btn"
              >
                <Text style={styles.dialogBtnCancelLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.dialogBtnConfirm}
                onPress={vm.handleDelete}
                disabled={vm.isDeleting}
                testID="edit-log-entry-delete-dialog-confirm-btn"
              >
                <Text style={styles.dialogBtnConfirmLabel}>{vm.isDeleting ? 'Deleting…' : 'Delete'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[800],
  },
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[4],
  },
  notFoundTitle: {
    fontFamily: fontFamily.displaySemibold,
    fontSize: fontSize.lg,
    color: colors.neutral[50],
  },
  notFoundLink: {
    fontSize: fontSize.sm,
    color: colors.teal[500],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: spacing[5],
    backgroundColor: colors.neutral[700],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[500],
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    flexShrink: 1,
  },
  backLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.teal[500],
  },
  headerTitle: {
    flexShrink: 0,
    marginHorizontal: spacing[2],
    fontFamily: fontFamily.displaySemibold,
    fontSize: fontSize.sm,
    color: colors.neutral[50],
  },
  saveLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.teal[500],
  },
  saveLabelDisabled: {
    color: colors.neutral[400],
  },
  scrollContent: {
    padding: spacing[5],
    paddingBottom: spacing[10],
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.neutral[300],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[2],
    marginTop: spacing[4],
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingBottom: spacing[1],
  },
  typeChip: {
    backgroundColor: colors.neutral[700],
    borderWidth: 1,
    borderColor: colors.neutral[400],
    borderRadius: 20,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  typeChipActive: {
    backgroundColor: colors.teal[700],
    borderColor: colors.teal[500],
  },
  typeChipLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.neutral[200],
  },
  typeChipLabelActive: {
    color: colors.teal[300],
  },
  field: {
    marginTop: spacing[4],
  },
  fieldRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[4],
  },
  fieldHalf: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.neutral[300],
    marginBottom: spacing[1],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldValue: {
    fontSize: fontSize.base,
    color: colors.neutral[50],
    backgroundColor: colors.neutral[600],
    borderWidth: 1,
    borderColor: colors.neutral[400],
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  fieldInput: {
    backgroundColor: colors.neutral[600],
    borderWidth: 1,
    borderColor: colors.neutral[400],
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    color: colors.neutral[50],
  },
  notesInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  fieldError: {
    marginTop: spacing[1],
    fontSize: fontSize.xs,
    color: colors.danger[500],
  },
  itemCard: {
    backgroundColor: colors.neutral[700],
    borderWidth: 1,
    borderColor: colors.neutral[400],
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  itemCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  itemDescriptionInput: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.neutral[50],
    paddingVertical: spacing[1],
  },
  itemRemoveLabel: {
    fontSize: fontSize.lg,
    color: colors.neutral[300],
  },
  categoryRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  categoryChip: {
    backgroundColor: colors.neutral[600],
    borderWidth: 1,
    borderColor: colors.neutral[400],
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  categoryChipActive: {
    backgroundColor: colors.teal[700],
    borderColor: colors.teal[500],
  },
  categoryChipLabel: {
    fontSize: fontSize.xs,
    color: colors.neutral[200],
  },
  categoryChipLabelActive: {
    color: colors.teal[300],
  },
  itemCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  itemNumberInput: {
    backgroundColor: colors.neutral[600],
    borderWidth: 1,
    borderColor: colors.neutral[400],
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    fontSize: fontSize.sm,
    color: colors.neutral[50],
  },
  itemQty: {
    width: 60,
  },
  itemUnitCost: {
    width: 90,
  },
  itemRowTotal: {
    flex: 1,
    textAlign: 'right',
    fontSize: fontSize.sm,
    color: colors.neutral[200],
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.neutral[400],
    borderRadius: radius.md,
    paddingVertical: spacing[3],
  },
  addItemLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.teal[300],
  },
  itemsTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing[3],
  },
  itemsTotalLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.neutral[200],
  },
  itemsTotalValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.neutral[50],
  },
  submitError: {
    marginTop: spacing[4],
    fontSize: fontSize.sm,
    color: colors.danger[500],
  },
  saveBtn: {
    marginTop: spacing[5],
    backgroundColor: colors.teal[500],
    borderRadius: radius.lg,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: colors.neutral[400],
  },
  saveBtnLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.neutral[900],
  },
  dangerZone: {
    marginTop: spacing[8],
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.danger[600],
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[700],
  },
  dangerTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.danger[500],
    marginBottom: spacing[2],
  },
  dangerBody: {
    fontSize: fontSize.xs,
    color: colors.neutral[200],
    lineHeight: fontSize.xs * 1.55,
    marginBottom: spacing[4],
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    borderWidth: 1,
    borderColor: colors.danger[500],
    borderRadius: radius.md,
  },
  deleteBtnLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.danger[500],
  },
  dialogWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  dialogBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.neutral[900],
    opacity: 0.8,
  },
  dialogBox: {
    width: '100%',
    padding: spacing[6],
    borderWidth: 1,
    borderColor: colors.neutral[500],
    borderRadius: radius.xl,
    backgroundColor: colors.neutral[700],
  },
  dialogIcon: {
    alignSelf: 'center',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.danger[500],
    borderRadius: radius.md,
    backgroundColor: colors.neutral[600],
    marginBottom: spacing[4],
  },
  dialogTitle: {
    fontFamily: fontFamily.displaySemibold,
    fontSize: fontSize.lg,
    color: colors.neutral[50],
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  dialogBody: {
    fontSize: fontSize.sm,
    color: colors.neutral[200],
    lineHeight: fontSize.sm * 1.5,
    textAlign: 'center',
  },
  dialogError: {
    marginTop: spacing[3],
    fontSize: fontSize.xs,
    color: colors.danger[500],
    textAlign: 'center',
  },
  dialogActions: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[6],
  },
  dialogBtnCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderWidth: 1,
    borderColor: colors.neutral[400],
    borderRadius: radius.md,
  },
  dialogBtnCancelLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.neutral[200],
  },
  dialogBtnConfirm: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    backgroundColor: colors.danger[500],
  },
  dialogBtnConfirmLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.neutral[900],
  },
});
