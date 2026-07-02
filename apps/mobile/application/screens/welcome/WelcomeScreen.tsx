import { Text, View, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, fontWeight, fontFamily, radius } from '@maintenance-log/ui-tokens';
import { RevlogMark } from '@/application/components/RevlogMark';
import { useWelcomeViewModel } from './useWelcomeViewModel';

export function WelcomeScreen() {
  const { onGetStarted, onLogIn } = useWelcomeViewModel();

  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <RevlogMark size={56} />
        <View style={styles.wordmark}>
          <Text style={styles.wordmarkRev}>Rev</Text>
          <Text style={styles.wordmarkLog}>log</Text>
        </View>
        <Text style={styles.tagline}>Your vehicle's service history, always with you.</Text>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={onGetStarted} testID="welcome-get-started-btn">
          <Text style={styles.primaryButtonLabel}>Get Started</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onLogIn} testID="welcome-login-btn">
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
  // A row of two sibling Texts, not one Text with nested spans: Android
  // miscalculates text measurement (silently truncating trailing
  // characters) when a single Text tree mixes multiple custom font
  // families across nested spans -- iOS renders the nested form fine, so
  // this only shows up on Android. See ADR 0032.
  wordmark: {
    flexDirection: 'row',
    marginTop: spacing[4],
  },
  wordmarkRev: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['3xl'],
    color: colors.neutral[50],
  },
  wordmarkLog: {
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize['3xl'],
    color: colors.teal[500],
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
