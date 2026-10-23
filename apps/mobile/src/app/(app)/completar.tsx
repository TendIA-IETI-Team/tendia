import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Aviso, Body, Button, Card, Input, Label, Pasos, Screen, Title } from '@/components/ui';
import { api, solicitudActual, type Perfil, type Solicitud } from '@/lib/api';
import { mesLargo, pesos, soloDigitos, ultimosMeses } from '@/lib/format';

/** T5: completar la información del negocio a mano, como en el cuaderno (TND-034). */
export default function Completar() {
  const [sol, setSol] = useState<Solicitud | null>(null);
  const [nombre, setNombre] = useState('');
  const [propietario, setPropietario] = useState('');
  const [anios, setAnios] = useState('');
  const [promedio, setPromedio] = useState('');
  const [ventas, setVentas] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const meses = ultimosMeses(6);

  useFocusEffect(
    useCallback(() => {
      Promise.all([solicitudActual(), api<Perfil>('/me')])
        .then(([s, p]) => {
          setSol(s);
          setNombre(p.negocio?.nombre ?? '');
          setPropietario(p.nombre ?? '');
          if (p.negocio?.antiguedadMeses)
            setAnios(String(Math.round(p.negocio.antiguedadMeses / 12)));
          if (p.negocio?.ventasMensualesDeclaradas)
            setPromedio(String(p.negocio.ventasMensualesDeclaradas));
        })
        .catch((e: Error) => setError(e.message));
    }, []),
  );

  const faltaVentas = sol?.calidadDatos?.issues.some((i) => i.code === 'pocas_ventas') ?? false;

  async function guardar() {
    setError(null);
    setCargando(true);
    try {
      await api('/me/negocio', {
        method: 'PUT',
        body: {
          nombre: nombre.trim() || undefined,
          nombrePropietario: propietario.trim() || undefined,
          antiguedadMeses: Math.max(1, Math.round(Number(anios.replace(',', '.')) * 12)),
          ventasMensualesDeclaradas: soloDigitos(promedio) || undefined,
        },
      });
      const manuales = meses
        .filter((m) => soloDigitos(ventas[m] ?? '') > 0)
        .map((m) => ({ mes: m, ventas: soloDigitos(ventas[m]) }));
      if (manuales.length)
        await api('/me/ventas-manuales', { method: 'POST', body: { meses: manuales } });
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
          testID="guardar"
          title="Guardar y calcular de nuevo"
          onPress={guardar}
          disabled={!anios}
          loading={cargando}
        />
      }
    >
      <Pasos actual={3} />
      <Title>Cuéntanos un poco más de tu tienda</Title>
      {sol?.calidadDatos?.issues.map((i) => (
        <Aviso key={i.code} tono="warning">
          {i.message}
        </Aviso>
      ))}
      <Input label="Nombre de la tienda" value={nombre} onChangeText={setNombre} maxLength={80} />
      <Input label="Tu nombre" value={propietario} onChangeText={setPropietario} maxLength={80} />
      <Input
        testID="anios"
        label="¿Hace cuántos años abriste?"
        keyboardType="decimal-pad"
        value={anios}
        onChangeText={setAnios}
        hint="Si es menos de un año, escribe 0,5"
      />
      <Input
        label="¿Cuánto vendes en un mes normal?"
        keyboardType="number-pad"
        value={soloDigitos(promedio) ? pesos(soloDigitos(promedio)) : ''}
        onChangeText={setPromedio}
      />
      {faltaVentas && (
        <Card>
          <Label>Ventas de los últimos meses (mira tu cuaderno)</Label>
          <Body muted style={{ fontSize: 15 }}>
            Escribe lo que vendiste cada mes. Si no sabes uno, déjalo vacío.
          </Body>
          <View style={{ gap: 12 }}>
            {meses.map((m) => (
              <Input
                key={m}
                label={mesLargo(m)}
                keyboardType="number-pad"
                value={soloDigitos(ventas[m] ?? '') ? pesos(soloDigitos(ventas[m])) : ''}
                onChangeText={(t) => setVentas((v) => ({ ...v, [m]: t }))}
              />
            ))}
          </View>
        </Card>
      )}
      {error && <Aviso tono="error">{error}</Aviso>}
    </Screen>
  );
}
