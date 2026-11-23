import { View } from 'react-native';
import { P, ShadowTitle, T } from '@/components/ui';
import { block, colors } from '@/lib/theme';
import type { Match } from '@/lib/types';
import { useNow } from '@/lib/useNow';
import { MatchScreen } from './shared';

/** Les deux joueurs ont scanné : présentation et compte à rebours (la borne affiche le même). */
export function MatchVersus({ match }: { match: Match }) {
  const now = useNow(true, 200);
  const left = match.countdownEndsAt
    ? Math.max(0, Math.ceil((new Date(match.countdownEndsAt).getTime() - now) / 1000))
    : 0;

  return (
    <MatchScreen>
      <View style={{ backgroundColor: colors.lime, borderWidth: 3, borderColor: colors.ink, paddingVertical: 6, paddingHorizontal: 12 }}>
        <P size={11}>2 JOUEURS PRÊTS</P>
      </View>

      <View style={{ alignSelf: 'stretch' }}>
        <PlayerBlock side="GAUCHE · JOUEUR 1" pseudo={match.left?.pseudo ?? '???'} bg={colors.mint} />
        <View
          style={{
            alignSelf: 'center',
            marginVertical: -6,
            zIndex: 1,
            backgroundColor: colors.apricot,
            borderWidth: 4,
            borderColor: colors.ink,
            paddingVertical: 8,
            paddingHorizontal: 14,
          }}
        >
          <P size={16}>VS</P>
        </View>
        <PlayerBlock side="DROITE · JOUEUR 2" pseudo={match.right?.pseudo ?? '???'} bg={colors.pink} right />
      </View>

      <View style={{ alignItems: 'center', gap: 8, marginTop: 6 }} accessibilityLiveRegion="polite">
        <P size={10}>LA PARTIE COMMENCE DANS</P>
        <P
          size={72}
          color={colors.orange}
          style={{ textShadowColor: colors.ink, textShadowOffset: { width: 5, height: 5 }, textShadowRadius: 0.1 }}
        >
          {left || 'GO'}
        </P>
      </View>

      <T size={21} color={colors.inkSoft} style={{ marginTop: 'auto', textAlign: 'center' }}>
        Regarde la matrice : utilise les 2 boutons de ta raquette (haut / bas).
      </T>
    </MatchScreen>
  );
}

function PlayerBlock({ side, pseudo, bg, right }: { side: string; pseudo: string; bg: string; right?: boolean }) {
  const paddle = <View style={{ width: 14, height: 64, backgroundColor: colors.white, borderWidth: 3, borderColor: colors.ink }} />;
  return (
    <View
      style={[
        block(5),
        {
          backgroundColor: bg,
          padding: 18,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
      ]}
    >
      {right && paddle}
      <View style={{ gap: 8, alignItems: right ? 'flex-end' : 'flex-start' }}>
        <P size={9}>{side}</P>
        <ShadowTitle size={22}>{pseudo}</ShadowTitle>
      </View>
      {!right && paddle}
    </View>
  );
}
