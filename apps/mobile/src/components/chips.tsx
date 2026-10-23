import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '@/lib/theme';

export function Chips<T extends string | number>({
  opciones,
  valor,
  onChange,
  etiqueta = (v) => String(v),
}: {
  opciones: readonly T[];
  valor: T | null;
  onChange: (v: T) => void;
  etiqueta?: (v: T) => string;
}) {
  return (
    <View style={s.wrap} accessibilityRole="radiogroup">
      {opciones.map((o) => {
        const activo = o === valor;
        return (
          <Pressable
            key={String(o)}
            accessibilityRole="radio"
            accessibilityState={{ checked: activo }}
            onPress={() => onChange(o)}
            style={[s.chip, activo && s.activo]}
          >
            <Text style={[s.texto, activo && { color: colors.white }]}>{etiqueta(o)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.indigo300,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
  activo: { backgroundColor: colors.indigo700, borderColor: colors.indigo700 },
  texto: { fontFamily: font.bold, fontSize: 16, color: colors.indigo700 },
});
