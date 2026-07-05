import { Text, View, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, fontWeight, fontFamily, radius } from '@maintenance-log/ui-tokens';
import { RevlogMark } from '@/application/components/RevlogMark';
import { useEnableBiometricsViewModel } from './useEnableBiometricsViewModel';

export function EnableBiometricsScreen() {
  const vm = useEnableBiometricsViewModel();

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <RevlogMark size={44} />
        <Text style={styles.title} testID="enable-biometrics-title">
          Unlock faster next time
        </Text>
        <Text style={styles.body}>
          Use Face ID, Touch ID, or your device biometrics to sign back in — no password to retype each launch. You can
          change this anytime in Settings.
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, (vm.isEnabling || pressed) && styles.primaryButtonActive]}
          onPress={vm.onEnable}
          disabled={vm.isEnabling}
          testID="enable-biometrics-enable"
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonLabel}>{vm.isEnabling ? 'Enabling…' : 'Enable biometric unlock'}</Text>
        </Pressable>

        <Pressable
          style={styles.skipRow}
          onPress={vm.onSkip}
          disabled={vm.isEnabling}
          testID="enable-biometrics-skip"
          accessibilityRole="button"
        >
          <Text style={styles.skipLabel}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[800],
    paddingHorizontal: spacing[6],
    paddingTop: spacing[24],
    paddingBottom: spacing[10],
  },
  hero: {
    alignItems: 'center',
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
    color: colors.neutral[300],
    marginTop: spacing[3],
    textAlign: 'center',
    lineHeight: fontSize.base * 1.5,
  },
  actions: {
    marginTop: 'auto',
  },
  primaryButton: {
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
});
