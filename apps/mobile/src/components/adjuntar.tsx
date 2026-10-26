import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Aviso, Body, Button } from '@/components/ui';
import { colors, font } from '@/lib/theme';

/** Archivo listo para enviar a la API (evidencia de T8 o documento de la garantía de T10). */
export interface Archivo {
  nombre: string;
  tipo: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  base64: string;
  tamano: number;
}

const MAX_BYTES = 5 * 1024 * 1024;
const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

/** Foto con la cámara, o un PDF o foto del celular. Máximo 5 MB. */
export function Adjuntar({
  valor,
  onChange,
  ayuda,
}: {
  valor: Archivo | null;
  onChange: (a: Archivo | null) => void;
  ayuda: string;
}) {
  const [error, setError] = useState<string | null>(null);

  function aceptar(a: Archivo) {
    if (a.tamano > MAX_BYTES) {
      setError('El archivo pesa más de 5 MB. Prueba con una foto más liviana.');
      return;
    }
    setError(null);
    onChange(a);
  }

  async function foto() {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      setError('Necesitamos permiso para usar la cámara.');
      return;
    }
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
    });
    const asset = r.canceled ? null : r.assets[0];
    if (!asset?.base64) return;
    aceptar({
      nombre: asset.fileName ?? 'foto.jpg',
      tipo: 'image/jpeg',
      base64: asset.base64,
      tamano: Math.round((asset.base64.length * 3) / 4),
    });
  }

  async function archivo() {
    const r = await DocumentPicker.getDocumentAsync({
      type: [...TIPOS],
      copyToCacheDirectory: true,
    });
    const asset = r.canceled ? null : r.assets[0];
    if (!asset) return;
    const tipo = TIPOS.find((t) => t === asset.mimeType);
    if (!tipo) {
      setError('Solo se aceptan fotos o PDF.');
      return;
    }
    try {
      const base64 = await new File(asset.uri).base64();
      aceptar({
        nombre: asset.name,
        tipo,
        base64,
        tamano: asset.size ?? Math.round((base64.length * 3) / 4),
      });
    } catch {
      setError('No pudimos leer el archivo. Inténtalo de nuevo.');
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <Body muted style={{ fontSize: 15 }}>
        {ayuda}
      </Body>
      {valor ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ flex: 1, fontFamily: font.bold, color: colors.indigo900 }}>
            {valor.tipo === 'application/pdf' ? '📄' : '📷'} {valor.nombre} (
            {Math.max(1, Math.round(valor.tamano / 1024))} KB)
          </Text>
          <Pressable onPress={() => onChange(null)} accessibilityRole="button">
            <Text style={{ color: colors.danger, fontFamily: font.bold }}>Quitar</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Button title="Tomar foto" variant="secondary" onPress={() => void foto()} />
          <Button title="Subir PDF o foto" variant="secondary" onPress={() => void archivo()} />
        </View>
      )}
      {error && <Aviso tono="error">{error}</Aviso>}
    </View>
  );
}

/** Lo que espera la API: nombre, tipo y contenido en base64. */
export const paraEnviar = (a: Archivo | null) =>
  a ? { nombre: a.nombre, tipo: a.tipo, base64: a.base64 } : undefined;
