import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const SERVER_KEY = 'pong.serverUrl';

/**
 * Adresse par défaut de l'API.
 * 1. EXPO_PUBLIC_API_URL si elle est définie (fichier app/.env)
 * 2. sinon la machine qui sert le bundle Expo (le Mac), sur le port 3001 :
 *    en dev, le téléphone charge déjà l'appli depuis cette IP, donc l'API y est aussi.
 */
export function defaultServerUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  const hostUri = Constants.expoConfig?.hostUri; // ex. "192.168.1.42:8081"
  const host = hostUri?.split(':')[0];
  return `http://${host || 'localhost'}:3001`;
}

let serverUrl: string | null = null;

export async function loadServerUrl(): Promise<string> {
  if (serverUrl) return serverUrl;
  const saved = await SecureStore.getItemAsync(SERVER_KEY);
  serverUrl = saved || defaultServerUrl();
  return serverUrl;
}

export function getServerUrl(): string {
  return serverUrl ?? defaultServerUrl();
}

/** Enregistre une adresse personnalisée, ou revient à l'adresse par défaut si `url` est vide. */
export async function setServerUrl(url: string): Promise<string> {
  const clean = url.trim().replace(/\/+$/, '');
  if (!clean) {
    await SecureStore.deleteItemAsync(SERVER_KEY);
    serverUrl = defaultServerUrl();
  } else {
    const withScheme = /^https?:\/\//.test(clean) ? clean : `http://${clean}`;
    await SecureStore.setItemAsync(SERVER_KEY, withScheme);
    serverUrl = withScheme;
  }
  return serverUrl;
}
