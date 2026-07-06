import { Text, View, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Controller } from 'react-hook-form';
import { colors, spacing, fontSize, fontWeight, fontFamily, radius } from '@maintenance-log/ui-tokens';
import { RevlogMark } from '@/application/components/RevlogMark';
import { useForgotPasswordViewModel } from './useForgotPasswordViewModel';

export function ForgotPasswordScreen() {
  const vm = useForgotPasswordViewModel();

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.hero}>
        <RevlogMark size={44} />
        <Text style={styles.title} testID="forgot-password-title">
          Forgot your password?
        </Text>
        <Text style={styles.body}>
          Enter your email and we&apos;ll send you a 6-digit code to set a new password.
        </Text>
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
                testID="forgot-password-email-input"
              />
            )}
          />
          {vm.errors.email && <Text style={styles.fieldError}>{vm.errors.email.message}</Text>}
        </View>

        {vm.error && (
          <Text style={styles.formError} accessibilityRole="alert" testID="forgot-password-error">
            {vm.error}
          </Text>
        )}

        <Pressable
          style={({ pressed }) => [styles.primaryButton, (vm.isSubmitting || pressed) && styles.primaryButtonActive]}
          onPress={vm.submit}
          disabled={vm.isSubmitting}
          testID="forgot-password-submit"
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonLabel}>{vm.isSubmitting ? 'Sending…' : 'Send reset code'}</Text>
        </Pressable>

        <Pressable style={styles.linkRow} onPress={vm.onBackToLogin} testID="forgot-password-back-link">
          <Text style={styles.linkAction}>Back to sign in</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
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
    color: colors.neutral[200],
    marginTop: spacing[3],
    textAlign: 'center',
    lineHeight: fontSize.base * 1.5,
  },
  form: {
    marginTop: spacing[10],
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
  formError: {
    marginTop: spacing[1],
    marginBottom: spacing[2],
    fontSize: fontSize.sm,
    color: colors.danger[500],
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: colors.teal[500],
    borderRadius: radius.md,
    paddingVertical: spacing[4],
    alignItems: 'center',
    marginTop: spacing[4],
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
    marginTop: spacing[5],
    paddingVertical: spacing[2],
  },
  linkAction: {
    fontSize: fontSize.sm,
    color: colors.teal[300],
    fontWeight: fontWeight.semibold,
  },
});
