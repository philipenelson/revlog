import { Text, View, TextInput, Pressable, StyleSheet } from 'react-native';
import { Controller } from 'react-hook-form';
import { colors, spacing, fontSize, fontWeight, fontFamily, radius } from '@maintenance-log/ui-tokens';
import { useRegisterViewModel } from './useRegisterViewModel';

export function RegisterScreen() {
  const vm = useRegisterViewModel();

  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.tagline}>Start tracking your vehicle&apos;s history</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Name</Text>
          <Controller
            control={vm.control}
            name="fullName"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, vm.errors.fullName && styles.inputError]}
                placeholder="Full name"
                placeholderTextColor={colors.neutral[400]}
                autoComplete="name"
                textContentType="name"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                testID="register-name-input"
              />
            )}
          />
          {vm.errors.fullName && <Text style={styles.fieldError}>{vm.errors.fullName.message}</Text>}
        </View>

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
                testID="register-email-input"
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
                placeholder="At least 8 characters"
                placeholderTextColor={colors.neutral[400]}
                secureTextEntry
                autoComplete="password-new"
                textContentType="newPassword"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                testID="register-password-input"
              />
            )}
          />
          {vm.errors.password && <Text style={styles.fieldError}>{vm.errors.password.message}</Text>}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Confirm password</Text>
          <Controller
            control={vm.control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, vm.errors.confirmPassword && styles.inputError]}
                placeholder="Re-enter password"
                placeholderTextColor={colors.neutral[400]}
                secureTextEntry
                autoComplete="password-new"
                textContentType="newPassword"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                testID="register-confirm-password-input"
              />
            )}
          />
          {vm.errors.confirmPassword && (
            <Text style={styles.fieldError} testID="register-confirm-password-error">
              {vm.errors.confirmPassword.message}
            </Text>
          )}
        </View>

        {vm.error && (
          <Text style={styles.formError} accessibilityRole="alert" testID="register-error">
            {vm.error}
          </Text>
        )}

        <Pressable
          style={({ pressed }) => [styles.primaryButton, (vm.isSubmitting || pressed) && styles.primaryButtonActive]}
          onPress={vm.submit}
          disabled={vm.isSubmitting}
          testID="register-submit-btn"
        >
          <Text style={styles.primaryButtonLabel}>{vm.isSubmitting ? 'Creating account…' : 'Create account'}</Text>
        </Pressable>
      </View>

      <Pressable style={styles.footerLinkRow} onPress={vm.onSignIn} testID="register-sign-in-link">
        <Text style={styles.linkText}>Already have an account? </Text>
        <Text style={styles.linkAction}>Sign in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[800],
    paddingHorizontal: spacing[6],
    paddingTop: spacing[20],
    paddingBottom: spacing[10],
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.neutral[50],
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
  linkAction: {
    fontSize: fontSize.sm,
    color: colors.teal[300],
    fontWeight: fontWeight.semibold,
  },
});
