import { useState } from 'react';
import { View } from 'react-native';
import { Button, ErrorText, P, StatusDot, T } from '@/components/ui';
import { useLive } from '@/lib/live';
import { colors } from '@/lib/theme';
import type { Match } from '@/lib/types';
import { mmss, useNow } from '@/lib/useNow';
import { MatchScreen, PlayersCard, QrGlyph, Target } from './shared';

/** Le joueur est dans la salle, il attend le second joueur. */
export function MatchLobby({ match }: { match: Match }) {
  const { leave } = useLive();
  const now = useNow(true, 1000);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remaining = match.waitingUntil ? (new Date(match.waitingUntil).getTime() - now) / 1000 : 0;

  return (
    <MatchScreen>
      <PlayersCard left={match.left?.pseudo ?? null} right={match.right?.pseudo ?? null} />
      <Target>
        <QrGlyph />
      </Target>
      <View style={{ alignItems: 'center', gap: 10 }}>
        <P size={13} style={{ textAlign: 'center' }}>
          EN ATTENTE DU JOUEUR 2
        </P>
        <T size={24} style={{ textAlign: 'center' }}>
          La borne affiche un nouveau QR code : ton adversaire le scanne avec son téléphone.
        </T>
        <T size={20} color={colors.inkSoft} style={{ textAlign: 'center' }}>
          Tu joues à gauche sur {match.borneId}.
        </T>
        <ErrorText style={{ textAlign: 'center' }}>{error}</ErrorText>
      </View>
      <View style={{ alignSelf: 'stretch', marginTop: 'auto', gap: 12 }}>
        <StatusDot boxed ok>
          Salle ouverte · encore {mmss(remaining)}
        </StatusDot>
        <Button
          label="QUITTER LA SALLE"
          bg={colors.pink}
          height={56}
          loading={leaving}
          onPress={async () => {
            setLeaving(true);
            try {
              await leave();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setLeaving(false);
            }
          }}
        />
      </View>
    </MatchScreen>
  );
}
