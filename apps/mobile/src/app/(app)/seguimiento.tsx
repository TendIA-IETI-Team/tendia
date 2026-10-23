import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Aviso, Body, Button, Card, Cargando, Input, Label, Screen, Title } from '@/components/ui';
import { api, solicitudActual, type Solicitud } from '@/lib/api';
import { pesos } from '@/lib/format';
import { colors, font } from '@/lib/theme';

const GARANTIAS: Record<string, { nombre: string; explicacion: string }> = {
  FNG: {
    nombre: 'Respaldo del Fondo Nacional de Garantías',
    explicacion:
      'Es un fondo del Estado que respalda tu crédito: si no pudieras pagar, el fondo responde por una parte. Puede tener un costo que la entidad te explicará.',
  },
  CODEUDOR: {
    nombre: 'Un codeudor',
    explicacion: 'Una persona de confianza que se compromete a pagar si tú no puedes.',
  },
  OTRA: {
    nombre: 'Otra garantía',
    explicacion: 'Lee la nota de la entidad para saber qué necesita.',
  },
};

/** T9 a T13: quién revisa, respuesta a la garantía (T10) y resultado (TND-055 a TND-057, TND-081). */
export default function Seguimiento() {
  const [sol, setSol] = useState<Solicitud | null>(null);
  const [respuesta, setRespuesta] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(() => {
    solicitudActual()
      .then(setSol)
      .catch((e: Error) => setError(e.message));
  }, []);
  useFocusEffect(cargar);

  async function accion(path: string, body: object) {
    if (!sol) return;
    setError(null);
    setCargando(true);
    try {
      setSol(await api<Solicitud>(`/solicitudes/${sol.id}/${path}`, { method: 'POST', body }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  if (!sol)
    return (
      <Screen>
        <Cargando texto="Cargando…" />
        {error && <Aviso tono="error">{error}</Aviso>}
      </Screen>
    );
  const g = sol.garantia ? GARANTIAS[sol.garantia.tipo] : null;
  const terminada = sol.estado === 'APROBADA' || sol.estado === 'RECHAZADA';

  return (
    <Screen
      footer={
        <>
          {sol.estado === 'GARANTIA_SOLICITADA' && (
            <Button
              testID="responder-garantia"
              title="Enviar mi respuesta"
              onPress={() => accion('garantia', { respuesta })}
              disabled={respuesta.trim().length < 3}
              loading={cargando}
            />
          )}
          {!terminada && sol.estado !== 'GARANTIA_SOLICITADA' && (
            <Button title="Actualizar" variant="secondary" onPress={cargar} />
          )}
          <Button
            title="Ir al inicio"
            variant={terminada ? 'primary' : 'link'}
            onPress={() => router.replace('/inicio')}
          />
        </>
      }
    >
      <Title>{sol.estadoTexto}</Title>
      <Card>
        <Label>Quién revisa tu solicitud</Label>
        <Text
          testID="aliado"
          style={{ fontFamily: font.extrabold, fontSize: 22, color: colors.indigo700 }}
        >
          {sol.aliado?.nombre}
        </Text>
        <Body muted>
          {pesos(sol.monto)} · {sol.plazoMeses} meses · Puntaje {sol.score?.puntaje}
        </Body>
      </Card>

      {sol.estado === 'ENVIADA' && (
        <Aviso>La entidad está revisando tu puntaje. Te avisaremos cuando decida.</Aviso>
      )}

      {sol.estado === 'GARANTIA_SOLICITADA' && g && (
        <Card>
          <Label>La entidad te pide: {g.nombre}</Label>
          <Body>{g.explicacion}</Body>
          {sol.garantia?.notaAliado && <Aviso>Nota de la entidad: {sol.garantia.notaAliado}</Aviso>}
          <Input
            testID="respuesta"
            label="Tu respuesta"
            placeholder="Ej.: Sí acepto el respaldo del Fondo."
            value={respuesta}
            onChangeText={setRespuesta}
            multiline
            maxLength={1000}
          />
        </Card>
      )}

      {sol.estado === 'GARANTIA_ENVIADA' && (
        <Aviso>Recibimos tu respuesta. La entidad está revisando tu garantía.</Aviso>
      )}

      {sol.estado === 'APROBADA' && (
        <Card>
          <Aviso tono="ok">¡Felicitaciones! {sol.aliado?.nombre} aprobó tu crédito.</Aviso>
          <Body>
            La entidad te contactará para firmar y hacer el desembolso. Revisa bien la tasa y las
            cuotas antes de firmar.
          </Body>
          {sol.notaDecision && <Body muted>Nota: {sol.notaDecision}</Body>}
        </Card>
      )}

      {sol.estado === 'RECHAZADA' && (
        <Card>
          <Body>
            Esta vez la entidad no aprobó tu crédito. No te desanimes: así puedes mejorar tu
            puntaje.
          </Body>
          {sol.comoMejorar.map((c) => (
            <Body key={c}>→ {c}</Body>
          ))}
          {sol.notaDecision && <Body muted>Nota de la entidad: {sol.notaDecision}</Body>}
        </Card>
      )}

      {terminada && (
        <Card>
          <Label>
            {sol.satisfaccion
              ? '¡Gracias por tu opinión!'
              : '¿Qué tan fácil fue pedir tu crédito con TendIA?'}
          </Label>
          <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="radiogroup">
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                testID={`estrella-${n}`}
                accessibilityRole="radio"
                accessibilityLabel={`${n} de 5`}
                accessibilityState={{ checked: (sol.satisfaccion ?? 0) === n }}
                disabled={Boolean(sol.satisfaccion) || cargando}
                onPress={() => accion('satisfaccion', { calificacion: n })}
                style={{ padding: 6 }}
              >
                <Text
                  style={{
                    fontSize: 34,
                    color: n <= (sol.satisfaccion ?? 0) ? colors.orange500 : colors.neutral300,
                  }}
                >
                  ★
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>
      )}
      {error && <Aviso tono="error">{error}</Aviso>}
    </Screen>
  );
}
