import { useLive } from '@/lib/live';
import { MatchEnd } from '@/components/match/MatchEnd';
import { MatchLive } from '@/components/match/MatchLive';
import { MatchLobby } from '@/components/match/MatchLobby';
import { MatchManette } from '@/components/match/MatchManette';
import { MatchScan } from '@/components/match/MatchScan';
import { MatchVersus } from '@/components/match/MatchVersus';

/**
 * Onglet MATCH : l'écran affiché suit l'état de la partie, poussé en temps réel par l'API.
 *   aucune partie → scan du QR code affiché sur la matrice de la borne
 *   WAITING       → salle d'attente (le second joueur scanne le nouveau QR code)
 *   READY         → les deux joueurs sont là, bouton « Lancer la partie »
 *   COUNTDOWN     → compte à rebours
 *   LIVE          → score et stats en direct
 *   joueur 2 (COUNTDOWN / LIVE) → manette en paysage (la borne n'a de boutons que pour le joueur 1)
 *   FINISHED / INTERRUPTED → écran de fin
 */
export default function MatchTab() {
  const { match, manette } = useLive();
  if (match && manette) return <MatchManette match={match} />;
  switch (match?.status) {
    case 'WAITING':
      return <MatchLobby match={match} />;
    case 'READY':
    case 'COUNTDOWN':
      return <MatchVersus match={match} />;
    case 'LIVE':
      return <MatchLive match={match} />;
    case 'FINISHED':
    case 'INTERRUPTED':
      return <MatchEnd match={match} />;
    default:
      return <MatchScan />;
  }
}
