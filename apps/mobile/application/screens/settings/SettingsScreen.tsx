import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors, spacing, fontSize, fontWeight, fontFamily, radius } from '@maintenance-log/ui-tokens';
import { useSettingsViewModel } from './useSettingsViewModel';

function BackChevron() {
  return (
    <Svg width={8} height={14} viewBox="0 0 8 14" fill="none" aria-hidden>
      <Path d="M7 1L1 7l6 6" stroke={colors.teal[400]} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function RowChevron() {
  return (
    <Svg width={7} height={12} viewBox="0 0 7 12" fill="none" aria-hidden>
      <Path d="M1 1l5 5-5 5" stroke={colors.neutral[400]} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function DisplayRow({ value, label, testID }: { value: string; label: string; testID?: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowValue} testID={testID}>
          {value}
        </Text>
        <Text style={styles.rowSublabel}>{label}</Text>
      </View>
    </View>
  );
}

function LinkRow({ label, onPress, testID }: { label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable style={styles.row} onPress={onPress} testID={testID}>
      <Text style={styles.rowLabel}>{label}</Text>
      <RowChevron />
    </Pressable>
  );
}

function ValueRow({ label, value, onPress, testID }: { label: string; value: string; onPress: () => void; testID: string }) {
  return (
    <Pressable style={styles.row} onPress={onPress} testID={testID}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        <Text style={styles.rowTrailing} testID={`${testID}-value`}>
          {value}
        </Text>
        <RowChevron />
      </View>
    </Pressable>
  );
}

function CheckIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 20 20" fill="none" aria-hidden>
      <Path d="M4 10.5l4 4 8-9" stroke={colors.teal[400]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SettingsScreen() {
  const vm = useSettingsViewModel();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={vm.onBack} testID="settings-back" accessibilityRole="button" hitSlop={8}>
          <BackChevron />
          <Text style={styles.backLabel}>Garage</Text>
        </Pressable>
        <Text style={styles.title} testID="settings-title">
          Settings
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <SectionLabel>Account</SectionLabel>
        <View style={styles.listGroup}>
          <DisplayRow value={vm.profile?.fullName ?? '—'} label="Display name" testID="settings-account-name" />
          <DisplayRow value={vm.profile?.email ?? '—'} label="Email" testID="settings-account-email" />
        </View>

        <SectionLabel>Preferences</SectionLabel>
        <View style={styles.listGroup}>
          <ValueRow
            label="Language"
            value={vm.localeLabel}
            onPress={vm.openLanguageDialog}
            testID="settings-language"
          />
          {vm.biometricAvailable && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Unlock with biometrics</Text>
              <Switch
                value={vm.biometricEnabled}
                onValueChange={vm.onToggleBiometric}
                testID="settings-biometric-toggle"
                trackColor={{ false: colors.neutral[500], true: colors.teal[500] }}
                thumbColor={colors.neutral[50]}
                ios_backgroundColor={colors.neutral[500]}
              />
            </View>
          )}
        </View>

        <SectionLabel>Legal</SectionLabel>
        <View style={styles.listGroup}>
          <LinkRow label="Terms of Service" onPress={vm.onOpenTerms} testID="settings-legal-terms" />
          <LinkRow label="Privacy Policy" onPress={vm.onOpenPrivacy} testID="settings-legal-privacy" />
          <LinkRow label="Cookie Policy" onPress={vm.onOpenCookies} testID="settings-legal-cookies" />
        </View>

        <SectionLabel>Support</SectionLabel>
        <View style={styles.listGroup}>
          <LinkRow label="revlog.dev" onPress={vm.onOpenSupport} testID="settings-support" />
        </View>

        <Pressable
          style={styles.logoutButton}
          onPress={vm.openLogoutDialog}
          testID="settings-logout"
          accessibilityRole="button"
        >
          <Text style={styles.logoutLabel}>Log out</Text>
        </Pressable>
      </ScrollView>

      <Modal
        transparent
        animationType="fade"
        visible={vm.languageDialogOpen}
        onRequestClose={vm.closeLanguageDialog}
        testID="settings-language-dialog"
      >
        <View style={styles.dialogWrapper}>
          <Pressable
            style={styles.dialogBackdrop}
            onPress={vm.closeLanguageDialog}
            testID="settings-language-dialog-backdrop"
          />
          <View style={styles.dialogBox}>
            <Text style={styles.dialogTitle}>Language</Text>
            {vm.supportedLocales.map((option) => {
              const selected = option.code === vm.locale;
              return (
                <Pressable
                  key={option.code}
                  style={styles.languageOption}
                  onPress={() => vm.onSelectLanguage(option.code)}
                  testID={`settings-language-option-${option.code}`}
                >
                  <Text style={selected ? styles.languageOptionLabelSelected : styles.languageOptionLabel}>
                    {option.label}
                  </Text>
                  {selected ? <CheckIcon /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={vm.logoutDialogOpen}
        onRequestClose={vm.closeLogoutDialog}
        testID="settings-logout-dialog"
      >
        <View style={styles.dialogWrapper}>
          <Pressable style={styles.dialogBackdrop} onPress={vm.closeLogoutDialog} testID="settings-logout-dialog-backdrop" />
          <View style={styles.dialogBox}>
            <Text style={styles.dialogTitle} testID="settings-logout-dialog-title">
              Log out of Revlog?
            </Text>
            <Text style={styles.dialogBody}>You&apos;ll need to sign in again to see your garage.</Text>
            {vm.logoutError && (
              <Text style={styles.dialogError} accessibilityRole="alert" testID="settings-logout-error">
                {vm.logoutError}
              </Text>
            )}
            <View style={styles.dialogActions}>
              <Pressable
                style={styles.dialogBtnCancel}
                onPress={vm.closeLogoutDialog}
                disabled={vm.isLoggingOut}
                testID="settings-logout-dialog-cancel"
              >
                <Text style={styles.dialogBtnCancelLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.dialogBtnConfirmDanger}
                onPress={vm.confirmLogout}
                disabled={vm.isLoggingOut}
                testID="settings-logout-dialog-confirm"
              >
                <Text style={styles.dialogBtnConfirmLabel}>{vm.isLoggingOut ? 'Logging out…' : 'Log out'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[800],
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
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    minWidth: 80,
  },
  backLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.teal[400],
  },
  title: {
    fontFamily: fontFamily.displaySemibold,
    fontSize: fontSize.base,
    color: colors.neutral[50],
  },
  headerSpacer: {
    minWidth: 80,
  },
  content: {
    paddingVertical: spacing[5],
    paddingBottom: spacing[20],
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.neutral[300],
    paddingHorizontal: spacing[5],
    marginTop: spacing[5],
    marginBottom: spacing[2],
  },
  listGroup: {
    backgroundColor: colors.neutral[700],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.neutral[500],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[600],
  },
  rowLeft: {
    flexShrink: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: fontSize.base,
    color: colors.neutral[50],
  },
  rowValue: {
    fontSize: fontSize.base,
    color: colors.neutral[50],
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  rowTrailing: {
    fontSize: fontSize.sm,
    color: colors.neutral[300],
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[600],
  },
  languageOptionLabel: {
    fontSize: fontSize.base,
    color: colors.neutral[100],
  },
  languageOptionLabelSelected: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.neutral[50],
  },
  rowSublabel: {
    fontSize: fontSize.xs,
    color: colors.neutral[300],
  },
  logoutButton: {
    marginTop: spacing[8],
    marginHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.danger[500],
    backgroundColor: colors.neutral[700],
    alignItems: 'center',
  },
  logoutLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.danger[500],
  },
  dialogWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  dialogBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.neutral[900],
    opacity: 0.7,
  },
  dialogBox: {
    width: '100%',
    backgroundColor: colors.neutral[700],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[500],
    padding: spacing[5],
  },
  dialogTitle: {
    fontFamily: fontFamily.displaySemibold,
    fontSize: fontSize.lg,
    color: colors.neutral[50],
    marginBottom: spacing[2],
  },
  dialogBody: {
    fontSize: fontSize.sm,
    color: colors.neutral[200],
    lineHeight: fontSize.sm * 1.5,
  },
  dialogError: {
    marginTop: spacing[3],
    fontSize: fontSize.sm,
    color: colors.danger[500],
  },
  dialogActions: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[5],
  },
  dialogBtnCancel: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral[500],
    alignItems: 'center',
  },
  dialogBtnCancelLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.neutral[100],
  },
  dialogBtnConfirmDanger: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    backgroundColor: colors.danger[500],
    alignItems: 'center',
  },
  dialogBtnConfirmLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.neutral[900],
  },
});
