import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import type { VehicleSummary } from '@maintenance-log/api-client';
import { colors, spacing, fontSize, fontWeight, fontFamily, radius } from '@maintenance-log/ui-tokens';
import { RevlogMark } from '@/application/components/RevlogMark';
import { OfflineIndicator } from '@/application/components/OfflineIndicator';
import { useGarageViewModel } from './useGarageViewModel';

// Motorcycle glyph — see revlog-mobile-garage.html. `dashed` renders the
// empty-state's outline treatment; solid otherwise (a card's photo
// placeholder when the Vehicle has no photoUrl).
function VehicleGlyph({ dashed = false, size = 40 }: { dashed?: boolean; size?: number }) {
  const color = dashed ? colors.neutral[300] : colors.teal[500];
  const dashArray = dashed ? '3 3' : undefined;
  return (
    <Svg width={size} height={size * 0.6} viewBox="0 0 80 48" fill="none" aria-hidden>
      <Circle cx={16} cy={36} r={9} stroke={color} strokeWidth={2} strokeDasharray={dashArray} />
      <Circle cx={62} cy={36} r={9} stroke={color} strokeWidth={2} strokeDasharray={dashArray} />
      <Path
        d="M16 36 L30 19 L46 19 L62 36"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashArray}
      />
      <Path d="M30 19 L37 36" stroke={color} strokeWidth={2} strokeLinecap="round" strokeDasharray={dashArray} />
      <Path
        d="M46 19 L41 11 L52 11"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashArray}
      />
      <Path d="M21 13 L33 13" stroke={color} strokeWidth={2} strokeLinecap="round" strokeDasharray={dashArray} />
    </Svg>
  );
}

