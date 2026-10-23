import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'tendia.token';

/** Token en el almacenamiento seguro del teléfono (Keystore/Keychain). En web, solo para pruebas. */
export const tokenStore = {
  async get(): Promise<string | null> {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? null;
    return SecureStore.getItemAsync(KEY);
  },
  async set(token: string): Promise<void> {
    if (Platform.OS === 'web') return globalThis.localStorage?.setItem(KEY, token);
    await SecureStore.setItemAsync(KEY, token);
  },
  async clear(): Promise<void> {
    if (Platform.OS === 'web') return globalThis.localStorage?.removeItem(KEY);
    await SecureStore.deleteItemAsync(KEY);
  },
};
