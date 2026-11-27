import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ErrorText, Header, P, Row, StatTile, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';
import type { Match, Side } from '@/lib/types';
import { mmss, speedLabel } from '@/lib/useNow';

/** Détail d'une partie de l'historique : résultat, stats et déroulé complet (ouvert depuis « Derniers matchs »). */
export default function PartieDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .match(id)
      .then(setMatch)
      .catch((e: Error) => setError(e.message));
  }, [id]);

  const mySide: Side | null = !match ? null : match.left?.id === user?.id ? 'left' : match.right?.id === user?.id ? 'right' : null;
  const result =
    match?.status === 'FINISHED'
      ? match.winner === mySide
        ? { label: 'VICTOIRE', bg: colors.lime }
        : { label: 'DÉFAITE', bg: colors.pink }
      : { label: 'INTERROMPUE', bg: colors.lilac };

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <Header title="PARTIE" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: insets.bottom + 20 }}>
        <ErrorText>{error}</ErrorText>
        {!match && !error && <ActivityIndicator color={colors.ink} />}
        {match && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <View style={{ backgroundColor: result.bg, borderWidth: 3, borderColor: colors.ink, paddingVertical: 6, paddingHorizontal: 10 }}>
                <P size={11}>{result.label}</P>
              </View>
              <T size={20} color={colors.inkSoft}>
                {match.endedAt ? new Date(match.endedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                {' · '}
                {match.borneId}
                {match.vsBot ? ' · contre le bot' : match.remote ? ' · joueur 2 au téléphone' : ''}
              </T>
            </View>

            <View style={{ flexDirection: 'row', borderWidth: 4, borderColor: colors.ink }}>
              {(['left', 'right'] as const).map((s) => (
                <View
                  key={s}
                  style={{
                    flex: 1,
                    padding: 12,
                    gap: 8,
                    alignItems: 'center',
                    backgroundColor: s === 'left' ? colors.mint : colors.pink,
                    borderLeftWidth: s === 'right' ? 3 : 0,
                    borderColor: colors.ink,
                  }}
                >
                  <P size={10} numberOfLines={1}>
                    {match[s]?.pseudo ?? 'ANCIEN'}
                    {s === mySide ? ' (TOI)' : ''}
                  </P>
                  <P size={32}>{match.score[s]}</P>
                </View>
              ))}
            </View>

            <Row>
              <StatTile label="DURÉE" value={mmss(match.durationSec)} color={colors.statBounces} />
              <StatTile label="VITESSE BALLE MAX" value={speedLabel(match.stats.maxSpeed)} color={colors.statSpeed} />
            </Row>
            <Row>
              <StatTile label="BUTS D'AFFILÉE MAX" value={match.stats.maxStreak} color={colors.statStreak} />
              <StatTile label="ÉCHANGE LE + LONG" value={match.stats.longestRally} color={colors.statRally} />
            </Row>
            <Row>
              <StatTile label="REBONDS TOTAL" value={match.stats.totalBounces} color={colors.statBounces} />
            </Row>

            <View style={{ backgroundColor: colors.white, borderWidth: 4, borderColor: colors.ink, padding: 12, gap: 4 }}>
              <P size={9}>DÉROULÉ</P>
              {[...match.feed].reverse().map((f, i) => (
                <View key={`${f.at}-${i}`} style={{ flexDirection: 'row', gap: 10 }}>
                  <T size={19} color={colors.inkSoft}>
                    {new Date(f.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </T>
                  <T size={21} style={{ flex: 1 }}>
                    {f.text}
                  </T>
                </View>
              ))}
            </View>
          </>
        )}
        <Button label="RETOUR" bg={colors.white} height={50} size={11} flat onPress={() => router.back()} />
      </ScrollView>
    </View>
  );
}
