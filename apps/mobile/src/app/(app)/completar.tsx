import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Chips } from '@/components/chips';
import { Aviso, Body, Button, Card, Input, Label, Pasos, Screen, Title } from '@/components/ui';
import { api, solicitudActual, type Perfil, type Solicitud } from '@/lib/api';
import { mesLargo, pesos, soloDigitos, ultimosMeses } from '@/lib/format';

/** T5: completar la información del negocio a mano, como en el cuaderno (TND-034). */
export default function Completar() {
  const [sol, setSol] = useState<Solicitud | null>(null);
  const [nombre, setNombre] = useState('');
  const [propietario, setPropietario] = useState('');
  const [anios, setAnios] = useState('');
  // T5 (prueba con doña Gloria): ventas de un día normal y uno flojo; la app calcula el mes.
  const [diaNormal, setDiaNormal] = useState('');
  const [diaFlojo, setDiaFlojo] = useState('');
  const [diasFlojos, setDiasFlojos] = useState<0 | 1 | 2 | 3 | 4 | null>(2);
  const [ventas, setVentas] = useState<Record<string, string>>({});
  const semana =
    soloDigitos(diaNormal) * (7 - (diasFlojos ?? 0)) + soloDigitos(diaFlojo) * (diasFlojos ?? 0);
  const estimado = Math.round((semana * 52) / 12 / 1000) * 1000;
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
        },
      });
      if (soloDigitos(diaNormal) > 0) {
        await api('/me/estimacion-ventas', {
          method: 'POST',
          body: {
            diaNormal: soloDigitos(diaNormal),
            diaFlojo: soloDigitos(diaFlojo),
            diasFlojosPorSemana: diasFlojos ?? 0,
          },
        });
      }
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
      <Card>
        <Label>¿Cuánto vendes en un día?</Label>
        <Body muted style={{ fontSize: 15 }}>
          No tienes que sacar la cuenta de la semana: nosotros la hacemos.
        </Body>
        <Input
          testID="dia-normal"
          label="Un día normal"
          keyboardType="number-pad"
          value={soloDigitos(diaNormal) ? pesos(soloDigitos(diaNormal)) : ''}
          onChangeText={setDiaNormal}
        />
        <Input
          testID="dia-flojo"
          label="Un día flojo"
          keyboardType="number-pad"
          value={soloDigitos(diaFlojo) ? pesos(soloDigitos(diaFlojo)) : ''}
          onChangeText={setDiaFlojo}
        />
        <Label>¿Cuántos días flojos tiene una semana?</Label>
        <Chips opciones={[0, 1, 2, 3, 4] as const} valor={diasFlojos} onChange={setDiasFlojos} />
        {estimado > 0 && <Aviso tono="ok">Eso es más o menos {pesos(estimado)} al mes.</Aviso>}
      </Card>
      <Button
        title="Pasar mi cuaderno con una foto"
        variant="link"
        onPress={() => router.push('/cuaderno')}
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
