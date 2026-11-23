import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api } from './api';
import { useAuth } from './auth';
import { getServerUrl } from './config';
import type { Match } from './types';

/**
 * Connexion temps réel avec l'API (Socket.IO) + état de la partie du joueur.
 * - `match` : la partie en cours, ou la dernière terminée tant que le joueur n'a pas fermé l'écran de fin.
 * - `bornes` : statut en ligne / hors ligne de chaque borne connue.
 */
interface LiveState {
  connected: boolean;
  match: Match | null;
  bornes: Record<string, boolean>;
  join: (borneId: string) => Promise<Match>;
  leave: () => Promise<void>;
  requestEnd: () => Promise<void>;
  dismiss: () => void;
  refresh: () => Promise<void>;
}

const LiveContext = createContext<LiveState | null>(null);

export function LiveProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [match, setMatch] = useState<Match | null>(null);
  const [bornes, setBornes] = useState<Record<string, boolean>>({});
  const socketRef = useRef<Socket | null>(null);

  const refresh = useCallback(async () => {
    const [current, list] = await Promise.all([api.currentMatch(), api.bornes()]);
    setBornes(Object.fromEntries(list.map((b) => [b.id, b.online])));
    // On garde l'écran de fin affiché si la dernière partie vient de se terminer.
    setMatch((prev) => current ?? (prev && isOver(prev) ? prev : null));
  }, []);

  useEffect(() => {
    if (!token) return;
    const socket = io(getServerUrl(), {
      auth: { token },
      transports: ['websocket'],
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;
    socket.on('connect', () => {
      setConnected(true);
      refresh().catch(() => undefined);
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on('match:update', (m: Match) => {
      setMatch((prev) => {
        // ignore une partie annulée qui n'est pas celle affichée
        if (m.status === 'CANCELLED') return prev?.id === m.id ? null : prev;
        return m;
      });
    });
    socket.on('borne:status', (b: { id: string; online: boolean }) =>
      setBornes((prev) => ({ ...prev, [b.id]: b.online })),
    );
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token, refresh]);

  useEffect(() => {
    if (!user) setMatch(null);
  }, [user]);

  const value = useMemo<LiveState>(
    () => ({
      connected,
      match,
      bornes,
      join: async (borneId) => {
        const m = await api.join(borneId);
        setMatch(m);
        return m;
      },
      leave: async () => {
        if (!match) return;
        await api.leave(match.id);
        setMatch(null);
      },
      requestEnd: async () => {
        if (!match) return;
        setMatch(await api.requestEnd(match.id));
      },
      dismiss: () => setMatch(null),
      refresh,
    }),
    [connected, match, bornes, refresh],
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export const isOver = (m: Match) => m.status === 'FINISHED' || m.status === 'INTERRUPTED';

export function useLive() {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error('useLive doit être utilisé dans <LiveProvider>');
  return ctx;
}
