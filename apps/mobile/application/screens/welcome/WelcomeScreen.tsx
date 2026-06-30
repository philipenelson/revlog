import { Text, View, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, fontWeight, fontFamily, radius } from '@maintenance-log/ui-tokens';
import { useWelcomeViewModel } from './useWelcomeViewModel';

export function WelcomeScreen() {
  const { onGetStarted, onLogIn } = useWelcomeViewModel();

  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <Text style={styles.wordmark}>
          <Text style={styles.wordmarkRev}>Rev</Text>
          <Text style={styles.wordmarkLog}>log</Text>
        </Text>
        <Text style={styles.tagline}>Your vehicle's service history, always with you.</Text>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={onGetStarted}>
          <Text style={styles.primaryButtonLabel}>Get Started</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onLogIn}>
          <Text style={styles.secondaryButtonLabel}>Log in</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.neutral[800],
    paddingHorizontal: spacing[6],
    paddingTop: spacing[24],
    paddingBottom: spacing[10],
  },
  logoWrap: {
    alignItems: 'center',
    marginTop: spacing[24],
  },
  wordmark: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['3xl'],
  },
  wordmarkRev: {
    color: colors.neutral[50],
    fontWeight: fontWeight.normal,
  },
  wordmarkLog: {
    color: colors.teal[500],
    fontWeight: fontWeight.bold,
  },
  tagline: {
    marginTop: spacing[3],
    fontSize: fontSize.base,
    color: colors.neutral[200],
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    gap: spacing[3],
  },
  primaryButton: {
    backgroundColor: colors.teal[500],
    borderRadius: radius.md,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  primaryButtonLabel: {
    color: colors.neutral[900],
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.neutral[400],
    borderRadius: radius.md,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  secondaryButtonLabel: {
    color: colors.neutral[50],
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
});
