import {
  Text,
  View,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fontSize, fontWeight, fontFamily, radius } from '@maintenance-log/ui-tokens';
import { RevlogMark } from '@/application/components/RevlogMark';
import {
  useOnboardingViewModel,
  type OnboardingStep,
  type VehicleFormFields,
} from './useOnboardingViewModel';

const STEP_LABELS = ['Welcome', 'Your vehicle', 'Ready'] as const;

function StepIndicator({ step }: { step: OnboardingStep }) {
  return (
    <View style={styles.stepTrack} testID="onboarding-step-indicator">
      {[1, 2, 3].map((n) => (
        <View
          key={n}
          style={[
            styles.stepTick,
            n < step && styles.stepTickDone,
            n === step && styles.stepTickActive,
          ]}
        />
      ))}
    </View>
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
        testID={`onboarding-${field}-input`}
      />
      {error && (
        <Text style={styles.fieldError} testID={`onboarding-${field}-error`}>
          {error}
        </Text>
      )}
    </View>
  );
}

export function OnboardingScreen() {
  const vm = useOnboardingViewModel();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <StepIndicator step={vm.step} />
        <View style={styles.stepLabels}>
          {STEP_LABELS.map((label, i) => {
            const n = (i + 1) as OnboardingStep;
            return (
              <Text
                key={label}
                style={[
                  styles.stepLabel,
                  n < vm.step && styles.stepLabelDone,
                  n === vm.step && styles.stepLabelActive,
                ]}
              >
                {label}
              </Text>
            );
          })}
        </View>
      </View>

      {vm.step === 1 && <WelcomeStep vm={vm} />}
      {vm.step === 2 && <VehicleStep vm={vm} />}
      {vm.step === 3 && <ReadyStep vm={vm} />}
    </SafeAreaView>
  );
}

