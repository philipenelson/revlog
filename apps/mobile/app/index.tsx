import { Text, View, StyleSheet } from 'react-native';
import { colors, spacing, fontSize } from '@maintenance-log/ui-tokens';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Maintenance Log</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[50],
    padding: spacing[4],
  },
  heading: {
    fontSize: fontSize['2xl'],
    color: colors.neutral[900],
  },
});
