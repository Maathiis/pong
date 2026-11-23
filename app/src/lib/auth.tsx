import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, setApiToken } from './api';
import { loadServerUrl } from './config';
import type { Session, User } from './types';

const TOKEN_KEY = 'pong.token';

interface AuthState {
  ready: boolean;
  token: string | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (pseudo: string, email: string, password: string, consent: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (u: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setApiToken(null);
    setToken(null);
    setUser(null);
  }, []);

  // Au lancement : on recharge la session enregistrée et on vérifie qu'elle est encore valable.
  useEffect(() => {
    (async () => {
      await loadServerUrl();
      const saved = await SecureStore.getItemAsync(TOKEN_KEY);
      if (saved) {
        setApiToken(saved);
        try {
          setUser(await api.me());
          setToken(saved);
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) await signOut();
          else {
            // serveur injoignable : on garde la session, l'appli réessaiera
            setToken(saved);
          }
        }
      }
      setReady(true);
    })();
  }, [signOut]);

  const open = useCallback(async (session: Session) => {
    await SecureStore.setItemAsync(TOKEN_KEY, session.token);
    setApiToken(session.token);
    setToken(session.token);
    setUser(session.user);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      token,
      user,
      signIn: async (email, password) => open(await api.login({ email, password })),
      signUp: async (pseudo, email, password, consent) =>
        open(await api.register({ pseudo, email, password, consent })),
      signOut,
      setUser,
    }),
    [ready, token, user, open, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
