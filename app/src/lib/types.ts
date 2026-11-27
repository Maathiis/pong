/** Types renvoyés par l'API (voir api/src). */

export type Side = 'left' | 'right';
export type MatchStatus = 'WAITING' | 'READY' | 'COUNTDOWN' | 'LIVE' | 'FINISHED' | 'INTERRUPTED' | 'CANCELLED';

export interface Settings {
  alertOffline: boolean;
  alertSpeedRecord: boolean;
  alertMatchPoint: boolean;
  retroSounds: boolean;
  /** seuil de l'alerte de vitesse, en multiple de la vitesse de départ */
  speedAlertThreshold: number;
}

export interface User {
  id: string;
  pseudo: string;
  settings: Settings;
}

export interface Session {
  token: string;
  user: User;
}

export interface Match {
  id: string;
  borneId: string;
  status: MatchStatus;
  targetScore: number;
  left: { id: string; pseudo: string } | null;
  /** contre le bot : { id: null, pseudo: 'BOT' } */
  right: { id: string | null; pseudo: string } | null;
  /** partie contre le bot de la borne (raquette droite) */
  vsBot: boolean;
  /** raquette jouée avec la manette du téléphone (le joueur 2 : la borne n'a de boutons que pour le joueur 1) */
  remote: Side | null;
  score: { left: number; right: number };
  winner: Side | null;
  matchPoint: Side | null;
  endRequests: Side[];
  /** joueurs qui ont appuyé sur « Je suis prêt » (la partie démarre quand les deux l'ont fait, un seul contre le bot) */
  startRequests: Side[];
  waitingUntil: string | null;
  countdownEndsAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSec: number;
  stats: { maxSpeed: number; maxStreak: number; longestRally: number; totalBounces: number };
  feed: { text: string; kind: string; at: string }[];
}

export interface Stats {
  played: number;
  wins: number;
  losses: number;
  winRate: number;
  streak: { result: 'V' | 'D'; count: number } | null;
  recent: {
    id: string;
    result: 'V' | 'D' | null;
    status: MatchStatus;
    me: string;
    opponent: string;
    scoreMe: number;
    scoreOpponent: number;
    endedAt: string;
  }[];
}

export type Leaderboard = { rank: number; pseudo: string; played: number; wins: number; winRate: number }[];

export interface Alert {
  kind: 'speed' | 'match_point' | 'borne_offline';
  title: string;
  body: string;
  at: string;
}
