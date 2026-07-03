import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
});
