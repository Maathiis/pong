/**
 * Origines autorisées pour CORS (HTTP et Socket.IO).
 * - L'application mobile n'envoie pas d'en-tête Origin : toujours acceptée.
 * - La borne virtuelle tourne en local (outils/borne-virtuelle/lancer.sh) : http://localhost ou 127.0.0.1, tout port.
 * Tout autre site web est refusé (un site tiers ne peut pas appeler l'API depuis le navigateur d'un joueur).
 */
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function corsOrigin(
  origin: string | undefined,
  done: (err: Error | null, allow?: boolean) => void,
) {
  done(null, !origin || LOCAL.test(origin));
}
