import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, spacing, fontSize, fontWeight, fontFamily, radius } from '@maintenance-log/ui-tokens';
import type { LogEntryTypeId, ItemCategoryId } from '@maintenance-log/domain';
import { formatShortDate } from '@/utils/format';
import { parseIsoDate } from '@/utils/date';
import { useNewLogEntryViewModel, type LogItemDraft } from './useNewLogEntryViewModel';

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

interface ItemRowProps {
  item: LogItemDraft;
  rowTotal: string | null;
  onChange: (patch: Partial<LogItemDraft>) => void;
  onRemove: () => void;
}

function ItemRow({ item, rowTotal, onChange, onRemove }: ItemRowProps) {
  return (
    <View style={styles.itemCard} testID="new-log-entry-item-row">
      <View style={styles.itemCardTop}>
        <TextInput
          style={styles.itemDescriptionInput}
          placeholder="Description"
          placeholderTextColor={colors.neutral[400]}
          value={item.description}
          onChangeText={(text) => onChange({ description: text })}
          testID="new-log-entry-item-description"
        />
        <Pressable onPress={onRemove} hitSlop={8} testID="new-log-entry-item-remove-btn">
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
              testID={`new-log-entry-item-category-${id}`}
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
          testID="new-log-entry-item-quantity"
        />
        <TextInput
          style={[styles.itemNumberInput, styles.itemUnitCost]}
          placeholder="Unit cost"
          placeholderTextColor={colors.neutral[400]}
          keyboardType="decimal-pad"
          value={item.unitCost}
          onChangeText={(text) => onChange({ unitCost: text })}
          testID="new-log-entry-item-unit-cost"
        />
        <Text style={styles.itemRowTotal} testID="new-log-entry-item-row-total">
          {rowTotal !== null ? `$${rowTotal}` : '—'}
        </Text>
      </View>
    </View>
  );
}

export function NewLogEntryScreen() {
  const vm = useNewLogEntryViewModel();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backLink} onPress={vm.onCancel} testID="new-log-entry-cancel-btn">
          <ChevronLeftIcon />
          <Text style={styles.backLabel} numberOfLines={1}>
            {vm.vehicleName || 'Vehicle'}
          </Text>
        </Pressable>
        <Text style={styles.headerTitle}>New Log Entry</Text>
        <Pressable onPress={vm.submit} disabled={vm.isSubmitting} hitSlop={8} testID="new-log-entry-save-btn">
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
                  testID={`new-log-entry-type-${id}`}
                >
                  <Text style={[styles.typeChipLabel, active && styles.typeChipLabelActive]}>{TYPE_LABELS[id]}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {vm.errors.typeId && (
            <Text style={styles.fieldError} testID="new-log-entry-typeId-error">
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
              testID="new-log-entry-title-input"
            />
          </View>
          {vm.errors.title && (
            <Text style={styles.fieldError} testID="new-log-entry-title-error">
              {vm.errors.title}
            </Text>
          )}

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Pressable onPress={vm.openDatePicker} testID="new-log-entry-date-field">
                <Text style={styles.fieldLabel}>Date</Text>
                <Text style={styles.fieldValue}>{formatShortDate(vm.fields.date)}</Text>
              </Pressable>
              {vm.errors.date && (
                <Text style={styles.fieldError} testID="new-log-entry-date-error">
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
                testID="new-log-entry-mileage-input"
              />
              {vm.errors.mileage && (
                <Text style={styles.fieldError} testID="new-log-entry-mileage-error">
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
              testID="new-log-entry-date-picker"
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
              testID="new-log-entry-notes-input"
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

          <Pressable style={styles.addItemBtn} onPress={vm.addItem} testID="new-log-entry-add-item-btn">
            <PlusIcon />
            <Text style={styles.addItemLabel}>Add item</Text>
          </Pressable>

          {vm.itemsTotal !== null && (
            <View style={styles.itemsTotalRow}>
              <Text style={styles.itemsTotalLabel}>Total</Text>
              <Text style={styles.itemsTotalValue} testID="new-log-entry-items-total">
                ${vm.itemsTotal}
              </Text>
            </View>
          )}

          {vm.submitError && (
            <Text style={styles.submitError} accessibilityRole="alert" testID="new-log-entry-submit-error">
              {vm.submitError}
            </Text>
          )}

          <Pressable
            style={[styles.saveBtn, vm.isSubmitting && styles.saveBtnDisabled]}
            onPress={vm.submit}
            disabled={vm.isSubmitting}
            testID="new-log-entry-save-btn-bottom"
          >
            <Text style={styles.saveBtnLabel}>{vm.isSubmitting ? 'Saving…' : 'Save Log Entry'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
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
});
