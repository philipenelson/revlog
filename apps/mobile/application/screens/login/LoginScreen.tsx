import { Text, View, TextInput, Pressable, StyleSheet } from 'react-native';
import { Controller } from 'react-hook-form';
import { colors, spacing, fontSize, fontWeight, fontFamily, radius } from '@maintenance-log/ui-tokens';
import { RevlogMark } from '@/application/components/RevlogMark';
import { useLoginViewModel } from './useLoginViewModel';

export function LoginScreen() {
  const vm = useLoginViewModel();

  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <RevlogMark size={40} />
        <View style={styles.wordmark}>
          <Text style={styles.wordmarkRev}>Rev</Text>
          <Text style={styles.wordmarkLog}>log</Text>
        </View>
        <Text style={styles.tagline}>Service history that stays with you</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Email</Text>
          <Controller
            control={vm.control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, vm.errors.email && styles.inputError]}
                placeholder="you@example.com"
                placeholderTextColor={colors.neutral[400]}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                testID="login-email-input"
              />
            )}
          />
          {vm.errors.email && <Text style={styles.fieldError}>{vm.errors.email.message}</Text>}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Password</Text>
          <Controller
            control={vm.control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, vm.errors.password && styles.inputError]}
                placeholder="••••••••"
                placeholderTextColor={colors.neutral[400]}
                secureTextEntry
                autoComplete="password"
                textContentType="password"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                testID="login-password-input"
              />
            )}
          />
          {vm.errors.password && <Text style={styles.fieldError}>{vm.errors.password.message}</Text>}
        </View>

        {vm.error && (
          <Text style={styles.formError} accessibilityRole="alert" testID="login-error">
            {vm.error}
          </Text>
        )}

        <Pressable
          style={({ pressed }) => [styles.primaryButton, (vm.isSubmitting || pressed) && styles.primaryButtonActive]}
          onPress={vm.submit}
          disabled={vm.isSubmitting}
          testID="login-submit-btn"
        >
          <Text style={styles.primaryButtonLabel}>{vm.isSubmitting ? 'Signing in…' : 'Sign in'}</Text>
        </Pressable>

        <Pressable style={styles.linkRow} onPress={vm.onForgotPassword} testID="login-forgot-password-link">
          <Text style={styles.linkAction}>Forgot password?</Text>
        </Pressable>
      </View>

      <Pressable style={styles.footerLinkRow} onPress={vm.onRegister} testID="login-register-link">
        <Text style={styles.linkText}>Don&apos;t have an account? </Text>
        <Text style={styles.linkAction}>Register</Text>
      </Pressable>
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
  logoWrap: {
    alignItems: 'center',
    marginBottom: spacing[10],
  },
  // Sibling Texts in a row, not nested spans -- see WelcomeScreen's
  // wordmark comment / ADR 0032 (Android truncates trailing characters
  // when a single Text tree mixes custom font families across spans).
  wordmark: {
    flexDirection: 'row',
    marginTop: spacing[3],
  },
  wordmarkRev: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    color: colors.neutral[50],
  },
  wordmarkLog: {
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize.xl,
    color: colors.teal[500],
  },
  tagline: {
    marginTop: spacing[2],
    fontSize: fontSize.sm,
    color: colors.neutral[300],
  },
  form: {
    width: '100%',
  },
  fieldGroup: {
    marginBottom: spacing[3],
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
  formError: {
    marginTop: spacing[1],
    marginBottom: spacing[2],
    fontSize: fontSize.sm,
    color: colors.danger[500],
  },
  primaryButton: {
    backgroundColor: colors.teal[500],
    borderRadius: radius.md,
    paddingVertical: spacing[4],
    alignItems: 'center',
    marginTop: spacing[2],
  },
  primaryButtonActive: {
    backgroundColor: colors.teal[600],
  },
  primaryButtonLabel: {
    color: colors.neutral[900],
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  linkRow: {
    alignItems: 'center',
    marginTop: spacing[4],
  },
  linkAction: {
    fontSize: fontSize.sm,
    color: colors.teal[300],
    fontWeight: fontWeight.semibold,
  },
  footerLinkRow: {
    marginTop: 'auto',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: spacing[4],
  },
  linkText: {
    fontSize: fontSize.sm,
    color: colors.neutral[300],
  },
});
