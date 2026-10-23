import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/nunito';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SesionProvider, useSesion } from '@/lib/sesion';
import { colors } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

function Navegacion() {
  const { cargando } = useSesion();
  const [fuentes, error] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  const listo = (fuentes || error) && !cargando;

  useEffect(() => {
    if (listo) SplashScreen.hideAsync();
  }, [listo]);

  if (!listo) return null;
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.indigo50 } }}
    />
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SesionProvider>
        <Navegacion />
      </SesionProvider>
    </SafeAreaProvider>
  );
}
