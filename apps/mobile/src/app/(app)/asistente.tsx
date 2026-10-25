import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type MensajeChat } from '@/lib/api';
import { colors, font } from '@/lib/theme';

const SUGERENCIAS = [
  'Hoy vendí 350 mil',
  'Le fié 20 mil a don Pedro',
  'Don Pedro me pagó',
  '¿Cómo voy este mes?',
  '¿Cómo va mi crédito?',
  '¿Qué es el Fondo Nacional de Garantías?',
];

const BIENVENIDA: MensajeChat = {
  rol: 'assistant',
  contenido:
    'Hola, soy Tendi. Cuéntame tus ventas y fiados como se los dirías a un vecino y yo los anoto en tu cuaderno digital. También te cuento cómo va tu crédito.',
};

/** Chat con el asistente de IA: anota ventas y fiados y responde dudas (también por WhatsApp). */
export default function Asistente() {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([BIENVENIDA]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    api<MensajeChat[]>('/asistente/mensajes')
      .then((h) => h.length && setMensajes([BIENVENIDA, ...h]))
      .catch(() => undefined);
  }, []);

  async function enviar(contenido: string) {
    const limpio = contenido.trim();
    if (!limpio || enviando) return;
    setTexto('');
    setMensajes((m) => [...m, { rol: 'user', contenido: limpio }]);
    setEnviando(true);
    try {
      const r = await api<{ respuesta: string }>('/asistente/mensajes', {
        method: 'POST',
        body: { mensaje: limpio },
      });
      setMensajes((m) => [...m, { rol: 'assistant', contenido: r.respuesta }]);
    } catch (e) {
      setMensajes((m) => [...m, { rol: 'assistant', contenido: (e as Error).message }]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={s.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Text style={s.volver}>‹</Text>
        </Pressable>
        <View>
          <Text style={s.titulo}>Tendi</Text>
          <Text style={s.subtitulo}>Tu asistente de TendIA</Text>
        </View>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scroll}
          contentContainerStyle={s.lista}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        >
          {mensajes.map((m, i) => (
            <View
              key={i}
              style={[s.burbuja, m.rol === 'user' ? s.mia : s.suya]}
              accessibilityLabel={`${m.rol === 'user' ? 'Tú' : 'Tendi'}: ${m.contenido}`}
            >
              <Text style={[s.textoBurbuja, m.rol === 'user' && { color: colors.white }]}>
                {m.contenido}
              </Text>
            </View>
          ))}
          {enviando && (
            <View style={[s.burbuja, s.suya]}>
              <ActivityIndicator color={colors.indigo700} />
            </View>
          )}
        </ScrollView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.sugerencias}
          keyboardShouldPersistTaps="handled"
        >
          {SUGERENCIAS.map((t) => (
            <Pressable
              key={t}
              onPress={() => void enviar(t)}
              style={s.chip}
              accessibilityRole="button"
            >
              <Text style={s.chipTexto}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={s.barra}>
          <TextInput
            testID="mensaje"
            style={s.input}
            placeholder="Escribe aquí…"
            placeholderTextColor={colors.neutral600}
            value={texto}
            onChangeText={setTexto}
            onSubmitEditing={() => void enviar(texto)}
            returnKeyType="send"
            maxLength={1000}
            accessibilityLabel="Mensaje para Tendi"
          />
          <Pressable
            testID="enviar-mensaje"
            accessibilityRole="button"
            accessibilityLabel="Enviar"
            onPress={() => void enviar(texto)}
            disabled={!texto.trim() || enviando}
            style={[s.enviar, (!texto.trim() || enviando) && { opacity: 0.5 }]}
          >
            <Text style={{ color: colors.white, fontFamily: font.extrabold, fontSize: 20 }}>➤</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.indigo50 },
  header: {
    backgroundColor: colors.indigo700,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  volver: { color: colors.white, fontSize: 34, lineHeight: 36, fontFamily: font.bold },
  titulo: { color: colors.white, fontFamily: font.extrabold, fontSize: 20 },
  subtitulo: { color: colors.indigo100, fontFamily: font.regular, fontSize: 14 },
  lista: { padding: 16, gap: 10 },
  burbuja: { maxWidth: '85%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  mia: { alignSelf: 'flex-end', backgroundColor: colors.indigo700, borderBottomRightRadius: 4 },
  suya: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.neutral300,
  },
  textoBurbuja: { fontFamily: font.regular, fontSize: 17, lineHeight: 24, color: colors.indigo900 },
  sugerencias: { paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.indigo300,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.white,
  },
  chipTexto: { fontFamily: font.bold, fontSize: 14, color: colors.indigo700 },
  barra: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.neutral300,
    backgroundColor: colors.white,
  },
  input: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.neutral300,
    paddingHorizontal: 16,
    fontSize: 17,
    fontFamily: font.regular,
    color: colors.indigo900,
  },
  enviar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.indigo700,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
