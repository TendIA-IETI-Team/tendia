import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CORTES_NIVEL, NIVELES } from '@/lib/format';
import { colors, font, scoreLevelColors, type } from '@/lib/theme';

export function Screen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer && <View style={s.footer}>{footer}</View>}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return (
    <Text style={s.title} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Body({
  children,
  muted = false,
  style,
}: {
  children: ReactNode;
  muted?: boolean;
  style?: object;
}) {
  return <Text style={[s.body, muted && { color: colors.neutral600 }, style]}>{children}</Text>;
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}

type Variant = 'primary' | 'secondary' | 'accent' | 'link';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  testID,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
}) {
  const v = {
    primary: { bg: colors.indigo700, fg: colors.white, border: colors.indigo700 },
    secondary: { bg: colors.white, fg: colors.indigo700, border: colors.neutral300 },
    // Sobre naranja va texto índigo oscuro: el blanco no pasa contraste AA.
    accent: { bg: colors.orange500, fg: colors.indigo900, border: colors.orange500 },
    link: { bg: 'transparent', fg: colors.indigo500, border: 'transparent' },
  }[variant];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Text
          style={[
            s.buttonText,
            { color: v.fg },
            variant === 'link' && { textDecorationLine: 'underline' },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Input({
  label,
  hint,
  ...props
}: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      <TextInput
        placeholderTextColor={colors.neutral600}
        accessibilityLabel={label}
        style={s.input}
        {...props}
      />
      {hint && <Text style={s.hint}>{hint}</Text>}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Aviso({
  tono = 'info',
  children,
}: {
  tono?: 'info' | 'error' | 'ok' | 'warning';
  children: ReactNode;
}) {
  const t = {
    info: { bg: colors.indigo100, fg: colors.indigo700 },
    error: { bg: colors.dangerBg, fg: colors.danger },
    ok: { bg: colors.successBg, fg: colors.success },
    warning: { bg: colors.warningBg, fg: colors.warning },
  }[tono];
  return (
    <View
      style={[s.aviso, { backgroundColor: t.bg }]}
      accessibilityRole={tono === 'error' ? 'alert' : undefined}
    >
      <Text style={[s.avisoText, { color: t.fg }]}>{children}</Text>
    </View>
  );
}

/** Pasos del proceso para que el tendero sepa dónde va. */
export function Pasos({ actual, total = 4 }: { actual: number; total?: number }) {
  return (
    <View style={s.pasos} accessibilityLabel={`Paso ${actual} de ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[s.paso, { backgroundColor: i < actual ? colors.indigo700 : colors.indigo100 }]}
        />
      ))}
    </View>
  );
}

/**
 * Escala del Puntaje TendIA: 0-100 en 5 niveles con nombre. Rampa de índigo, nunca rojo:
 * un puntaje bajo es "En construcción", algo que se puede mejorar.
 */
export function EscalaPuntaje({ puntaje, nivelIndice }: { puntaje: number; nivelIndice: number }) {
  return (
    <View
      style={{ gap: 8 }}
      accessibilityLabel={`Puntaje ${puntaje} de 100, nivel ${NIVELES[nivelIndice]}`}
    >
      <View style={s.escala}>
        {NIVELES.map((n, i) => (
          <View
            key={n}
            style={{
              flex: CORTES_NIVEL[i + 1] - CORTES_NIVEL[i],
              backgroundColor: scoreLevelColors[i],
              opacity: i === nivelIndice ? 1 : 0.35,
            }}
          />
        ))}
        <View style={[s.marcador, { left: `${Math.min(98, Math.max(1, puntaje))}%` }]} />
      </View>
      <View style={s.escalaTextos}>
        <Text style={s.hint}>0</Text>
        <Text style={[s.hint, { fontFamily: font.bold, color: colors.indigo700 }]}>
          {NIVELES[nivelIndice]}
        </Text>
        <Text style={s.hint}>100</Text>
      </View>
    </View>
  );
}

export function Cargando({ texto }: { texto: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 16, paddingVertical: 48 }}>
      <ActivityIndicator size="large" color={colors.indigo700} />
      <Body muted>{texto}</Body>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.indigo50 },
  scroll: { padding: 20, gap: 16, flexGrow: 1 },
  footer: {
    padding: 20,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.neutral300,
    backgroundColor: colors.white,
  },
  title: {
    fontFamily: font.extrabold,
    fontSize: type.title,
    color: colors.indigo900,
    lineHeight: 32,
  },
  body: { fontFamily: font.regular, fontSize: type.body, color: colors.indigo900, lineHeight: 26 },
  label: { fontFamily: font.bold, fontSize: type.small, color: colors.indigo900 },
  hint: { fontFamily: font.regular, fontSize: 14, color: colors.neutral600 },
  button: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  buttonText: { fontFamily: font.bold, fontSize: type.body },
  input: {
    minHeight: 56,
    borderWidth: 1.5,
    borderColor: colors.neutral300,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 20,
    fontFamily: font.semibold,
    color: colors.indigo900,
    backgroundColor: colors.white,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.neutral300,
  },
  aviso: { borderRadius: 12, padding: 14 },
  avisoText: { fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
  pasos: { flexDirection: 'row', gap: 6 },
  paso: { flex: 1, height: 6, borderRadius: 3 },
  escala: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'visible', gap: 2 },
  marcador: {
    position: 'absolute',
    top: -5,
    width: 6,
    height: 24,
    marginLeft: -3,
    borderRadius: 3,
    backgroundColor: colors.indigo900,
    borderWidth: 2,
    borderColor: colors.white,
  },
  escalaTextos: { flexDirection: 'row', justifyContent: 'space-between' },
});
