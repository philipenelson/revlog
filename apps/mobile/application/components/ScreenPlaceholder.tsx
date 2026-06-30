import { Text, View, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, fontWeight } from '@maintenance-log/ui-tokens';

type ScreenPlaceholderProps = {
  title: string;
};

// Temporary view for screens not yet implemented. Each screen's own
// <Screen>.tsx file stays in place so viewmodels/real markup can be filled
// in without touching the route shell — see docs/specs/mobile-app/.
export function ScreenPlaceholder({ title }: ScreenPlaceholderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>Not implemented yet</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[800],
    padding: spacing[6],
    gap: spacing[2],
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.neutral[50],
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.neutral[200],
  },
});
