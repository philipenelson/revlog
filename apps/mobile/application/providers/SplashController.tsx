import { useCallback, useEffect, useState, type PropsWithChildren } from 'react';
import { View, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';

// Module scope: must run before the first render to actually delay hiding.
SplashScreen.preventAutoHideAsync().catch(() => {});

export function SplashController({ children }: PropsWithChildren) {
  const [fontsLoaded] = useFonts({ Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold });
  const [hasLaidOut, setHasLaidOut] = useState(false);

  const onLayoutRootView = useCallback(() => {
    setHasLaidOut(true);
  }, []);

  // Wait on whichever of layout / font loading finishes last -- hiding on
  // layout alone (the old behaviour) can fire before fonts resolve, flashing
  // the system font for a frame before Outfit swaps in.
  useEffect(() => {
    if (fontsLoaded && hasLaidOut) SplashScreen.hideAsync();
  }, [fontsLoaded, hasLaidOut]);

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
