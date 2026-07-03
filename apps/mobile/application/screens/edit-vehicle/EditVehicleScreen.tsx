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
import { colors, spacing, fontSize, fontWeight, fontFamily, radius } from '@maintenance-log/ui-tokens';
import { useEditVehicleViewModel, type VehicleFormFields } from './useEditVehicleViewModel';

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

interface FieldProps {
  field: keyof VehicleFormFields;
  label: string;
  value: string;
  error?: string;
  optional?: boolean;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad';
  half?: boolean;
  onChangeText: (field: keyof VehicleFormFields, value: string) => void;
}

function Field({ field, label, value, error, optional, placeholder, keyboardType, half, onChangeText }: FieldProps) {
  return (
    <View style={half ? styles.fieldHalf : styles.fieldFull}>
      <Text style={styles.fieldLabel}>
        {label}
        {optional && <Text style={styles.optionalTag}> (optional)</Text>}
      </Text>
      <TextInput
        style={[styles.input, error && styles.inputError]}
        placeholder={placeholder}
        placeholderTextColor={colors.neutral[400]}
        keyboardType={keyboardType}
        value={value}
        onChangeText={(text) => onChangeText(field, text)}
        testID={`edit-vehicle-${field}-input`}
      />
      {error && (
        <Text style={styles.fieldError} testID={`edit-vehicle-${field}-error`}>
          {error}
        </Text>
      )}
    </View>
  );
}

export function EditVehicleScreen() {
  const vm = useEditVehicleViewModel();

  if (vm.loadState === 'loading') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered} testID="edit-vehicle-loading">
          <ActivityIndicator color={colors.teal[500]} />
        </View>
      </SafeAreaView>
    );
  }

  if (vm.loadState === 'not-found') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered} testID="edit-vehicle-not-found">
          <Text style={styles.notFoundTitle}>Vehicle not found</Text>
          <Pressable onPress={vm.onBackToGarage} testID="edit-vehicle-not-found-back">
            <Text style={styles.notFoundLink}>Back to Garage</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backLink} onPress={vm.onCancel} testID="edit-vehicle-cancel-btn">
          <ChevronLeftIcon />
          <Text style={styles.backLabel} numberOfLines={1}>
            {vm.vehicleDisplayName}
          </Text>
        </Pressable>
        <Text style={styles.headerTitle}>Edit Vehicle</Text>
        <Pressable onPress={vm.submit} disabled={vm.isSubmitting} hitSlop={8} testID="edit-vehicle-save-btn">
          <Text style={[styles.saveLabel, vm.isSubmitting && styles.saveLabelDisabled]}>
            {vm.isSubmitting ? 'Saving…' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.fieldRow}>
            <Field
              field="make"
              label="Make"
              placeholder="Honda"
              value={vm.fields.make}
              error={vm.errors.make}
              onChangeText={vm.updateField}
              half
            />
            <Field
              field="model"
              label="Model"
              placeholder="CB650R"
              value={vm.fields.model}
              error={vm.errors.model}
              onChangeText={vm.updateField}
              half
            />
          </View>
          <View style={styles.fieldRow}>
            <Field
              field="year"
              label="Year"
              placeholder="2019"
              keyboardType="number-pad"
              value={vm.fields.year}
              error={vm.errors.year}
              onChangeText={vm.updateField}
              half
            />
            <Field
              field="mileage"
              label="Current mileage"
              placeholder="12,500"
              keyboardType="number-pad"
              value={vm.fields.mileage}
              error={vm.errors.mileage}
              onChangeText={vm.updateField}
              half
            />
          </View>
          <Field
            field="nickname"
            label="Nickname"
            placeholder="Blackbird"
            optional
            value={vm.fields.nickname}
            onChangeText={vm.updateField}
          />

          {vm.submitError && (
            <Text style={styles.submitError} accessibilityRole="alert" testID="edit-vehicle-submit-error">
              {vm.submitError}
            </Text>
          )}

          <View style={styles.dangerZone} testID="edit-vehicle-danger-zone">
            <Text style={styles.dangerTitle}>Danger zone</Text>
            <Text style={styles.dangerBody}>
              Deleting this vehicle permanently removes it and all its log entries. This cannot be undone.
            </Text>
            <Pressable style={styles.deleteBtn} onPress={vm.openDeleteDialog} testID="edit-vehicle-delete-btn">
              <TrashIcon />
              <Text style={styles.deleteBtnLabel}>Delete vehicle</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        transparent
        animationType="fade"
        visible={vm.deleteDialogOpen}
        onRequestClose={vm.closeDeleteDialog}
        testID="edit-vehicle-delete-dialog"
      >
        <View style={styles.dialogWrapper}>
          <Pressable
            style={styles.dialogBackdrop}
            onPress={vm.closeDeleteDialog}
            testID="edit-vehicle-delete-dialog-backdrop"
          />
          <View style={styles.dialogBox}>
            <View style={styles.dialogIcon}>
              <TrashIcon size={20} />
            </View>
            <Text style={styles.dialogTitle} testID="edit-vehicle-delete-dialog-title">
              Delete {vm.vehicleDisplayName}?
            </Text>
            <Text style={styles.dialogBody}>
              This will permanently delete the vehicle and all its log entries. This cannot be undone.
            </Text>
            {vm.deleteError && (
              <Text style={styles.dialogError} accessibilityRole="alert" testID="edit-vehicle-delete-error">
                {vm.deleteError}
              </Text>
            )}
            <View style={styles.dialogActions}>
              <Pressable
                style={styles.dialogBtnCancel}
                onPress={vm.closeDeleteDialog}
                disabled={vm.isDeleting}
                testID="edit-vehicle-delete-dialog-cancel-btn"
              >
                <Text style={styles.dialogBtnCancelLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.dialogBtnConfirm}
                onPress={vm.handleDelete}
                disabled={vm.isDeleting}
                testID="edit-vehicle-delete-dialog-confirm-btn"
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
  fieldRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  fieldFull: {
    marginBottom: spacing[4],
  },
  fieldHalf: {
    flex: 1,
    marginBottom: spacing[4],
  },
  fieldLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.neutral[200],
    marginBottom: spacing[1],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optionalTag: {
    fontWeight: fontWeight.normal,
    textTransform: 'none',
    letterSpacing: 0,
    color: colors.neutral[400],
  },
  input: {
    backgroundColor: colors.neutral[600],
    borderWidth: 1,
    borderColor: colors.neutral[400],
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    color: colors.neutral[50],
  },
  inputError: {
    borderColor: colors.danger[500],
  },
  fieldError: {
    marginTop: spacing[1],
    fontSize: fontSize.xs,
    color: colors.danger[500],
  },
  submitError: {
    marginTop: spacing[1],
    fontSize: fontSize.sm,
    color: colors.danger[500],
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
