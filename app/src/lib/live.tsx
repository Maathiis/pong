import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Vibration } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import { api } from './api';
import { useAuth } from './auth';
import { getServerUrl } from './config';
import { playSound } from './sounds';
import type { Alert, Match } from './types';

/**
 * Connexion temps réel avec l'API (Socket.IO) + état de la partie du joueur.
 * - `match` : la partie en cours, ou la dernière terminée tant que le joueur n'a pas fermé l'écran de fin.
 * - `bornes` : statut en ligne / hors ligne de chaque borne connue.
 * - `alert` : dernière alerte reçue (seuil de vitesse, balle de match, borne hors ligne), affichée en bannière.
 * - `connected` : faux pendant une coupure réseau ; la reconnexion est automatique.
 */
interface LiveState {
  connected: boolean;
  match: Match | null;
  bornes: Record<string, boolean>;
  alert: Alert | null;
  join: (code: string) => Promise<Match>;
  start: () => Promise<void>;
  leave: () => Promise<void>;
  requestEnd: () => Promise<void>;
  dismiss: () => void;
  dismissAlert: () => void;
  refresh: () => Promise<void>;
}

const LiveContext = createContext<LiveState | null>(null);
const ACTIVE = ['WAITING', 'READY', 'COUNTDOWN', 'LIVE'];

export const isOver = (m: Match) => m.status === 'FINISHED' || m.status === 'INTERRUPTED';

export function LiveProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [match, setMatch] = useState<Match | null>(null);
  const [bornes, setBornes] = useState<Record<string, boolean>>({});
  const [alert, setAlert] = useState<Alert | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const matchRef = useRef<Match | null>(null);
  matchRef.current = match;
  const soundsOn = useRef(false);
  soundsOn.current = !!user?.settings.retroSounds;

  const refresh = useCallback(async () => {
    const [current, list] = await Promise.all([api.currentMatch(), api.bornes()]);
    setBornes(Object.fromEntries(list.map((b) => [b.id, b.online])));
    // On garde l'écran de fin affiché si la dernière partie vient de se terminer.
    setMatch((prev) => current ?? (prev && isOver(prev) ? prev : null));
  }, []);

  /** Bruitages et retours haptiques quand la partie change. */
  const react = useCallback(
    (prev: Match | null, next: Match) => {
      if (!soundsOn.current || prev?.id !== next.id) return;
      const myScore = (m: Match) => m.score.left + m.score.right;
      if (prev.status !== 'COUNTDOWN' && next.status === 'COUNTDOWN') playSound('depart');
      else if (isOver(next) && !isOver(prev)) {
        const mySide = next.left?.id === user?.id ? 'left' : 'right';
        playSound(next.winner === mySide ? 'victoire' : 'defaite');
      } else if (myScore(next) > myScore(prev)) playSound('point');
    },
    [user?.id],
  );

  useEffect(() => {
    if (!token) return;
    const socket = io(getServerUrl(), { auth: { token }, transports: ['websocket'], reconnectionDelay: 1000 });
    socketRef.current = socket;
    socket.on('connect', () => {
      setConnected(true);
      refresh().catch(() => undefined); // on rattrape ce qui a pu se passer pendant la coupure
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on('match:update', (m: Match) => {
      const prev = matchRef.current;
      if (m.status === 'CANCELLED') {
        if (prev?.id === m.id) setMatch(null);
        return;
      }
      react(prev, m);
      // Je viens d'être ajouté à une partie : on affiche l'onglet MATCH.
      if (!prev && ACTIVE.includes(m.status)) router.navigate('/match');
      setMatch(m);
    });
    socket.on('match:left', ({ id }: { id: string }) => setMatch((prev) => (prev?.id === id ? null : prev)));
    socket.on('borne:status', (b: { id: string; online: boolean }) =>
      setBornes((prev) => ({ ...prev, [b.id]: b.online })),
    );
    socket.on('alert', (a: Alert) => {
      setAlert(a);
      Vibration.vibrate(a.kind === 'borne_offline' ? [0, 120, 80, 120] : 200);
      if (soundsOn.current) playSound('alerte');
    });
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token, refresh, react]);

  // Retour au premier plan : le système a pu couper la connexion pendant que l'appli dormait.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const socket = socketRef.current;
      if (socket && !socket.connected) socket.connect();
      refresh().catch(() => undefined);
    });
    return () => sub.remove();
  }, [refresh]);

  // L'alerte s'efface toute seule au bout de 5 s.
  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(() => setAlert(null), 5000);
    return () => clearTimeout(t);
  }, [alert]);

  useEffect(() => {
    if (!user) setMatch(null);
  }, [user]);

  const value = useMemo<LiveState>(
    () => ({
      connected,
      match,
      bornes,
      alert,
      join: async (code) => {
        const m = await api.join(code);
        setMatch(m);
        return m;
      },
      start: async () => {
        if (match) setMatch(await api.start(match.id));
      },
      leave: async () => {
        if (!match) return;
        await api.leave(match.id);
        setMatch(null);
      },
      requestEnd: async () => {
        if (match) setMatch(await api.requestEnd(match.id));
      },
      dismiss: () => setMatch(null),
      dismissAlert: () => setAlert(null),
      refresh,
    }),
    [connected, match, bornes, alert, refresh],
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive() {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error('useLive doit être utilisé dans <LiveProvider>');
  return ctx;
}
