import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ErrorText, P, Row, ShadowTitle, StatTile, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useLive } from '@/lib/live';
import { block, colors } from '@/lib/theme';
import type { Match, Side } from '@/lib/types';
import { mmss, speedLabel, useNow } from '@/lib/useNow';

/** Partie en cours : score, stats et fil d'événements poussés par la borne via l'API. */
export function MatchLive({ match }: { match: Match }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { requestEnd } = useLive();
  const now = useNow(true, 1000);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const elapsed = match.startedAt ? (now - new Date(match.startedAt).getTime()) / 1000 : 0;
  const mySide: Side = match.left?.id === user?.id ? 'left' : 'right';
  const iAsked = match.endRequests.includes(mySide);

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <View style={{ flexDirection: 'row', borderBottomWidth: 4, borderColor: colors.ink, height: 190 + insets.top, zIndex: 2 }}>
        <ScoreHalf pseudo={match.left?.pseudo} score={match.score.left} side="gauche" bg={colors.mint} topInset={insets.top} />
        <ScoreHalf pseudo={match.right?.pseudo} score={match.score.right} side="droite" bg={colors.pink} topInset={insets.top} divider />
        <View
          style={{
            position: 'absolute',
            alignSelf: 'center',
            left: 0,
            right: 0,
            top: insets.top + 8,
            alignItems: 'center',
          }}
          pointerEvents="none"
        >
          <View style={{ backgroundColor: colors.apricot, borderWidth: 3, borderColor: colors.ink, paddingVertical: 4, paddingHorizontal: 10 }}>
            <P size={9}>EN DIRECT · {mmss(elapsed)}</P>
          </View>
        </View>
        {match.matchPoint && (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: -24, alignItems: 'center' }} pointerEvents="none">
            <View style={[block(4), { backgroundColor: colors.orange, paddingVertical: 8, paddingHorizontal: 14 }]}>
              <P size={10}>BALLE DE MATCH !</P>
            </View>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: match.matchPoint ? 36 : 16, gap: 14 }}>
        <Row>
          <StatTile label="VITESSE BALLE MAX" value={speedLabel(match.stats.maxSpeed)} color={colors.statSpeed} />
          <StatTile label="BUTS D'AFFILÉE MAX" value={match.stats.maxStreak} color={colors.statStreak} />
        </Row>
        <Row>
          <StatTile label="ÉCHANGE LE + LONG" value={match.stats.longestRally} color={colors.statRally} />
          <StatTile label="REBONDS TOTAL" value={match.stats.totalBounces} color={colors.statBounces} />
        </Row>

        <View style={{ backgroundColor: colors.white, borderWidth: 4, borderColor: colors.ink, padding: 12, gap: 4 }}>
          <P size={9}>EN DIRECT</P>
          {match.feed.slice(0, 3).map((f, i) => (
            <T key={`${f.at}-${i}`} size={21}>
              {f.text}
            </T>
          ))}
        </View>

        {match.vsBot ? (
          <T size={20}>Contre le bot, tu peux arrêter la partie quand tu veux.</T>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[0, 1].map((i) => (
                <View
                  key={i}
                  style={{
                    width: 18,
                    height: 18,
                    borderWidth: 3,
                    borderColor: colors.ink,
                    backgroundColor: i < match.endRequests.length ? colors.orange : colors.white,
                  }}
                />
              ))}
            </View>
            <T size={20}>
              {match.endRequests.length === 0
                ? 'Les deux joueurs doivent demander la fin'
                : `${match.endRequests.length} joueur sur 2 a demandé la fin`}
            </T>
          </View>
        )}
        <ErrorText>{error}</ErrorText>
        <Button
          label={iAsked ? 'FIN DEMANDÉE' : 'FIN DU MATCH'}
          disabled={iAsked}
          loading={sending}
          onPress={async () => {
            setSending(true);
            setError(null);
            try {
              await requestEnd();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setSending(false);
            }
          }}
        />
      </ScrollView>
    </View>
  );
}

function ScoreHalf({
  pseudo,
  score,
  side,
  bg,
  topInset,
  divider,
}: {
  pseudo?: string;
  score: number;
  side: string;
  bg: string;
  topInset: number;
  divider?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: bg,
        paddingTop: topInset + 44,
        paddingBottom: 14,
        paddingHorizontal: 14,
        alignItems: 'center',
        justifyContent: 'space-between',
        borderLeftWidth: divider ? 4 : 0,
        borderColor: colors.ink,
      }}
      accessible
      accessibilityLabel={`${pseudo ?? '???'}, ${score} points`}
    >
      <P size={11}>{pseudo ?? '???'}</P>
      <ShadowTitle size={64} offset={5}>
        {score}
      </ShadowTitle>
      <T size={20}>{side}</T>
    </View>
  );
}
