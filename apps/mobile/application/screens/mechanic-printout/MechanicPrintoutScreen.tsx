import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, spacing, fontSize, fontWeight, fontFamily, radius } from '@maintenance-log/ui-tokens';
import { useMechanicPrintoutViewModel } from './useMechanicPrintoutViewModel';

function ChevronLeftIcon() {
  return (
    <Svg width={8} height={14} viewBox="0 0 8 14" fill="none" aria-hidden>
      <Path d="M7 1L1 7l6 6" stroke={colors.teal[500]} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function LinkIcon() {
  return (
    <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" aria-hidden>
      <Path
        d="M10 13a5 5 0 007.5.5l3-3A5 5 0 0013.5 3.5L12 5"
        stroke={colors.teal[500]}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14 11a5 5 0 00-7.5-.5l-3 3A5 5 0 0010.5 20.5L12 19"
        stroke={colors.teal[500]}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ShareIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" aria-hidden>
      <Path
        d="M12 3v12M12 3L8 7M12 3l4 4"
        stroke={colors.neutral[900]}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5 12v7a1 1 0 001 1h12a1 1 0 001-1v-7"
        stroke={colors.neutral[900]}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function RevokeIcon() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" aria-hidden>
      <Rect x={3.5} y={3.5} width={17} height={17} rx={8.5} stroke={colors.danger[500]} strokeWidth={1.6} />
      <Path d="M8 8l8 8" stroke={colors.danger[500]} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function MechanicPrintoutScreen() {
  const vm = useMechanicPrintoutViewModel();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backLink} onPress={vm.onBack} testID="mechanic-printout-back-btn">
          <ChevronLeftIcon />
          <Text style={styles.backLabel} numberOfLines={1}>
            {vm.vehicleDisplayName}
          </Text>
        </Pressable>
        <Text style={styles.headerTitle}>Share Report</Text>
        <View style={styles.headerSpacer} />
      </View>

      {vm.state === 'loading' && (
        <View style={styles.centered} testID="mechanic-printout-loading">
          <ActivityIndicator color={colors.teal[500]} />
        </View>
      )}

      {vm.state === 'error' && (
        <View style={styles.centered} testID="mechanic-printout-error">
          <Text style={styles.errorTitle}>Couldn&apos;t load the share link</Text>
          <Text style={styles.errorBody}>Check your connection and try again.</Text>
          <Pressable style={styles.secondaryBtn} onPress={vm.retry} testID="mechanic-printout-retry-btn">
            <Text style={styles.secondaryBtnLabel}>Try again</Text>
          </Pressable>
        </View>
      )}

      {vm.state === 'no-token' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.introIcon}>
            <LinkIcon />
          </View>
          <Text style={styles.introTitle}>Share service history</Text>
          <Text style={styles.introBody}>
            Generate a link to share {vm.vehicleDisplayName || 'this vehicle'}&apos;s complete service history with a
            mechanic or buyer. No account needed to view it.
          </Text>

          {vm.actionError && (
            <Text style={styles.actionError} accessibilityRole="alert" testID="mechanic-printout-generate-error">
              {vm.actionError}
            </Text>
          )}

          <Pressable
            style={[styles.primaryBtn, vm.isGenerating && styles.btnDisabled]}
            onPress={vm.generate}
            disabled={vm.isGenerating}
            testID="mechanic-printout-generate-btn"
          >
            <Text style={styles.primaryBtnLabel}>{vm.isGenerating ? 'Generating…' : 'Generate link'}</Text>
          </Pressable>
        </ScrollView>
      )}

      {vm.state === 'has-token' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.introIcon}>
            <LinkIcon />
          </View>
          <Text style={styles.introTitle}>Link ready</Text>
          <Text style={styles.introBody}>
            Anyone with this link can view {vm.vehicleDisplayName || 'this vehicle'}&apos;s service history.
          </Text>

          <View style={styles.urlCard}>
            <Text style={styles.urlText} testID="mechanic-printout-url">
              {vm.shareUrl}
            </Text>
          </View>

          <Pressable style={styles.primaryBtn} onPress={vm.share} testID="mechanic-printout-share-btn">
            <ShareIcon />
            <Text style={styles.primaryBtnLabel}>Share report</Text>
          </Pressable>

          <Pressable style={styles.revokeBtn} onPress={vm.openRevokeDialog} testID="mechanic-printout-revoke-btn">
            <Text style={styles.revokeBtnLabel}>Revoke link</Text>
          </Pressable>
        </ScrollView>
      )}

      <Modal
        transparent
        animationType="fade"
        visible={vm.revokeDialogOpen}
        onRequestClose={vm.closeRevokeDialog}
        testID="mechanic-printout-revoke-dialog"
      >
        <View style={styles.dialogWrapper}>
          <Pressable
            style={styles.dialogBackdrop}
            onPress={vm.closeRevokeDialog}
            testID="mechanic-printout-revoke-dialog-backdrop"
          />
          <View style={styles.dialogBox}>
            <View style={styles.dialogIcon}>
              <RevokeIcon />
            </View>
            <Text style={styles.dialogTitle} testID="mechanic-printout-revoke-dialog-title">
              Revoke this link?
            </Text>
            <Text style={styles.dialogBody}>
              Anyone with the current link will no longer be able to view the report.
            </Text>
            {vm.actionError && (
              <Text style={styles.dialogError} accessibilityRole="alert" testID="mechanic-printout-revoke-error">
                {vm.actionError}
              </Text>
            )}
            <View style={styles.dialogActions}>
              <Pressable
                style={styles.dialogBtnCancel}
                onPress={vm.closeRevokeDialog}
                disabled={vm.isRevoking}
                testID="mechanic-printout-revoke-dismiss-btn"
              >
                <Text style={styles.dialogBtnCancelLabel}>Keep link</Text>
              </Pressable>
              <Pressable
                style={styles.dialogBtnConfirm}
                onPress={vm.confirmRevoke}
                disabled={vm.isRevoking}
                testID="mechanic-printout-revoke-confirm-btn"
              >
                <Text style={styles.dialogBtnConfirmLabel}>{vm.isRevoking ? 'Revoking…' : 'Revoke link'}</Text>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    padding: spacing[6],
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
    paddingTop: spacing[8],
    paddingBottom: spacing[10],
  },
  introIcon: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[400],
    backgroundColor: colors.neutral[600],
    marginBottom: spacing[5],
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
    lineHeight: fontSize.sm * 1.6,
    marginBottom: spacing[6],
    paddingHorizontal: spacing[2],
  },
  urlCard: {
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.neutral[400],
    borderRadius: radius.md,
    backgroundColor: colors.neutral[600],
    marginBottom: spacing[5],
  },
  urlText: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    color: colors.teal[300],
  },
  actionError: {
    marginBottom: spacing[3],
    fontSize: fontSize.sm,
    color: colors.danger[500],
    textAlign: 'center',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[4],
    borderRadius: radius.md,
    backgroundColor: colors.teal[500],
    marginBottom: spacing[3],
  },
  primaryBtnLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.neutral[900],
  },
  btnDisabled: {
    opacity: 0.6,
  },
  revokeBtn: {
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger[500],
  },
  revokeBtnLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.danger[500],
  },
  secondaryBtn: {
    marginTop: spacing[2],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral[400],
  },
  secondaryBtnLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.neutral[50],
  },
  errorTitle: {
    fontFamily: fontFamily.displaySemibold,
    fontSize: fontSize.lg,
    color: colors.neutral[50],
    textAlign: 'center',
  },
  errorBody: {
    fontSize: fontSize.sm,
    color: colors.neutral[200],
    textAlign: 'center',
  },
  dialogWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
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
    alignItems: 'center',
    padding: spacing[6],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[500],
    backgroundColor: colors.neutral[700],
  },
  dialogIcon: {
    marginBottom: spacing[3],
  },
  dialogTitle: {
    fontFamily: fontFamily.displaySemibold,
    fontSize: fontSize.lg,
    color: colors.neutral[50],
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  dialogBody: {
    fontSize: fontSize.sm,
    color: colors.neutral[200],
    textAlign: 'center',
    lineHeight: fontSize.sm * 1.5,
  },
  dialogError: {
    marginTop: spacing[3],
    fontSize: fontSize.sm,
    color: colors.danger[500],
    textAlign: 'center',
  },
  dialogActions: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[6],
  },
  dialogBtnCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral[400],
  },
  dialogBtnCancelLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.neutral[50],
  },
  dialogBtnConfirm: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    backgroundColor: colors.danger[500],
  },
  dialogBtnConfirmLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.neutral[900],
  },
});
