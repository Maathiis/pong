import { getServerUrl } from './config';
import type { Leaderboard, Match, Session, Settings, Stats, User } from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

let token: string | null = null;
export const setApiToken = (t: string | null) => {
  token = t;
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${getServerUrl()}/api${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(`Serveur injoignable (${getServerUrl()}). Vérifie l'adresse dans les réglages.`, 0);
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message[0] : data?.message;
    throw new ApiError(msg || `Erreur ${res.status}`, res.status);
  }
  return data as T;
}

export const api = {
  register: (b: { pseudo: string; password: string; consent: boolean }) =>
    request<Session>('POST', '/auth/register', b),
  login: (b: { pseudo: string; password: string }) => request<Session>('POST', '/auth/login', b),
  me: () => request<User>('GET', '/me'),
  stats: () => request<Stats>('GET', '/me/stats'),
  updateSettings: (s: Partial<Settings>) => request<User>('PATCH', '/me/settings', s),
  deleteAccount: () => request<null>('DELETE', '/me'),
  leaderboard: () => request<Leaderboard>('GET', '/leaderboard'),
  bornes: () => request<{ id: string; online: boolean }[]>('GET', '/bornes'),
  /** `code` = texte du QR code affiché sur la matrice de la borne (« PONG:7K3QX9MZ »). */
  join: (code: string) => request<Match>('POST', '/matches/join', { code }),
  start: (id: string) => request<Match>('POST', `/matches/${id}/start`),
  currentMatch: () => request<Match | null>('GET', '/matches/current'),
  match: (id: string) => request<Match>('GET', `/matches/${id}`),
  leave: (id: string) => request<Match>('POST', `/matches/${id}/leave`),
  requestEnd: (id: string) => request<Match>('POST', `/matches/${id}/end-request`),
};
