import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors, spacing, fontSize, fontWeight, fontFamily, radius } from '@maintenance-log/ui-tokens';
import { useAddVehicleViewModel, type VehicleFormFields } from './useAddVehicleViewModel';

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

function CameraIcon() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" aria-hidden>
      <Rect x={2} y={5} width={20} height={15} rx={2.5} stroke={colors.neutral[300]} strokeWidth={1.5} />
      <Circle cx={12} cy={13} r={3.5} stroke={colors.neutral[300]} strokeWidth={1.5} />
      <Path d="M8.5 5l1-2h5l1 2" stroke={colors.neutral[300]} strokeWidth={1.5} strokeLinejoin="round" />
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
        testID={`add-vehicle-${field}-input`}
      />
      {error && (
        <Text style={styles.fieldError} testID={`add-vehicle-${field}-error`}>
          {error}
        </Text>
      )}
    </View>
  );
}

export function AddVehicleScreen() {
  const vm = useAddVehicleViewModel();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backLink} onPress={vm.onCancel} testID="add-vehicle-cancel-btn">
          <ChevronLeftIcon />
          <Text style={styles.backLabel}>Garage</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Add Vehicle</Text>
        <Pressable onPress={vm.submit} disabled={vm.isSubmitting} hitSlop={8} testID="add-vehicle-save-btn">
          <Text style={[styles.saveLabel, vm.isSubmitting && styles.saveLabelDisabled]}>
            {vm.isSubmitting ? 'Saving…' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.photoSection}>
            {vm.photoPreviewUri ? (
              <View style={styles.photoPreviewWrap} testID="add-vehicle-photo-preview">
                <Image source={{ uri: vm.photoPreviewUri }} style={styles.photoPreviewImage} resizeMode="cover" />
                <Pressable
                  style={styles.photoRemoveBtn}
                  onPress={vm.removePhoto}
                  hitSlop={8}
                  testID="add-vehicle-photo-remove-btn"
                >
                  <Text style={styles.photoRemoveLabel}>×</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.photoPlaceholder} onPress={vm.pickPhoto} testID="add-vehicle-photo-picker">
                <CameraIcon />
                <Text style={styles.photoText}>Add a photo</Text>
                <Text style={styles.photoSubtext}>Optional</Text>
              </Pressable>
            )}
            {vm.photoError && (
              <Text style={styles.photoError} testID="add-vehicle-photo-error">
                {vm.photoError}
              </Text>
            )}
          </View>

          <View style={styles.fieldRow}>
            <Field
              field="make"
              label="Make"
              placeholder="e.g. Honda"
              value={vm.fields.make}
              error={vm.errors.make}
              onChangeText={vm.updateField}
              half
            />
            <Field
              field="model"
              label="Model"
              placeholder="e.g. CB650R"
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
              placeholder="e.g. 2019"
              keyboardType="number-pad"
              value={vm.fields.year}
              error={vm.errors.year}
              onChangeText={vm.updateField}
              half
            />
            <Field
              field="mileage"
              label="Current mileage"
              placeholder="e.g. 12,500"
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
            placeholder="e.g. Blackbird"
            optional
            value={vm.fields.nickname}
            onChangeText={vm.updateField}
          />

          {vm.submitError && (
            <Text style={styles.submitError} accessibilityRole="alert" testID="add-vehicle-submit-error">
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
  photoSection: {
    marginBottom: spacing[5],
  },
  photoPlaceholder: {
    height: 120,
    backgroundColor: colors.neutral[700],
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.neutral[400],
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  photoText: {
    fontSize: fontSize.xs,
    color: colors.neutral[300],
  },
  photoSubtext: {
    fontSize: fontSize.xs,
    color: colors.neutral[400],
  },
  photoPreviewWrap: {
    height: 120,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  photoPreviewImage: {
    width: '100%',
    height: '100%',
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: spacing[2],
    right: spacing[2],
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[900],
  },
  photoRemoveLabel: {
    fontSize: fontSize.base,
    color: colors.neutral[50],
    marginTop: -2,
  },
  photoError: {
    marginTop: spacing[2],
    fontSize: fontSize.xs,
    color: colors.danger[500],
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