function VehicleCard({ vehicle, onPress }: { vehicle: VehicleSummary; onPress: () => void }) {
  const name = vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`;
  // No last-logged-at date — GET /vehicles doesn't return one (see
  // garage.md's Decisions).
  const meta = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const isEmpty = vehicle.logEntryCount === 0;
  const badgeLabel = `${vehicle.logEntryCount} ${vehicle.logEntryCount === 1 ? 'entry' : 'entries'}`;

  return (
    <Pressable style={styles.card} onPress={onPress} testID={`garage-vehicle-card-${vehicle.id}`}>
      <View style={styles.cardPhoto}>
        {vehicle.photoUrl ? (
          <Image source={{ uri: vehicle.photoUrl }} style={styles.cardPhotoImage} resizeMode="cover" />
        ) : (
          <VehicleGlyph />
        )}
      </View>
      <View style={styles.cardInfo}>
        <View style={styles.cardText}>
          <Text style={styles.cardName}>{name}</Text>
          <Text style={styles.cardMeta}>{meta}</Text>
        </View>
        <View style={[styles.badge, isEmpty && styles.badgeEmpty]}>
          <Text style={[styles.badgeLabel, isEmpty && styles.badgeLabelEmpty]}>{badgeLabel}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function EmptyState({ onAddVehicle }: { onAddVehicle: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIllustration}>
        <View style={styles.emptyBay}>
          <VehicleGlyph dashed size={56} />
        </View>
        <View style={styles.emptyPlus}>
          <Text style={styles.emptyPlusLabel}>+</Text>
        </View>
      </View>
      <Text style={styles.emptyTitle} testID="garage-empty-title">
        Your garage is empty
      </Text>
      <Text style={styles.emptyBody}>Add your first vehicle to start tracking its service history.</Text>
      <Pressable style={styles.emptyButton} onPress={onAddVehicle} testID="garage-empty-cta">
        <Text style={styles.emptyButtonLabel}>Add your first vehicle</Text>
      </Pressable>
    </View>
  );
}

export function GarageScreen() {
  const { vehicles, isLoading, isOffline, pendingCount, isRefreshing, onRefresh, onAddVehicle, onSelectVehicle } =
    useGarageViewModel();

  const sectionTitle = `My Garage · ${vehicles.length} ${vehicles.length === 1 ? 'vehicle' : 'vehicles'}`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.logoGroup}>
          <RevlogMark size={22} />
          <View style={styles.wordmark}>
            <Text style={styles.wordmarkRev}>Rev</Text>
            <Text style={styles.wordmarkLog}>log</Text>
          </View>
        </View>
        {isOffline ? <OfflineIndicator /> : null}
      </View>

      {isOffline ? (
        <View style={styles.offlineBanner} testID="garage-offline-banner">
          <OfflineIndicator size={13} />
          <Text style={styles.offlineBannerLabel}>
            Working offline
            {pendingCount > 0 ? ` · ${pendingCount} ${pendingCount === 1 ? 'change' : 'changes'} pending sync` : ''}
          </Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.loading} testID="garage-loading">
          <ActivityIndicator color={colors.teal[500]} />
        </View>
      ) : vehicles.length === 0 ? (
        <EmptyState onAddVehicle={onAddVehicle} />
      ) : (
        <View style={styles.content}>
          <FlatList
            data={vehicles}
            keyExtractor={(vehicle) => vehicle.id}
            renderItem={({ item }) => <VehicleCard vehicle={item} onPress={() => onSelectVehicle(item.id)} />}
            ListHeaderComponent={<Text style={styles.sectionTitle}>{sectionTitle}</Text>}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.teal[500]} />
            }
          />
          <Pressable style={styles.fab} onPress={onAddVehicle} testID="garage-add-fab">
            <Text style={styles.fabLabel}>+</Text>
          </Pressable>
        </View>
      )}
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
  logoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  // Two sibling Texts, not nested spans — Android font-measurement bug with
  // mixed custom-font spans in one Text tree (see ADR 0032).
  wordmark: {
    flexDirection: 'row',
  },
  wordmarkRev: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: colors.neutral[50],
  },
  wordmarkLog: {
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize.lg,
    color: colors.teal[500],
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[5],
    backgroundColor: colors.neutral[700],
    borderBottomWidth: 1,
    borderBottomColor: colors.warning[600],
  },
  offlineBannerLabel: {
    fontSize: fontSize.xs,
    color: colors.neutral[200],
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing[20],
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.neutral[300],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[3],
  },
  card: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[3],
    backgroundColor: colors.neutral[700],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[500],
    overflow: 'hidden',
  },
  cardPhoto: {
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[600],
  },
  cardPhotoImage: {
    width: '100%',
    height: '100%',
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  cardText: {
    flexShrink: 1,
  },
  cardName: {
    fontFamily: fontFamily.displaySemibold,
    fontSize: fontSize.base,
    color: colors.neutral[50],
  },
  cardMeta: {
    marginTop: 2,
    fontSize: fontSize.xs,
    color: colors.neutral[300],
  },
  badge: {
    backgroundColor: colors.neutral[600],
    borderWidth: 1,
    borderColor: colors.teal[500],
    borderRadius: radius.sm,
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2],
  },
  badgeEmpty: {
    backgroundColor: 'transparent',
    borderColor: colors.neutral[400],
  },
  badgeLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.teal[300],
  },
  badgeLabelEmpty: {
    color: colors.neutral[300],
  },
  fab: {
    position: 'absolute',
    right: spacing[6],
    bottom: spacing[6],
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.teal[500],
  },
  fabLabel: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.normal,
    color: colors.neutral[900],
    marginTop: -2,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[10],
  },
  emptyIllustration: {
    marginBottom: spacing[6],
  },
  emptyBay: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPlus: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.teal[500],
  },
  emptyPlusLabel: {
    fontSize: fontSize.base,
    color: colors.neutral[900],
    marginTop: -1,
  },
  emptyTitle: {
    fontFamily: fontFamily.displaySemibold,
    fontSize: fontSize.lg,
    color: colors.neutral[50],
    marginBottom: spacing[2],
  },
  emptyBody: {
    fontSize: fontSize.sm,
    color: colors.neutral[200],
    textAlign: 'center',
    lineHeight: fontSize.sm * 1.6,
    marginBottom: spacing[6],
  },
  emptyButton: {
    backgroundColor: colors.teal[500],
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
  },
  emptyButtonLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.neutral[900],
  },
});
