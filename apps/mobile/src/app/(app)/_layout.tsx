import { Redirect, Stack } from 'expo-router';
import { useSesion } from '@/lib/sesion';
import { colors } from '@/lib/theme';

export default function AppLayout() {
  const { activa } = useSesion();
  if (!activa) return <Redirect href="/ingreso" />;
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.indigo50 } }}
    />
  );
}
