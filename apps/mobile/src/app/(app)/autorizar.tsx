import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { ENLACES } from '@/lib/enlaces';
import { Chips } from '@/components/chips';
import { Aviso, Body, Button, Card, Cargando, Pasos, Screen, Title } from '@/components/ui';
import { api, type Consentimiento, type Fuente } from '@/lib/api';
import { colors, font } from '@/lib/theme';

/** T2: autorizar fuentes de datos en lenguaje simple (TND-020, Ley 1581). */
export default function Autorizar() {
  const [fuentes, setFuentes] = useState<Fuente[] | null>(null);
  const [elegidas, setElegidas] = useState<Record<string, string | null>>({});
  const [vigentes, setVigentes] = useState<Consentimiento[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    Promise.all([api<{ fuentes: Fuente[] }>('/fuentes'), api<Consentimiento[]>('/consentimientos')])
      .then(([f, c]) => {
        const activos = c.filter((x) => !x.revocadoEn);
        setFuentes(f.fuentes);
        setVigentes(activos);
        setElegidas(Object.fromEntries(activos.map((x) => [x.fuente, x.proveedor])));
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const seleccion = Object.entries(elegidas).filter(([, p]) => p) as [Fuente['fuente'], string][];

  async function autorizar() {
    setError(null);
    setCargando(true);
    try {
      for (const [fuente, proveedor] of seleccion) {
        if (!vigentes.some((v) => v.fuente === fuente)) {
          await api('/consentimientos', { method: 'POST', body: { fuente, proveedor } });
        }
      }
      router.replace('/evaluando');
    } catch (e) {
      setError((e as Error).message);
      setCargando(false);
    }
  }

  return (
    <Screen
      footer={
        <Button
          testID="autorizar"
          title={seleccion.length ? 'Autorizar y calcular mi puntaje' : 'Elige al menos una fuente'}
          onPress={autorizar}
          disabled={!seleccion.length}
          loading={cargando}
        />
      }
    >
      <Pasos actual={2} />
      <Title>¿De dónde tomamos los datos de tu negocio?</Title>
      <Body muted>
        Con tu permiso leemos cómo vende y paga tu tienda. Entre más fuentes autorices, mejor
        podemos mostrar tu negocio.
      </Body>
      <Aviso tono="ok">TendIA solo consulta tus datos: no puede mover ni sacar tu dinero.</Aviso>
      <Body muted style={{ fontSize: 15 }}>
        Para qué: calcular tu Puntaje TendIA y compartirlo solo con la entidad que tú elijas. Puedes
        quitar cada permiso cuando quieras.
      </Body>
      {!fuentes && !error && <Cargando texto="Cargando…" />}
      {fuentes?.map((f) => {
        const activa = Boolean(elegidas[f.fuente]);
        return (
          <Card
            key={f.fuente}
            style={activa ? { borderColor: colors.indigo700, borderWidth: 2 } : undefined}
          >
            <Pressable
              testID={`fuente-${f.fuente}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: activa }}
              onPress={() =>
                setElegidas((e) => ({ ...e, [f.fuente]: activa ? null : f.proveedores[0] }))
              }
              style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: colors.indigo700,
                  backgroundColor: activa ? colors.indigo700 : colors.white,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 2,
                }}
              >
                {activa && (
                  <Text style={{ color: colors.white, fontFamily: font.extrabold }}>✓</Text>
                )}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontFamily: font.extrabold, fontSize: 20, color: colors.indigo900 }}>
                  {f.titulo}
                </Text>
                <Body>{f.descripcion}</Body>
                <Body muted style={{ fontSize: 15 }}>
                  Qué usamos: {f.queUsamos}
                </Body>
              </View>
            </Pressable>
            {activa && f.proveedores.length > 1 && (
              <View style={{ gap: 8 }}>
                <Body muted style={{ fontSize: 15 }}>
                  ¿Cuál usas?
                </Body>
                <Chips
                  opciones={f.proveedores}
                  valor={elegidas[f.fuente]}
                  onChange={(p) => setElegidas((e) => ({ ...e, [f.fuente]: p }))}
                />
              </View>
            )}
          </Card>
        );
      })}
      <Aviso>
        Puedes quitar cualquier autorización cuando quieras en “Mis autorizaciones”. Al quitarla,
        borramos esos datos.
      </Aviso>
      <Button
        title="Leer cómo cuidamos tus datos"
        variant="link"
        onPress={() => void Linking.openURL(ENLACES.politicaDatos)}
      />
      {fuentes?.some((f) => f.simulado) && (
        <Body muted style={{ fontSize: 13 }}>
          Versión de prueba: las fuentes devuelven datos simulados.
        </Body>
      )}
      {error && <Aviso tono="error">{error}</Aviso>}
    </Screen>
  );
}
