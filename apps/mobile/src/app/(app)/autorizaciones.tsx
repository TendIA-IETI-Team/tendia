import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { Aviso, Body, Button, Card, Cargando, Screen, Title } from '@/components/ui';
import { api, type Consentimiento, type Fuente } from '@/lib/api';
import { colors, font } from '@/lib/theme';

const TITULOS: Record<string, string> = {
  DATAFONO: 'Ventas con datáfono',
  DISTRIBUIDOR: 'Pagos a tu proveedor',
  OPEN_FINANCE: 'Cuentas del banco',
};

/** Ver y revocar autorizaciones (TND-021). Revocar borra los datos de esa fuente. */
export default function Autorizaciones() {
  const [lista, setLista] = useState<Consentimiento[] | null>(null);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    api<Consentimiento[]>('/consentimientos')
      .then(setLista)
      .catch((e: Error) => setError(e.message));
  }, []);
  useFocusEffect(cargar);

  async function revocar(id: string) {
    setError(null);
    try {
      await api(`/consentimientos/${id}`, { method: 'DELETE' });
      setConfirmar(null);
      cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const vigentes = lista?.filter((c) => !c.revocadoEn) ?? [];
  const pasadas = lista?.filter((c) => c.revocadoEn) ?? [];

  return (
    <Screen footer={<Button title="Volver" variant="secondary" onPress={() => router.back()} />}>
      <Title>Mis autorizaciones</Title>
      <Body muted>
        Aquí ves qué datos de tu negocio nos dejaste usar. Puedes quitar cualquiera cuando quieras.
      </Body>
      {!lista && !error && <Cargando texto="Cargando…" />}
      {lista && vigentes.length === 0 && <Aviso>No tienes autorizaciones activas.</Aviso>}
      {vigentes.map((c) => (
        <Card key={c.id}>
          <Text style={{ fontFamily: font.extrabold, fontSize: 19, color: colors.indigo900 }}>
            {TITULOS[c.fuente as Fuente['fuente']]}
          </Text>
          <Body muted>
            {c.proveedor} · desde {new Date(c.otorgadoEn).toLocaleDateString('es-CO')}
          </Body>
          {confirmar === c.id ? (
            <View style={{ gap: 8 }}>
              <Aviso tono="warning">
                Si la quitas, borramos esos datos y tu próximo puntaje se calculará sin ellos.
              </Aviso>
              <Button title="Sí, quitar autorización" onPress={() => revocar(c.id)} />
              <Button title="Cancelar" variant="link" onPress={() => setConfirmar(null)} />
            </View>
          ) : (
            <Button
              testID={`revocar-${c.fuente}`}
              title="Quitar autorización"
              variant="secondary"
              onPress={() => setConfirmar(c.id)}
            />
          )}
        </Card>
      ))}
      {pasadas.length > 0 && (
        <Card>
          <Body muted>
            Autorizaciones que quitaste: {pasadas.map((c) => TITULOS[c.fuente]).join(', ')}
          </Body>
        </Card>
      )}
      {error && <Aviso tono="error">{error}</Aviso>}
    </Screen>
  );
}
