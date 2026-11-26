import { useState } from 'react';
import { View } from 'react-native';
import { Button, ErrorText, P, ShadowTitle, T } from '@/components/ui';
import { useLive } from '@/lib/live';
import { block, colors } from '@/lib/theme';
import type { Match } from '@/lib/types';
import { useNow } from '@/lib/useNow';
import { MatchScreen } from './shared';

/**
 * Les deux joueurs sont dans la salle.
 *  READY     : l'un des deux appuie sur « Lancer la partie ».
 *  COUNTDOWN : compte à rebours (la borne affiche le même).
 */
export function MatchVersus({ match }: { match: Match }) {
  const { start, leave } = useLive();
  const ready = match.status === 'READY';
  const [busy, setBusy] = useState<'start' | 'leave' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = useNow(!ready, 200);

  async function run(kind: 'start' | 'leave') {
    setBusy(kind);
    setError(null);
    try {
      await (kind === 'start' ? start() : leave());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const left = match.countdownEndsAt
    ? Math.max(0, Math.ceil((new Date(match.countdownEndsAt).getTime() - now) / 1000))
    : 0;

  return (
    <MatchScreen>
      <View
        style={{
          backgroundColor: colors.lime,
          borderWidth: 3,
          borderColor: colors.ink,
          paddingVertical: 6,
          paddingHorizontal: 12,
        }}
      >
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

      {ready ? (
        <View style={{ alignSelf: 'stretch', marginTop: 'auto', gap: 12 }}>
          <T size={21} color={colors.inkSoft} style={{ textAlign: 'center' }}>
            Mettez-vous chacun devant votre raquette, puis lancez la partie.
          </T>
          <ErrorText style={{ textAlign: 'center' }}>{error}</ErrorText>
          <Button
            label="LANCER LA PARTIE"
            height={62}
            size={13}
            loading={busy === 'start'}
            onPress={() => run('start')}
          />
          <Button
            label="QUITTER LA SALLE"
            bg={colors.white}
            height={48}
            size={10}
            flat
            loading={busy === 'leave'}
            onPress={() => run('leave')}
          />
        </View>
      ) : (
        <>
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
        </>
      )}
    </MatchScreen>
  );
}

function PlayerBlock({ side, pseudo, bg, right }: { side: string; pseudo: string; bg: string; right?: boolean }) {
  const paddle = (
    <View style={{ width: 14, height: 64, backgroundColor: colors.white, borderWidth: 3, borderColor: colors.ink }} />
  );
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
