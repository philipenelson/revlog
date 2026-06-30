import { useCallback, type PropsWithChildren } from 'react';
import { View, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

// Module scope: must run before the first render to actually delay hiding.
SplashScreen.preventAutoHideAsync().catch(() => {});

export function SplashController({ children }: PropsWithChildren) {
  const onLayoutRootView = useCallback(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <View style={styles.container} onLayout={onLayoutRootView}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
