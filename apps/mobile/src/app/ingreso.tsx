import { router } from 'expo-router';
import { useState } from 'react';
import { Image, View } from 'react-native';
import { Aviso, Body, Button, Input, Screen, Title } from '@/components/ui';
import { api } from '@/lib/api';
import { useSesion } from '@/lib/sesion';

/** Registro e ingreso con celular y código OTP (TND-010). */
export default function Ingreso() {
  const { iniciar } = useSesion();
  const [celular, setCelular] = useState('');
  const [codigo, setCodigo] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [codigoDev, setCodigoDev] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function pedirCodigo() {
    setError(null);
    setCargando(true);
    try {
      const r = await api<{ codigoDev?: string }>('/auth/tendero/otp', {
        method: 'POST',
        body: { celular },
      });
      setCodigoDev(r.codigoDev ?? null);
      setEnviado(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  async function entrar() {
    setError(null);
    setCargando(true);
    try {
      const r = await api<{ accessToken: string }>('/auth/tendero/verificar', {
        method: 'POST',
        body: { celular, codigo },
      });
      await iniciar(r.accessToken);
      router.replace('/inicio');
    } catch (e) {
      setError((e as Error).message);
      setCargando(false);
    }
  }

  return (
    <Screen
      footer={
        enviado ? (
          <>
            <Button
              testID="entrar"
              title="Entrar"
              onPress={entrar}
              disabled={codigo.length !== 6}
              loading={cargando}
            />
            <Button
              title="Cambiar número"
              variant="link"
              onPress={() => {
                setEnviado(false);
                setCodigo('');
              }}
            />
          </>
        ) : (
          <Button
            testID="pedir-codigo"
            title="Recibir código por mensaje"
            onPress={pedirCodigo}
            disabled={celular.replace(/\D/g, '').length < 10}
            loading={cargando}
          />
        )
      }
    >
      <View style={{ alignItems: 'center', marginTop: 24, marginBottom: 8 }}>
        <Image
          source={require('../../assets/logo.png')}
          style={{ width: 96, height: 96 }}
          accessibilityIgnoresInvertColors
        />
      </View>
      <Title>Crédito basado en tu negocio</Title>
      <Body muted>
        No en tu pasado bancario. TendIA mira cómo vende y paga tu tienda, y te ayuda a mostrárselo
        a una entidad.
      </Body>
      {!enviado ? (
        <Input
          testID="celular"
          label="Tu número de celular"
          placeholder="300 123 4567"
          keyboardType="phone-pad"
          autoComplete="tel"
          maxLength={14}
          value={celular}
          onChangeText={setCelular}
        />
      ) : (
        <>
          <Body>Te enviamos un código de 6 números por mensaje de texto.</Body>
          <Input
            testID="codigo"
            label="Código"
            placeholder="123456"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            value={codigo}
            onChangeText={(t) => setCodigo(t.replace(/\D/g, ''))}
          />
          {codigoDev && <Aviso>Modo de prueba: tu código es {codigoDev}</Aviso>}
        </>
      )}
      {error && <Aviso tono="error">{error}</Aviso>}
    </Screen>
  );
}
