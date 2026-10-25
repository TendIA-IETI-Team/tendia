import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Aviso, Body, Button, Card, Cargando, Label, Screen, Title } from '@/components/ui';
import { api, type LecturaCuaderno, type Registros } from '@/lib/api';
import { pesos } from '@/lib/format';
import { colors, font } from '@/lib/theme';

/**
 * Mi cuaderno (RF-04): lo que el tendero anota a mano pasa a la app con una foto (IA, TND-035),
 * y aquí ve sus ventas y fiados. Nada de la foto se guarda sin que el tendero lo confirme.
 */
export default function Cuaderno() {
  const [registros, setRegistros] = useState<Registros | null>(null);
  const [lectura, setLectura] = useState<LecturaCuaderno | null>(null);
  const [iaDisponible, setIaDisponible] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(() => {
    api<Registros>('/me/registros')
      .then(setRegistros)
      .catch((e: Error) => setError(e.message));
    api<{ disponible: boolean }>('/me/cuaderno/disponible')
      .then((r) => setIaDisponible(r.disponible))
      .catch(() => setIaDisponible(false));
  }, []);
  useFocusEffect(cargar);

  async function foto(origen: 'camara' | 'galeria') {
    setError(null);
    setAviso(null);
    if (origen === 'camara') {
      const permiso = await ImagePicker.requestCameraPermissionsAsync();
      if (!permiso.granted) {
        setError('Necesitamos permiso para usar la cámara.');
        return;
      }
    }
    const opciones: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.6,
      base64: true,
    };
    const r =
      origen === 'camara'
        ? await ImagePicker.launchCameraAsync(opciones)
        : await ImagePicker.launchImageLibraryAsync(opciones);
    if (r.canceled || !r.assets[0]?.base64) return;
    const asset = r.assets[0];
    setLeyendo(true);
    try {
      setLectura(
        await api<LecturaCuaderno>('/me/cuaderno', {
          method: 'POST',
          body: { imagenBase64: asset.base64, tipo: asset.mimeType ?? 'image/jpeg' },
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLeyendo(false);
    }
  }

  function quitar(i: number) {
    setLectura((l) => l && { ...l, registros: l.registros.filter((_, j) => j !== i) });
  }

  async function guardar() {
    if (!lectura) return;
    try {
      const r = await api<{ ventasGuardadas: number; fiadosGuardados: number }>(
        `/me/cuaderno/${lectura.id}/confirmar`,
        { method: 'POST', body: { registros: lectura.registros } },
      );
      setAviso(`Guardado: ${r.ventasGuardadas} días de ventas y ${r.fiadosGuardados} fiados.`);
      setLectura(null);
      cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function descartar() {
    if (!lectura) return;
    await api(`/me/cuaderno/${lectura.id}`, { method: 'DELETE' }).catch(() => undefined);
    setLectura(null);
  }

  async function pagado(id: string) {
    await api(`/me/fiados/${id}/pago`, { method: 'POST' }).catch((e: Error) => setError(e.message));
    cargar();
  }

  return (
    <Screen
      footer={
        lectura ? (
          <>
            <Button
              title="Guardar en mi cuaderno"
              onPress={guardar}
              disabled={!lectura.registros.length}
            />
            <Button title="Descartar" variant="link" onPress={descartar} />
          </>
        ) : (
          <>
            <Button title="Anotar con Tendi" onPress={() => router.push('/asistente')} />
            <Button title="Volver" variant="link" onPress={() => router.back()} />
          </>
        )
      }
    >
      <Title>Mi cuaderno</Title>
      {aviso && <Aviso tono="ok">{aviso}</Aviso>}
      {error && <Aviso tono="error">{error}</Aviso>}

      {leyendo ? (
        <Cargando texto="Leyendo tu cuaderno…" />
      ) : lectura ? (
        <Card>
          <Label>Revisa lo que leímos</Label>
          {!lectura.legible || !lectura.registros.length ? (
            <Body>No pudimos leer bien la foto{lectura.motivo ? `: ${lectura.motivo}` : ''}.</Body>
          ) : (
            lectura.registros.map((r, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 17, color: colors.indigo900 }}>
                    {r.fecha ?? 'Sin fecha'}
                    {r.ventas ? ` · ventas ${pesos(r.ventas)}` : ''}
                  </Text>
                  {r.fiados.map((f, k) => (
                    <Body key={k} muted style={{ fontSize: 15 }}>
                      Fiado a {f.cliente}: {pesos(f.monto)}
                    </Body>
                  ))}
                </View>
                <Pressable
                  onPress={() => quitar(i)}
                  accessibilityRole="button"
                  accessibilityLabel="Quitar"
                >
                  <Text style={{ color: colors.danger, fontFamily: font.bold }}>Quitar</Text>
                </Pressable>
              </View>
            ))
          )}
          <Body muted style={{ fontSize: 14 }}>
            Quita lo que esté mal leído. Los días sin fecha no se guardan como venta.
          </Body>
        </Card>
      ) : (
        <Card>
          <Label>Pasa tu cuaderno a la app</Label>
          <Body muted style={{ fontSize: 15 }}>
            Tómale foto a la hoja donde anotas ventas y fiados. Te mostramos lo que leímos antes de
            guardarlo.
          </Body>
          {iaDisponible ? (
            <View style={{ gap: 8 }}>
              <Button title="Tomar foto" variant="accent" onPress={() => void foto('camara')} />
              <Button
                title="Elegir de la galería"
                variant="secondary"
                onPress={() => void foto('galeria')}
              />
            </View>
          ) : (
            <Aviso>La lectura de fotos aún no está activa. Anota tus ventas con Tendi.</Aviso>
          )}
        </Card>
      )}

      {!registros && !error && <Cargando texto="Cargando…" />}
      {registros && (
        <>
          <Card>
            <Label>Tus ventas</Label>
            <Body>
              Hoy:{' '}
              <Text style={{ fontFamily: font.extrabold }}>
                {registros.ventaHoy ? pesos(registros.ventaHoy) : 'sin anotar'}
              </Text>
            </Body>
            <Body>Esta semana: {pesos(registros.ventasSemana)}</Body>
            <Body>
              Este mes: {pesos(registros.ventasMes)} ({registros.diasRegistradosMes} días anotados)
            </Body>
            <Body muted style={{ fontSize: 14 }}>
              Con 7 o más días anotados en un mes, esas ventas cuentan para tu Puntaje TendIA.
            </Body>
          </Card>
          <Card>
            <Label>Te deben (fiados): {pesos(registros.totalFiado)}</Label>
            {registros.fiadosPendientes.length === 0 && (
              <Body muted>No tienes fiados pendientes.</Body>
            )}
            {registros.fiadosPendientes.slice(0, 20).map((f) => (
              <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Body style={{ flex: 1 }}>
                  {f.cliente} · {pesos(f.monto)}
                </Body>
                <Pressable onPress={() => void pagado(f.id)} accessibilityRole="button">
                  <Text style={{ color: colors.success, fontFamily: font.bold }}>Ya pagó</Text>
                </Pressable>
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
