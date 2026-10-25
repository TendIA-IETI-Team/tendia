import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Aviso, Body, Button, Cargando, Pasos, Screen, Title } from '@/components/ui';
import { api, solicitudActual, type Solicitud } from '@/lib/api';
import { colors, font } from '@/lib/theme';

interface Aliado {
  id: string;
  nombre: string;
  tipo: 'BANCO' | 'FINTECH' | 'MICROFINANCIERA' | 'DISTRIBUIDOR';
}

const TIPOS: Record<Aliado['tipo'], string> = {
  BANCO: 'Banco',
  FINTECH: 'Empresa de crédito digital',
  MICROFINANCIERA: 'Entidad de microcrédito',
  DISTRIBUIDOR: 'Distribuidor',
};

/** T9: enviar al aliado elegido y ver quién revisa (TND-055). */
export default function Enviar() {
  const [sol, setSol] = useState<Solicitud | null>(null);
  const [aliados, setAliados] = useState<Aliado[] | null>(null);
  const [elegido, setElegido] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    Promise.all([solicitudActual(), api<Aliado[]>('/aliados')])
      .then(([s, a]) => {
        setSol(s);
        setAliados(a);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  async function enviar() {
    if (!sol || !elegido) return;
    setError(null);
    setCargando(true);
    try {
      await api(`/solicitudes/${sol.id}/enviar`, { method: 'POST', body: { aliadoId: elegido } });
      router.replace('/seguimiento');
    } catch (e) {
      setError((e as Error).message);
      setCargando(false);
    }
  }

  const nombre = aliados?.find((a) => a.id === elegido)?.nombre;

  return (
    <Screen
      footer={
        <>
          <Button
            testID="enviar"
            title={nombre ? `Enviar a ${nombre}` : 'Elige una entidad'}
            onPress={enviar}
            disabled={!elegido}
            loading={cargando}
          />
          <Button title="Volver" variant="link" onPress={() => router.back()} />
        </>
      }
    >
      <Pasos actual={4} />
      <Title>¿Con quién quieres compartir tu puntaje?</Title>
      <Body muted>
        La entidad verá tu Puntaje TendIA, por qué lo obtuviste y los datos que autorizaste. Ella
        decide si te presta y en qué condiciones.
      </Body>
      {!aliados && !error && <Cargando texto="Cargando entidades…" />}
      {aliados?.map((a) => {
        const activo = a.id === elegido;
        return (
          <Pressable
            key={a.id}
            testID={`aliado-${a.nombre}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: activo }}
            aria-checked={activo}
            onPress={() => setElegido(a.id)}
            style={{
              backgroundColor: colors.white,
              borderRadius: 16,
              padding: 18,
              borderWidth: activo ? 2 : 1,
              borderColor: activo ? colors.indigo700 : colors.neutral300,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: colors.indigo700,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {activo && (
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: colors.indigo700,
                  }}
                />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.extrabold, fontSize: 19, color: colors.indigo900 }}>
                {a.nombre}
              </Text>
              <Text style={{ fontFamily: font.regular, fontSize: 15, color: colors.neutral600 }}>
                {TIPOS[a.tipo]}
              </Text>
            </View>
          </Pressable>
        );
      })}
      {error && <Aviso tono="error">{error}</Aviso>}
    </Screen>
  );
}
