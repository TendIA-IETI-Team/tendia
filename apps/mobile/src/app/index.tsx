import { Redirect } from 'expo-router';
import { useSesion } from '@/lib/sesion';

export default function Index() {
  const { activa } = useSesion();
  return <Redirect href={activa ? '/inicio' : '/ingreso'} />;
}
