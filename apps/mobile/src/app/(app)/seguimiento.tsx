import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Adjuntar, type Archivo, paraEnviar } from '@/components/adjuntar';
import { Aviso, Body, Button, Card, Cargando, Input, Label, Screen, Title } from '@/components/ui';
import { api, solicitudActual, type Solicitud } from '@/lib/api';
import { ENLACES } from '@/lib/enlaces';
import { pesos } from '@/lib/format';
import { colors, font } from '@/lib/theme';

const GARANTIAS: Record<string, { nombre: string; explicacion: string }> = {
  FNG: {
    nombre: 'Respaldo del Fondo Nacional de Garantías',
    explicacion:
      'Es como un fiador, pero del Estado: si no pudieras pagar, el Fondo le responde a la entidad por una parte de la deuda. Puede tener un costo que la entidad te explicará.',
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
  const [documento, setDocumento] = useState<Archivo | null>(null);
  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(() => {
    solicitudActual()
      .then((s) => {
        setSol(s);
        // Al abrir el seguimiento, el tendero ya vio la decisión: se apaga el aviso del inicio.
        if (s?.novedad) void api(`/solicitudes/${s.id}/visto`, { method: 'POST' }).catch(() => {});
      })
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
              onPress={() => accion('garantia', { respuesta, documento: paraEnviar(documento) })}
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
          {sol.garantia?.tipo === 'FNG' && (
            <Button
              title="Ver cómo funciona el Fondo Nacional de Garantías"
              variant="link"
              onPress={() => void Linking.openURL(ENLACES.fng)}
            />
          )}
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
          <Label>Documento (opcional)</Label>
          <Adjuntar
            valor={documento}
            onChange={setDocumento}
            ayuda="Si la entidad te pide un papel (certificado laboral del codeudor, formato del Fondo), tómale foto o súbelo en PDF."
          />
        </Card>
      )}

      {sol.estado === 'GARANTIA_ENVIADA' && (
        <Aviso>Recibimos tu respuesta. La entidad está revisando tu garantía.</Aviso>
      )}

      {sol.estado === 'APROBADA' && (
        <Card>
          <Aviso tono="ok">¡Felicitaciones! {sol.aliado?.nombre} aprobó tu crédito.</Aviso>
          {sol.aprobado && (
            <View style={{ gap: 4 }}>
              <Label>Detalle del crédito</Label>
              <Body>Monto: {pesos(sol.aprobado.monto)}</Body>
              <Body>Plazo: {sol.aprobado.plazoMeses} meses</Body>
              {sol.aprobado.tasaEfectivaAnual !== null && (
                <Body>Tasa: {sol.aprobado.tasaEfectivaAnual} % efectivo anual</Body>
              )}
            </View>
          )}
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
                accessibilityState={{ checked: (sol.satisfaccion ?? estrellas) === n }}
                disabled={Boolean(sol.satisfaccion) || cargando}
                onPress={() => setEstrellas(n)}
                style={{ padding: 6 }}
              >
                <Text
                  style={{
                    fontSize: 34,
                    color:
                      n <= (sol.satisfaccion ?? estrellas) ? colors.orange500 : colors.neutral300,
                  }}
                >
                  ★
                </Text>
              </Pressable>
            ))}
          </View>
          {!sol.satisfaccion && estrellas > 0 && (
            <>
              <Input
                label="¿Algo que quieras contarnos? (opcional)"
                value={comentario}
                onChangeText={setComentario}
                maxLength={500}
                multiline
              />
              <Button
                testID="enviar-opinion"
                title="Enviar mi opinión"
                variant="secondary"
                loading={cargando}
                onPress={() =>
                  accion('satisfaccion', {
                    calificacion: estrellas,
                    comentario: comentario.trim() || undefined,
                  })
                }
              />
            </>
          )}
        </Card>
      )}
      {error && <Aviso tono="error">{error}</Aviso>}
    </Screen>
  );
}