function WelcomeStep({ vm }: { vm: ReturnType<typeof useOnboardingViewModel> }) {
  return (
    <View style={styles.centeredBody}>
      <RevlogMark size={44} />
      <Text style={styles.title} testID="onboarding-welcome-title">
        Add your first vehicle
      </Text>
      <Text style={styles.body}>
        Tell us a bit about your bike to start tracking its service history. You can always add more later.
      </Text>

      <View style={styles.welcomeActions}>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonActive]}
          onPress={vm.goToVehicleStep}
          testID="onboarding-add-vehicle-btn"
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonLabel}>Add my first vehicle</Text>
        </Pressable>

        {vm.skipError && (
          <Text style={styles.submitError} accessibilityRole="alert" testID="onboarding-skip-error">
            {vm.skipError}
          </Text>
        )}

        <Pressable
          style={styles.skipRow}
          onPress={vm.onSkip}
          disabled={vm.isSkipping}
          testID="onboarding-skip-btn"
          accessibilityRole="button"
        >
          <Text style={styles.skipLabel}>{vm.isSkipping ? 'Skipping…' : 'Skip for now'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function VehicleStep({ vm }: { vm: ReturnType<typeof useOnboardingViewModel> }) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
        <View style={styles.fieldRow}>
          <Field field="make" label="Make" placeholder="e.g. Honda" value={vm.fields.make} error={vm.errors.make} onChangeText={vm.updateField} half />
          <Field field="model" label="Model" placeholder="e.g. CB650R" value={vm.fields.model} error={vm.errors.model} onChangeText={vm.updateField} half />
        </View>
        <View style={styles.fieldRow}>
          <Field field="year" label="Year" placeholder="e.g. 2019" keyboardType="number-pad" value={vm.fields.year} error={vm.errors.year} onChangeText={vm.updateField} half />
          <Field field="mileage" label="Current mileage" placeholder="e.g. 12,500" keyboardType="number-pad" value={vm.fields.mileage} error={vm.errors.mileage} onChangeText={vm.updateField} half />
        </View>
        <Field field="nickname" label="Nickname" placeholder="e.g. Blackbird" optional value={vm.fields.nickname} onChangeText={vm.updateField} />

        {vm.submitError && (
          <Text style={styles.submitError} accessibilityRole="alert" testID="onboarding-submit-error">
            {vm.submitError}
          </Text>
        )}
      </ScrollView>

      <View style={styles.formActions}>
        <Pressable style={styles.backButton} onPress={vm.goBackToWelcome} testID="onboarding-back-btn" accessibilityRole="button">
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.primaryButtonFlex, (vm.isSubmitting || pressed) && styles.primaryButtonActive]}
          onPress={vm.onContinue}
          disabled={vm.isSubmitting}
          testID="onboarding-continue-btn"
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonLabel}>{vm.isSubmitting ? 'Saving…' : 'Continue'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function ReadyStep({ vm }: { vm: ReturnType<typeof useOnboardingViewModel> }) {
  const v = vm.savedVehicle;
  return (
    <View style={styles.centeredBody}>
      <RevlogMark size={44} />
      <Text style={styles.title} testID="onboarding-ready-title">
        {vm.readyHeadline}
      </Text>

      {v && (
        <View style={styles.specPlate} testID="onboarding-spec-plate">
          {v.nickname.trim() !== '' && <SpecRow label="Nickname" value={v.nickname.trim()} />}
          <SpecRow label="Make & model" value={`${v.make.trim()} ${v.model.trim()}`} />
          <SpecRow label="Year" value={v.year.trim()} />
          <SpecRow label="Mileage" value={`${v.mileage.trim()} mi`} mono />
        </View>
      )}

      <View style={styles.welcomeActions}>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonActive]}
          onPress={vm.onGoToGarage}
          testID="onboarding-go-to-garage-btn"
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonLabel}>Go to my garage</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SpecRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.specRow}>
      <Text style={styles.specLabel}>{label}</Text>
      <Text style={[styles.specValue, mono && styles.specValueMono]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[800],
    paddingHorizontal: spacing[6],
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
  },
  stepTrack: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  stepTick: {
    flex: 1,
    height: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.neutral[500],
  },
  stepTickDone: {
    backgroundColor: colors.teal[600],
  },
  stepTickActive: {
    backgroundColor: colors.teal[500],
  },
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[2],
  },
  stepLabel: {
    fontSize: fontSize.xs,
    color: colors.neutral[400],
    fontWeight: fontWeight.medium,
  },
  stepLabelDone: {
    color: colors.neutral[300],
  },
  stepLabelActive: {
    color: colors.teal[400],
  },
  centeredBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing[10],
  },
  title: {
    fontFamily: fontFamily.displaySemibold,
    fontSize: fontSize['2xl'],
    color: colors.neutral[50],
    marginTop: spacing[6],
    textAlign: 'center',
  },
  body: {
    fontSize: fontSize.base,
    color: colors.neutral[200],
    marginTop: spacing[3],
    textAlign: 'center',
    lineHeight: fontSize.base * 1.5,
  },
  welcomeActions: {
    alignSelf: 'stretch',
    marginTop: spacing[8],
  },
  primaryButton: {
    backgroundColor: colors.teal[500],
    borderRadius: radius.md,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  primaryButtonFlex: {
    flex: 1,
    backgroundColor: colors.teal[500],
    borderRadius: radius.md,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  primaryButtonActive: {
    backgroundColor: colors.teal[600],
  },
  primaryButtonLabel: {
    color: colors.neutral[900],
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  skipRow: {
    alignItems: 'center',
    marginTop: spacing[4],
    paddingVertical: spacing[2],
  },
  skipLabel: {
    fontSize: fontSize.sm,
    color: colors.neutral[300],
    fontWeight: fontWeight.medium,
  },
  formScroll: {
    paddingTop: spacing[6],
    paddingBottom: spacing[6],
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
    backgroundColor: colors.neutral[700],
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
    marginTop: spacing[3],
    fontSize: fontSize.sm,
    color: colors.danger[500],
    textAlign: 'center',
  },
  formActions: {
    flexDirection: 'row',
    gap: spacing[3],
    alignItems: 'center',
    paddingVertical: spacing[4],
  },
  backButton: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[5],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral[500],
    alignItems: 'center',
  },
  backLabel: {
    fontSize: fontSize.base,
    color: colors.neutral[100],
    fontWeight: fontWeight.medium,
  },
  specPlate: {
    alignSelf: 'stretch',
    marginTop: spacing[6],
    backgroundColor: colors.neutral[700],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[500],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[600],
  },
  specLabel: {
    fontSize: fontSize.sm,
    color: colors.neutral[300],
  },
  specValue: {
    fontSize: fontSize.sm,
    color: colors.neutral[50],
    fontWeight: fontWeight.medium,
  },
  specValueMono: {
    fontFamily: fontFamily.mono,
  },
});
