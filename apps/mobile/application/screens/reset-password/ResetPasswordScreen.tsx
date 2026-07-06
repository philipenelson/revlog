import {
  Text,
  View,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { Controller } from 'react-hook-form';
import { colors, spacing, fontSize, fontWeight, fontFamily, radius } from '@maintenance-log/ui-tokens';
import { RevlogMark } from '@/application/components/RevlogMark';
import { useResetPasswordViewModel } from './useResetPasswordViewModel';

export function ResetPasswordScreen() {
  const vm = useResetPasswordViewModel();

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <RevlogMark size={44} />
          <Text style={styles.title} testID="reset-password-title">
            Set a new password
          </Text>
          <Text style={styles.body}>
            {vm.email
              ? `Enter the 6-digit code we sent to ${vm.email} and choose a new password. The code expires in 10 minutes.`
              : 'Enter the 6-digit code we sent you and choose a new password. The code expires in 10 minutes.'}
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Reset code</Text>
            <Controller
              control={vm.control}
              name="code"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={[styles.codeInput, vm.errors.code && styles.inputError]}
                  value={value}
                  // Strip anything non-numeric so paste/autofill can't push a
                  // malformed value past the client gate (mirrors verify-email).
                  onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor={colors.neutral[400]}
                  testID="reset-password-code-input"
                />
              )}
            />
            {vm.errors.code && <Text style={styles.fieldError}>{vm.errors.code.message}</Text>}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>New password</Text>
            <Controller
              control={vm.control}
              name="newPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, vm.errors.newPassword && styles.inputError]}
                  placeholder="At least 8 characters"
                  placeholderTextColor={colors.neutral[400]}
                  secureTextEntry
                  autoComplete="password-new"
                  textContentType="newPassword"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  testID="reset-password-new-password-input"
                />
              )}
            />
            {vm.errors.newPassword && <Text style={styles.fieldError}>{vm.errors.newPassword.message}</Text>}
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
                  testID="reset-password-confirm-password-input"
                />
              )}
            />
            {vm.errors.confirmPassword && (
              <Text style={styles.fieldError} testID="reset-password-confirm-password-error">
                {vm.errors.confirmPassword.message}
              </Text>
            )}
          </View>

          {vm.error && (
            <Text style={styles.formError} accessibilityRole="alert" testID="reset-password-error">
              {vm.error}
            </Text>
          )}

          <Pressable
            style={({ pressed }) => [styles.primaryButton, (vm.isSubmitting || pressed) && styles.primaryButtonActive]}
            onPress={vm.submit}
            disabled={vm.isSubmitting}
            testID="reset-password-submit"
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonLabel}>{vm.isSubmitting ? 'Resetting…' : 'Reset password'}</Text>
          </Pressable>

          {vm.resendState === 'sent' ? (
            <Text style={styles.resendSent} testID="reset-password-resend-sent">
              A new code is on its way.
            </Text>
          ) : (
            <Pressable
              style={styles.linkRow}
              onPress={vm.onResend}
              disabled={vm.resendState === 'sending'}
              testID="reset-password-resend"
              accessibilityRole="button"
            >
              <Text style={styles.linkAction}>
                {vm.resendState === 'sending' ? 'Sending…' : "Didn't get it? Resend code"}
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[800],
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[20],
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
    marginTop: spacing[8],
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
  codeInput: {
    backgroundColor: colors.neutral[700],
    borderWidth: 1,
    borderColor: colors.neutral[400],
    borderRadius: radius.md,
    paddingVertical: spacing[4],
    fontSize: fontSize['2xl'],
    color: colors.neutral[50],
    textAlign: 'center',
    letterSpacing: spacing[2],
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
    marginTop: spacing[5],
    paddingVertical: spacing[2],
  },
  linkAction: {
    fontSize: fontSize.sm,
    color: colors.teal[300],
    fontWeight: fontWeight.semibold,
  },
  resendSent: {
    marginTop: spacing[5],
    textAlign: 'center',
    fontSize: fontSize.sm,
    color: colors.success[500],
    fontWeight: fontWeight.medium,
  },
});
