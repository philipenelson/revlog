import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { LogEntrySummary } from '@maintenance-log/api-client';
import { colors, spacing, fontSize, fontWeight, fontFamily, radius } from '@maintenance-log/ui-tokens';
import { VehicleGlyph } from '@/application/components/VehicleGlyph';
import { formatShortDate } from '@/utils/format';
import { useVehicleDetailViewModel } from './useVehicleDetailViewModel';

// Log entry type ids come from the LogEntryType lookup table (ADR 0018);
// labels only — the mobile design has no per-type icon, unlike web's emoji
// badges (revlog-mobile-vehicle-detail.html's .entry-type is text-only).
const TYPE_LABELS: Record<string, string> = {
  MAINTENANCE: 'Maintenance',
  REPAIR: 'Repair',
  INSPECTION: 'Inspection',
  MODIFICATION: 'Modification',
  INCIDENT: 'Incident',
  EVENT: 'Event',
  OTHER: 'Other',
};

function ChevronLeftIcon() {
  return (
    <Svg width={8} height={14} viewBox="0 0 8 14" fill="none" aria-hidden>
      <Path
        d="M7 1L1 7l6 6"
        stroke={colors.teal[500]}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function EditIcon({ disabled }: { disabled: boolean }) {
  const color = disabled ? colors.neutral[400] : colors.neutral[200];
  return (
    <Svg width={15} height={15} viewBox="0 0 20 20" fill="none" aria-hidden>
      <Path
        d="M13.5 3.5l3 3L7 16l-4 1 1-4 9.5-9.5z"
        stroke={color}
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function ShareIcon({ disabled }: { disabled: boolean }) {
  const color = disabled ? colors.neutral[400] : colors.neutral[200];
  return (
    <Svg width={16} height={16} viewBox="0 0 20 20" fill="none" aria-hidden>
      <Path
        d="M10 2v10M6.5 5.5L10 2l3.5 3.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M4 9v6.5A1.5 1.5 0 005.5 17h9a1.5 1.5 0 001.5-1.5V9"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function LockIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 20 20" fill="none" aria-hidden>
      <Rect x={4.5} y={9} width={11} height={8} rx={1.5} stroke={colors.warning[500]} strokeWidth={1.5} />
      <Path d="M6.5 9V6.5a3.5 3.5 0 017 0V9" stroke={colors.warning[500]} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function MoreIcon({ disabled }: { disabled: boolean }) {
  const color = disabled ? colors.neutral[400] : colors.neutral[200];
  return (
    <Svg width={16} height={16} viewBox="0 0 20 20" fill="none" aria-hidden>
      <Circle cx={10} cy={4} r={1.6} fill={color} />
      <Circle cx={10} cy={10} r={1.6} fill={color} />
      <Circle cx={10} cy={16} r={1.6} fill={color} />
    </Svg>
  );
}

function TransferIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" aria-hidden>
      <Path
        d="M4 12a8 8 0 0114-5.3M20 4v5h-5"
        stroke={colors.neutral[200]}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M20 12a8 8 0 01-14 5.3M4 20v-5h5"
        stroke={colors.neutral[200]}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TrashIcon({ size = 13 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
      <Path
        d="M2 4h10M5 4V2.5h4V4M5.5 6.5v4M8.5 6.5v4M3 4l.7 7.5A1 1 0 004.7 13h4.6a1 1 0 001-.95L11 4"
        stroke={colors.danger[500]}
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function LogEntryCard({ entry, onPress }: { entry: LogEntrySummary; onPress: () => void }) {
  const typeLabel = TYPE_LABELS[entry.typeId] ?? entry.typeId;
  return (
    <Pressable style={styles.entryCard} onPress={onPress} testID={`log-entry-card-${entry.id}`}>
      <View style={styles.entryCardLeft}>
        <Text style={styles.entryType}>{typeLabel}</Text>
        <Text style={styles.entryTitle} testID={`log-entry-title-${entry.id}`}>
          {entry.title}
        </Text>
        <Text style={styles.entryMeta}>{formatShortDate(entry.date)}</Text>
      </View>
      {entry.mileage != null && <Text style={styles.entryMileage}>{entry.mileage.toLocaleString()} mi</Text>}
    </Pressable>
  );
}

function EmptyHistory({ onAddLogEntry }: { onAddLogEntry: () => void }) {
  return (
    <View style={styles.emptyHistory} testID="vehicle-detail-empty-history">
      <Text style={styles.emptyHistoryTitle}>No log entries yet</Text>
      <Text style={styles.emptyHistoryBody}>
        Start tracking every service, repair, and modification to build a complete history.
      </Text>
      <Pressable style={styles.emptyHistoryButton} onPress={onAddLogEntry} testID="vehicle-detail-empty-history-cta">
        <Text style={styles.emptyHistoryButtonLabel}>+ Add your first log entry</Text>
      </Pressable>
    </View>
  );
}

export function VehicleDetailScreen() {
  const vm = useVehicleDetailViewModel();

  if (vm.loadState === 'loading') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered} testID="vehicle-detail-loading">
          <ActivityIndicator color={colors.teal[500]} />
        </View>
      </SafeAreaView>
    );
  }

  if (vm.loadState === 'not-found' || !vm.vehicle) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered} testID="vehicle-detail-not-found">
          <Text style={styles.notFoundTitle}>Vehicle not found</Text>
          <Pressable onPress={vm.onBack} testID="vehicle-detail-not-found-back">
            <Text style={styles.notFoundLink}>Back to Garage</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { vehicle } = vm;
  const locked = vehicle.transferPending;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backLink} onPress={vm.onBack} testID="vehicle-detail-back">
          <ChevronLeftIcon />
          <Text style={styles.backLabel}>Garage</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {vm.displayName}
        </Text>
        <View style={styles.headerIcons}>
          <Pressable
            onPress={vm.onShareReport}
            disabled={locked}
            hitSlop={8}
            testID="vehicle-detail-share-btn"
          >
            <ShareIcon disabled={locked} />
          </Pressable>
          <Pressable onPress={vm.onEdit} disabled={locked} hitSlop={8} testID="vehicle-detail-edit-btn">
            <EditIcon disabled={locked} />
          </Pressable>
          <Pressable onPress={vm.openMenu} disabled={locked} hitSlop={8} testID="vehicle-detail-menu-btn">
            <MoreIcon disabled={locked} />
          </Pressable>
        </View>
      </View>

      <Modal transparent animationType="fade" visible={vm.menuOpen} onRequestClose={vm.closeMenu}>
        <Pressable style={styles.menuBackdrop} onPress={vm.closeMenu} testID="vehicle-detail-menu-backdrop">
          <View style={styles.menuBox} testID="vehicle-detail-menu">
            <Pressable style={styles.menuItem} onPress={vm.onTransfer} testID="vehicle-detail-menu-transfer">
              <TransferIcon />
              <Text style={styles.menuItemLabel}>Transfer vehicle</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable style={styles.menuItem} onPress={vm.openDeleteDialog} testID="vehicle-detail-menu-delete">
              <TrashIcon />
              <Text style={styles.menuItemLabelDanger}>Delete vehicle</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <FlatList
        data={vm.logEntries}
        keyExtractor={(entry) => entry.id}
        renderItem={({ item }) => <LogEntryCard entry={item} onPress={() => vm.onSelectLogEntry(item.id)} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={vm.isRefreshing} onRefresh={vm.onRefresh} tintColor={colors.teal[500]} />
        }
        ListHeaderComponent={
          <>
            <View style={styles.hero} testID="vehicle-detail-hero">
              {vehicle.photoUrl ? (
                <Image source={{ uri: vehicle.photoUrl }} style={styles.heroPhoto} resizeMode="cover" />
              ) : (
                <VehicleGlyph size={72} />
              )}
            </View>
            <View style={styles.heading}>
              <Text style={styles.vehicleName} testID="vehicle-detail-name">
                {vm.displayName}
              </Text>
              <Text style={styles.vehicleSub} testID="vehicle-detail-sub">
                {vm.subMeta}
              </Text>
            </View>

            {locked ? (
              <View style={styles.lockBanner} testID="vehicle-detail-transfer-banner">
                <LockIcon />
                <View style={styles.lockTextGroup}>
                  <Text style={styles.lockTitle}>Transfer pending</Text>
                  <Text style={styles.lockBody} testID="vehicle-detail-transfer-banner-body">
                    Awaiting {vehicle.pendingTransferRecipientEmail ?? "the recipient"}&apos;s response. Vehicle is
                    locked until the transfer is accepted, declined, or cancelled.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.statsRow} testID="vehicle-detail-stats">
                <View style={styles.statCell}>
                  <Text style={styles.statValue} testID="vehicle-detail-stat-entries">
                    {vm.entryCountLabel}
                  </Text>
                  <Text style={styles.statLabel}>Entries</Text>
                </View>
                <View style={styles.statCell}>
                  <Text style={styles.statValue} testID="vehicle-detail-stat-last-logged">
                    {vm.lastLoggedLabel}
                  </Text>
                  <Text style={styles.statLabel}>Last logged</Text>
                </View>
                <View style={styles.statCell}>
                  <Text style={styles.statValue} testID="vehicle-detail-stat-total-spent">
                    {vm.totalSpentLabel}
                  </Text>
                  <Text style={styles.statLabel}>Total spent</Text>
                </View>
              </View>
            )}

            <View style={styles.actionRow}>
              <Pressable
                style={[styles.actionBtnPrimary, locked && styles.actionBtnDisabled]}
                onPress={vm.onAddLogEntry}
                disabled={locked}
                testID="vehicle-detail-add-log-entry-btn"
              >
                <Text style={[styles.actionBtnPrimaryLabel, locked && styles.actionBtnDisabledLabel]}>
                  + Log entry
                </Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtnSecondary, locked && styles.actionBtnDisabled]}
                onPress={vm.onShareReport}
                disabled={locked}
                testID="vehicle-detail-share-report-btn"
              >
                <Text style={[styles.actionBtnSecondaryLabel, locked && styles.actionBtnDisabledLabel]}>
                  Share report
                </Text>
              </Pressable>
            </View>

            {locked && (
              <Pressable
                style={styles.cancelTransferBtn}
                onPress={vm.openCancelTransferDialog}
                testID="vehicle-detail-cancel-transfer-btn"
              >
                <Text style={styles.cancelTransferBtnLabel}>Cancel transfer</Text>
              </Pressable>
            )}

            <Text style={styles.sectionTitle}>Service History</Text>
          </>
        }
        ListEmptyComponent={<EmptyHistory onAddLogEntry={vm.onAddLogEntry} />}
      />

      <Modal
        transparent
        animationType="fade"
        visible={vm.deleteDialogOpen}
        onRequestClose={vm.closeDeleteDialog}
        testID="vehicle-detail-delete-dialog"
      >
        <View style={styles.dialogWrapper}>
          <Pressable
            style={styles.dialogBackdrop}
            onPress={vm.closeDeleteDialog}
            testID="vehicle-detail-delete-dialog-backdrop"
          />
          <View style={styles.dialogBox}>
            <View style={styles.dialogIconDanger}>
              <TrashIcon size={20} />
            </View>
            <Text style={styles.dialogTitle} testID="vehicle-detail-delete-dialog-title">
              Delete {vm.displayName}?
            </Text>
            <Text style={styles.dialogBody}>
              This will permanently delete the vehicle and all its log entries. This cannot be undone.
            </Text>
            {vm.deleteError && (
              <Text style={styles.dialogError} accessibilityRole="alert" testID="vehicle-detail-delete-error">
                {vm.deleteError}
              </Text>
            )}
            <View style={styles.dialogActions}>
              <Pressable
                style={styles.dialogBtnCancel}
                onPress={vm.closeDeleteDialog}
                disabled={vm.isDeleting}
                testID="vehicle-detail-delete-dialog-cancel-btn"
              >
                <Text style={styles.dialogBtnCancelLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.dialogBtnConfirmDanger}
                onPress={vm.handleDelete}
                disabled={vm.isDeleting}
                testID="vehicle-detail-delete-dialog-confirm-btn"
              >
                <Text style={styles.dialogBtnConfirmLabel}>{vm.isDeleting ? 'Deleting…' : 'Delete'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={vm.cancelTransferDialogOpen}
        onRequestClose={vm.closeCancelTransferDialog}
        testID="vehicle-detail-cancel-transfer-dialog"
      >
        <View style={styles.dialogWrapper}>
          <Pressable
            style={styles.dialogBackdrop}
            onPress={vm.closeCancelTransferDialog}
            testID="vehicle-detail-cancel-transfer-dialog-backdrop"
          />
          <View style={styles.dialogBox}>
            <View style={styles.dialogIcon}>
              <LockIcon />
            </View>
            <Text style={styles.dialogTitle} testID="vehicle-detail-cancel-transfer-dialog-title">
              Cancel this transfer request?
            </Text>
            <Text style={styles.dialogBody}>
              The recipient will be notified and {vm.displayName} will be unlocked immediately.
            </Text>
            {vm.cancelTransferError && (
              <Text
                style={styles.dialogError}
                accessibilityRole="alert"
                testID="vehicle-detail-cancel-transfer-error"
              >
                {vm.cancelTransferError}
              </Text>
            )}
            <View style={styles.dialogActions}>
              <Pressable
                style={styles.dialogBtnCancel}
                onPress={vm.closeCancelTransferDialog}
                disabled={vm.isCancellingTransfer}
                testID="vehicle-detail-cancel-transfer-dialog-dismiss-btn"
              >
                <Text style={styles.dialogBtnCancelLabel}>Keep transfer</Text>
              </Pressable>
              <Pressable
                style={styles.dialogBtnConfirm}
                onPress={vm.handleCancelTransfer}
                disabled={vm.isCancellingTransfer}
                testID="vehicle-detail-cancel-transfer-dialog-confirm-btn"
              >
                <Text style={styles.dialogBtnConfirmLabel}>
                  {vm.isCancellingTransfer ? 'Cancelling…' : 'Cancel transfer'}
                </Text>
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
    gap: spacing[4],
  },
  notFoundTitle: {
    fontFamily: fontFamily.displaySemibold,
    fontSize: fontSize.lg,
    color: colors.neutral[50],
  },
  notFoundLink: {
    fontSize: fontSize.sm,
    color: colors.teal[500],
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
    flexShrink: 0,
  },
  backLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.teal[500],
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing[2],
    fontFamily: fontFamily.displaySemibold,
    fontSize: fontSize.sm,
    color: colors.neutral[50],
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flexShrink: 0,
  },
  listContent: {
    paddingBottom: spacing[20],
  },
  hero: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    // Flat fill, not the design's gradient — no gradient primitive is in
    // use anywhere else in this RN app (GarageScreen's card photo is flat
    // too); adding expo-linear-gradient for one decorative panel isn't
    // worth the new dependency.
    backgroundColor: colors.neutral[700],
  },
  heroPhoto: {
    width: '100%',
    height: '100%',
  },
  heading: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
  },
  vehicleName: {
    fontFamily: fontFamily.displaySemibold,
    fontSize: fontSize.xl,
    color: colors.neutral[50],
  },
  vehicleSub: {
    marginTop: 2,
    fontSize: fontSize.xs,
    color: colors.neutral[300],
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: spacing[5],
    marginTop: spacing[4],
    backgroundColor: colors.neutral[700],
    borderWidth: 1,
    borderColor: colors.neutral[500],
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderRightWidth: 1,
    borderRightColor: colors.neutral[600],
  },
  statValue: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.neutral[50],
  },
  statLabel: {
    marginTop: spacing[1],
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.neutral[300],
  },
  lockBanner: {
    flexDirection: 'row',
    gap: spacing[2],
    alignItems: 'flex-start',
    marginHorizontal: spacing[5],
    marginTop: spacing[4],
    padding: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning[600],
    backgroundColor: colors.neutral[700],
  },
  lockTextGroup: {
    flex: 1,
  },
  lockTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.warning[500],
  },
  lockBody: {
    marginTop: 2,
    fontSize: fontSize.xs,
    color: colors.neutral[200],
    lineHeight: fontSize.xs * 1.5,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginHorizontal: spacing[5],
    marginTop: spacing[4],
  },
  actionBtnPrimary: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    backgroundColor: colors.teal[500],
  },
  actionBtnPrimaryLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.neutral[900],
  },
  actionBtnSecondary: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral[500],
    backgroundColor: colors.neutral[700],
  },
  actionBtnSecondaryLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.neutral[200],
  },
  actionBtnDisabled: {
    borderColor: colors.neutral[600],
    backgroundColor: colors.neutral[700],
  },
  actionBtnDisabledLabel: {
    color: colors.neutral[400],
  },
  sectionTitle: {
    marginTop: spacing[5],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.neutral[300],
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginHorizontal: spacing[5],
    marginBottom: spacing[2],
    padding: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[600],
    backgroundColor: colors.neutral[700],
  },
  entryCardLeft: {
    flexShrink: 1,
  },
  entryType: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.teal[300],
    marginBottom: spacing[1],
  },
  entryTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.neutral[50],
  },
  entryMeta: {
    marginTop: 2,
    fontSize: fontSize.xs,
    color: colors.neutral[300],
  },
  entryMileage: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xs,
    color: colors.neutral[300],
  },
  emptyHistory: {
    alignItems: 'center',
    paddingHorizontal: spacing[8],
    paddingTop: spacing[4],
  },
  emptyHistoryTitle: {
    fontFamily: fontFamily.displaySemibold,
    fontSize: fontSize.base,
    color: colors.neutral[50],
    marginBottom: spacing[2],
  },
  emptyHistoryBody: {
    fontSize: fontSize.sm,
    color: colors.neutral[200],
    textAlign: 'center',
    lineHeight: fontSize.sm * 1.5,
    marginBottom: spacing[5],
  },
  emptyHistoryButton: {
    backgroundColor: colors.teal[500],
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
  },
  emptyHistoryButtonLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.neutral[900],
  },
  menuBackdrop: {
    flex: 1,
    alignItems: 'flex-end',
    paddingTop: 64,
    paddingRight: spacing[5],
  },
  menuBox: {
    width: 200,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[500],
    backgroundColor: colors.neutral[700],
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
  },
  menuItemLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.neutral[200],
  },
  menuItemLabelDanger: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.danger[500],
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.neutral[600],
  },
  cancelTransferBtn: {
    alignItems: 'center',
    marginHorizontal: spacing[5],
    marginTop: spacing[3],
    paddingVertical: spacing[3],
    borderWidth: 1,
    borderColor: colors.danger[500],
    borderRadius: radius.md,
  },
  cancelTransferBtnLabel: {
    fontSize: fontSize.sm,
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
    opacity: 0.8,
  },
  dialogBox: {
    width: '100%',
    padding: spacing[6],
    borderWidth: 1,
    borderColor: colors.neutral[500],
    borderRadius: radius.xl,
    backgroundColor: colors.neutral[700],
  },
  dialogIcon: {
    alignSelf: 'center',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.warning[500],
    borderRadius: radius.md,
    backgroundColor: colors.neutral[600],
    marginBottom: spacing[4],
  },
  dialogIconDanger: {
    alignSelf: 'center',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.danger[500],
    borderRadius: radius.md,
    backgroundColor: colors.neutral[600],
    marginBottom: spacing[4],
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
    lineHeight: fontSize.sm * 1.5,
    textAlign: 'center',
  },
  dialogError: {
    marginTop: spacing[3],
    fontSize: fontSize.xs,
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
    borderWidth: 1,
    borderColor: colors.neutral[400],
    borderRadius: radius.md,
  },
  dialogBtnCancelLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.neutral[200],
  },
  dialogBtnConfirm: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    backgroundColor: colors.teal[500],
  },
  dialogBtnConfirmDanger: {
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
