import { Text, View, Pressable, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { colors, spacing, fontSize, fontWeight, fontFamily, radius } from '@maintenance-log/ui-tokens';
import { RevlogMark } from '@/application/components/RevlogMark';
import { useVerifyEmailViewModel } from './useVerifyEmailViewModel';

export function VerifyEmailScreen() {
  const vm = useVerifyEmailViewModel();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.hero}>
        <RevlogMark size={44} />
        <Text style={styles.title} testID="verify-email-title">
          Check your inbox
        </Text>
        <Text style={styles.body}>
          {vm.email
            ? `We sent a 6-digit code to ${vm.email}. Enter it below — it expires in 10 minutes.`
            : 'We sent you a 6-digit verification code. Enter it below — it expires in 10 minutes.'}
        </Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={[styles.codeInput, vm.error ? styles.codeInputError : null]}
          value={vm.code}
          onChangeText={vm.onChangeCode}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={6}
          placeholder="000000"
          placeholderTextColor={colors.neutral[400]}
          testID="verify-email-code-input"
        />

        {vm.error && (
          <Text style={styles.error} accessibilityRole="alert" testID="verify-email-error">
            {vm.error}
          </Text>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            !vm.canSubmit && styles.primaryButtonDisabled,
            pressed && vm.canSubmit && styles.primaryButtonActive,
          ]}
          onPress={vm.submit}
          disabled={!vm.canSubmit}
          testID="verify-email-submit"
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonLabel}>
            {vm.isSubmitting ? 'Verifying…' : 'Verify email'}
          </Text>
        </Pressable>

        {vm.resendState === 'sent' ? (
          <Text style={styles.resendSent} testID="verify-email-resend-sent">
            A new code is on its way.
          </Text>
        ) : (
          <Pressable
            style={styles.resendRow}
            onPress={vm.onResend}
            disabled={vm.resendState === 'sending'}
            testID="verify-email-resend"
            accessibilityRole="button"
          >
            <Text style={styles.resendLabel}>
              {vm.resendState === 'sending' ? 'Sending…' : "Didn't get it? Resend code"}
            </Text>
          </Pressable>
        )}
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
  codeInputError: {
    borderColor: colors.danger[500],
  },
  error: {
    marginTop: spacing[3],
    fontSize: fontSize.sm,
    color: colors.danger[500],
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: colors.teal[500],
    borderRadius: radius.md,
    paddingVertical: spacing[4],
    alignItems: 'center',
    marginTop: spacing[6],
  },
  primaryButtonActive: {
    backgroundColor: colors.teal[600],
  },
  primaryButtonDisabled: {
    backgroundColor: colors.neutral[600],
  },
  primaryButtonLabel: {
    color: colors.neutral[900],
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  resendRow: {
    alignItems: 'center',
    marginTop: spacing[5],
    paddingVertical: spacing[2],
  },
  resendLabel: {
    fontSize: fontSize.sm,
    color: colors.teal[400],
    fontWeight: fontWeight.medium,
  },
  resendSent: {
    marginTop: spacing[5],
    textAlign: 'center',
    fontSize: fontSize.sm,
    color: colors.success[500],
    fontWeight: fontWeight.medium,
  },
});
