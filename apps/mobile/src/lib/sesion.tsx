import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { setUnauthorizedHandler } from './api';
import { tokenStore } from './session';

interface Sesion {
  cargando: boolean;
  activa: boolean;
  iniciar: (token: string) => Promise<void>;
  salir: () => Promise<void>;
}

const Ctx = createContext<Sesion | null>(null);

export function SesionProvider({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true);
  const [activa, setActiva] = useState(false);

  const salir = useCallback(async () => {
    await tokenStore.clear();
    setActiva(false);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void salir());
    tokenStore
      .get()
      .then((t) => setActiva(Boolean(t)))
      .finally(() => setCargando(false));
  }, [salir]);

  const value = useMemo<Sesion>(
    () => ({
      cargando,
      activa,
      iniciar: async (token) => {
        await tokenStore.set(token);
        setActiva(true);
      },
      salir,
    }),
    [cargando, activa, salir],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSesion(): Sesion {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSesion fuera de SesionProvider');
  return s;
}
