import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { VehicleGlyph } from '@/application/components/VehicleGlyph';
import { useVehicleTransferViewModel } from './useVehicleTransferViewModel';

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

function TransferIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" aria-hidden>
      <Path
        d="M4 12a8 8 0 0114-5.3M20 4v5h-5"
        stroke={colors.teal[500]}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M20 12a8 8 0 01-14 5.3M4 20v-5h5"
        stroke={colors.teal[500]}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function WarningIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" aria-hidden>
      <Path d="M12 4.5 L20.5 19 H3.5 Z" stroke={colors.warning[500]} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M12 10v3.8" stroke={colors.warning[500]} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M12 16.4h.01" stroke={colors.warning[500]} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function VehicleTransferScreen() {
  const vm = useVehicleTransferViewModel();

  if (vm.loadState === 'loading') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered} testID="vehicle-transfer-loading">
          <ActivityIndicator color={colors.teal[500]} />
        </View>
      </SafeAreaView>
    );
  }

  if (vm.loadState === 'not-found') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered} testID="vehicle-transfer-not-found">
          <Text style={styles.notFoundTitle}>Vehicle not found</Text>
          <Pressable onPress={vm.onCancel} testID="vehicle-transfer-not-found-back">
            <Text style={styles.notFoundLink}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backLink} onPress={vm.onCancel} testID="vehicle-transfer-cancel-btn">
          <ChevronLeftIcon />
          <Text style={styles.backLabel} numberOfLines={1}>
            {vm.vehicleDisplayName}
          </Text>
        </Pressable>
        <Text style={styles.headerTitle}>Transfer Vehicle</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.introIcon}>
            <TransferIcon />
          </View>
          <Text style={styles.introTitle}>Transfer this vehicle</Text>
          <Text style={styles.introBody}>
            Send {vm.vehicleDisplayName} and its complete service history to another Revlog account.
          </Text>

          <View style={styles.vehicleChip} testID="vehicle-transfer-vehicle-chip">
            <View style={styles.vehicleChipIcon}>
              <VehicleGlyph size={28} />
            </View>
            <View>
              <Text style={styles.vehicleChipName}>{vm.vehicleDisplayName}</Text>
              <Text style={styles.vehicleChipMeta}>{vm.vehicleSubMeta}</Text>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Recipient email</Text>
            <TextInput
              style={[styles.input, vm.emailError && styles.inputError]}
              placeholder="recipient@example.com"
              placeholderTextColor={colors.neutral[400]}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={vm.recipientEmail}
              onChangeText={vm.updateRecipientEmail}
              testID="vehicle-transfer-email-input"
            />
            {vm.emailError && (
              <Text style={styles.fieldError} testID="vehicle-transfer-email-error">
                {vm.emailError}
              </Text>
            )}
          </View>

          <View style={styles.warningBox}>
            <WarningIcon />
            <Text style={styles.warningText}>
              The recipient must accept the transfer before ownership changes. Your vehicle will be locked until
              they respond.
            </Text>
          </View>

          {vm.submitError && (
            <Text style={styles.submitError} accessibilityRole="alert" testID="vehicle-transfer-submit-error">
              {vm.submitError}
            </Text>
          )}

          <Pressable
            style={[styles.primaryBtn, vm.isSubmitting && styles.primaryBtnDisabled]}
            onPress={vm.submit}
            disabled={vm.isSubmitting}
            testID="vehicle-transfer-submit-btn"
          >
            <Text style={styles.primaryBtnLabel}>{vm.isSubmitting ? 'Sending…' : 'Send transfer'}</Text>
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
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    padding: spacing[6],
    paddingBottom: spacing[10],
  },
  introIcon: {
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  introTitle: {
    fontFamily: fontFamily.displaySemibold,
    fontSize: fontSize.lg,
    color: colors.neutral[50],
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  introBody: {
    fontSize: fontSize.sm,
    color: colors.neutral[200],
    textAlign: 'center',
    lineHeight: fontSize.sm * 1.5,
    marginBottom: spacing[6],
  },
  vehicleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.neutral[500],
    borderRadius: radius.md,
    backgroundColor: colors.neutral[700],
    marginBottom: spacing[6],
  },
  vehicleChipIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.neutral[600],
  },
  vehicleChipName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.neutral[50],
  },
  vehicleChipMeta: {
    marginTop: 2,
    fontSize: fontSize.xs,
    color: colors.neutral[300],
  },
  fieldGroup: {
    marginBottom: spacing[5],
  },
  fieldLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.neutral[200],
    marginBottom: spacing[1],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  warningBox: {
    flexDirection: 'row',
    gap: spacing[2],
    alignItems: 'flex-start',
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.warning[600],
    borderRadius: radius.md,
    backgroundColor: colors.neutral[700],
    marginBottom: spacing[6],
  },
  warningText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.neutral[200],
    lineHeight: fontSize.xs * 1.55,
  },
  submitError: {
    marginBottom: spacing[3],
    fontSize: fontSize.sm,
    color: colors.danger[500],
    textAlign: 'center',
  },
  primaryBtn: {
    alignItems: 'center',
    paddingVertical: spacing[4],
    borderRadius: radius.md,
    backgroundColor: colors.teal[500],
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.neutral[900],
  },
});
