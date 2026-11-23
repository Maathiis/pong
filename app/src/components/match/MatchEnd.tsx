import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, P, Row, ShadowTitle, StatTile, StatusDot } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useLive } from '@/lib/live';
import { colors } from '@/lib/theme';
import type { Match } from '@/lib/types';
import { mmss, speedLabel } from '@/lib/useNow';

/** Écran de fin : victoire, défaite ou partie interrompue. */
export function MatchEnd({ match }: { match: Match }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { dismiss } = useLive();

  const mySide = match.left?.id === user?.id ? 'left' : 'right';
  const won = match.winner === mySide;
  const title = match.status === 'INTERRUPTED' ? 'INTERROMPU' : won ? 'VICTOIRE !' : 'DÉFAITE';
  const bg = match.status === 'INTERRUPTED' ? colors.lilac : won ? colors.lime : colors.pink;

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <View
        style={{
          backgroundColor: bg,
          borderBottomWidth: 4,
          borderColor: colors.ink,
          paddingTop: insets.top + 16,
          paddingBottom: 22,
          paddingHorizontal: 20,
          alignItems: 'center',
          gap: 14,
        }}
      >
        {won && <Confetti top={insets.top + 20} />}
        <ShadowTitle size={26} offset={4}>
          {title}
        </ShadowTitle>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }} accessible accessibilityLabel={`${match.score.left} à ${match.score.right}`}>
          <ShadowTitle size={56} offset={5}>
            {match.score.left}
          </ShadowTitle>
          <P size={28}>:</P>
          <ShadowTitle size={56} offset={5}>
            {match.score.right}
          </ShadowTitle>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch' }}>
          <P size={11}>{match.left?.pseudo ?? 'ANCIEN'}</P>
          <P size={11}>{match.right?.pseudo ?? 'ANCIEN'}</P>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, paddingTop: 18, gap: 14 }}>
        <P size={10}>STATS DU MATCH</P>
        <Row>
          <StatTile label="DURÉE" value={mmss(match.durationSec)} color={colors.statBounces} />
          <StatTile label="VITESSE BALLE MAX" value={speedLabel(match.stats.maxSpeed)} color={colors.statSpeed} />
        </Row>
        <Row>
          <StatTile label="BUTS D'AFFILÉE MAX" value={match.stats.maxStreak} color={colors.statStreak} />
          <StatTile label="ÉCHANGE LE + LONG" value={match.stats.longestRally} color={colors.statRally} />
        </Row>
        <StatusDot boxed ok>
          {match.status === 'INTERRUPTED' ? 'Match interrompu, enregistré sans vainqueur' : "Match enregistré dans l'historique"}
        </StatusDot>

        <View style={{ marginTop: 'auto', gap: 12 }}>
          <Button label="REJOUER" onPress={dismiss} />
          <Button
            label="RETOUR À L'ACCUEIL"
            bg={colors.white}
            height={50}
            size={11}
            flat
            onPress={() => {
              dismiss();
              router.navigate('/');
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function Confetti({ top }: { top: number }) {
  const bits: [number, number, string][] = [
    [24, 4, colors.apricot],
    [324, 24, colors.pink],
    [64, 64, colors.white],
    [284, 74, colors.apricot],
    [144, 14, colors.pink],
  ];
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top, left: 0, right: 0 }}>
      {bits.map(([x, y, c], i) => (
        <View key={i} style={{ position: 'absolute', left: `${(x / 390) * 100}%`, top: y, width: 12, height: 12, backgroundColor: c }} />
      ))}
    </View>
  );
}
