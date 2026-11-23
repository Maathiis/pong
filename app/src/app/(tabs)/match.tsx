import { useLive } from '@/lib/live';
import { MatchEnd } from '@/components/match/MatchEnd';
import { MatchLive } from '@/components/match/MatchLive';
import { MatchLobby } from '@/components/match/MatchLobby';
import { MatchScan } from '@/components/match/MatchScan';
import { MatchVersus } from '@/components/match/MatchVersus';

/**
 * Onglet MATCH : l'écran affiché suit l'état de la partie, poussé en temps réel par l'API.
 *   aucune partie → scan du QR code de la borne
 *   WAITING       → salle d'attente (le second joueur doit scanner)
 *   COUNTDOWN     → présentation des joueurs + compte à rebours
 *   LIVE          → score et stats en direct
 *   FINISHED / INTERRUPTED → écran de fin
 */
export default function MatchTab() {
  const { match } = useLive();
  switch (match?.status) {
    case 'WAITING':
      return <MatchLobby match={match} />;
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
