import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Adjuntar, type Archivo, paraEnviar } from '@/components/adjuntar';
import { Chips } from '@/components/chips';
import { Aviso, Body, Button, Input, Label, Screen, Title } from '@/components/ui';
import { api, solicitudActual, type Solicitud } from '@/lib/api';
import { mesLargo, ultimosMeses } from '@/lib/format';

const MOTIVOS = [
  'Temporada de lluvias',
  'Obras en la calle',
  'Enfermedad o calamidad',
  'Temporada baja de enero',
  'Otro motivo',
] as const;

type Dato = { fuente: string; mes: string; ventas: number | null };

/** T8: justificar una variación; el puntaje se recalcula antes de enviarlo (TND-045, TND-054). */
export default function Justificar() {
  const [sol, setSol] = useState<Solicitud | null>(null);
  const [datos, setDatos] = useState<Dato[]>([]);
  const [mes, setMes] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<(typeof MOTIVOS)[number] | null>(null);
  const [detalle, setDetalle] = useState('');
  const [evidencia, setEvidencia] = useState<Archivo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    Promise.all([solicitudActual(), api<{ datos: Dato[] }>('/me/datos')])
      .then(([s, d]) => {
        setSol(s);
        setDatos(d.datos);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  // Sugerimos primero los meses con ventas más bajas.
  const meses = useMemo(() => {
    const ventas = new Map<string, number>();
    for (const d of datos)
      if (d.ventas !== null && d.fuente !== 'DISTRIBUIDOR')
        ventas.set(d.mes, Math.max(ventas.get(d.mes) ?? 0, d.ventas));
    const ultimos = ultimosMeses(12);
    return [...ultimos].sort((a, b) => (ventas.get(a) ?? Infinity) - (ventas.get(b) ?? Infinity));
  }, [datos]);

  const texto =
    motivo === 'Otro motivo'
      ? detalle.trim()
      : detalle.trim()
        ? `${motivo}: ${detalle.trim()}`
        : motivo;

  async function enviar() {
    if (!sol || !mes || !texto) return;
    setError(null);
    setCargando(true);
    try {
      await api(`/solicitudes/${sol.id}/variaciones`, {
        method: 'POST',
        body: { mes, motivo: texto, evidencia: paraEnviar(evidencia) },
      });
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setCargando(false);
    }
  }

  return (
    <Screen
      footer={
        <>
          <Button
            testID="recalcular"
            title="Recalcular mi puntaje"
            onPress={enviar}
            disabled={!mes || !texto || texto.length < 3}
            loading={cargando}
          />
          <Button title="Volver" variant="link" onPress={() => router.back()} />
        </>
      }
    >
      <Title>¿Tuviste un mes malo por algo puntual?</Title>
      <Body muted>
        Cuéntanos qué pasó. Ese mes no contará en contra de lo estables que son tus ventas, y la
        entidad verá tu explicación.
      </Body>
      <Label>¿Qué mes?</Label>
      <Chips opciones={meses.slice(0, 6)} valor={mes} onChange={setMes} etiqueta={mesLargo} />
      <Label>¿Qué pasó?</Label>
      <Chips opciones={MOTIVOS} valor={motivo} onChange={setMotivo} />
      {motivo && (
        <Input
          label={motivo === 'Otro motivo' ? 'Cuéntanos qué pasó' : 'Detalle (opcional)'}
          value={detalle}
          onChangeText={setDetalle}
          maxLength={200}
          multiline
        />
      )}
      {motivo && (
        <>
          <Label>¿Tienes con qué mostrarlo? (opcional)</Label>
          <Adjuntar
            valor={evidencia}
            onChange={setEvidencia}
            ayuda="Una foto o PDF que lo respalde: la incapacidad médica, una foto de la obra o una noticia. La entidad la verá con tu explicación."
          />
        </>
      )}
      {error && <Aviso tono="error">{error}</Aviso>}
    </Screen>
  );
}
