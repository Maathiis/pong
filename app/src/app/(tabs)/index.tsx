import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cloud, ErrorText, P, Row, ShadowTitle, StatTile, StatusDot, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLive } from '@/lib/live';
import { block, colors } from '@/lib/theme';
import type { Stats } from '@/lib/types';

const RESULT_BG = { V: colors.lime, D: colors.pink } as const;

export default function Home() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { connected, bornes } = useLive();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setStats(await api.stats());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // recharge à chaque retour sur l'onglet (ex. après un match)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onlineCount = Object.values(bornes).filter(Boolean).length;
  const status = !connected
    ? 'Serveur injoignable'
    : onlineCount === 0
      ? 'Aucune borne en ligne · connecté'
      : `${onlineCount > 1 ? `${onlineCount} bornes` : 'Borne'} en ligne · connecté`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <View
        style={{
          backgroundColor: colors.sky,
          borderBottomWidth: 4,
          borderColor: colors.ink,
          paddingTop: insets.top + 16,
          paddingBottom: 18,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Cloud style={{ top: insets.top + 8, right: 120 }} />
        <View style={{ gap: 8 }}>
          <P size={10}>SALUT,</P>
          <ShadowTitle size={20}>{user?.pseudo ?? ''}</ShadowTitle>
        </View>
        <Avatar />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 18, gap: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <ErrorText>{error}</ErrorText>
        <Row>
          <StatTile big label="PARTIES" value={stats?.played ?? '-'} bg={colors.mint} />
          <StatTile big label="VICTOIRES" value={stats?.wins ?? '-'} bg={colors.lime} />
        </Row>
        <Row>
          <StatTile big label="DÉFAITES" value={stats?.losses ?? '-'} bg={colors.pink} />
          <StatTile
            big
            label="SÉRIE"
            value={stats?.streak ? `${stats.streak.count} ${stats.streak.result}` : '-'}
            bg={colors.apricot}
          />
        </Row>

        <View style={{ backgroundColor: colors.white, borderWidth: 4, borderColor: colors.ink, padding: 12, gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T size={21}>Taux de victoire</T>
            <T size={21} style={{ fontWeight: 'bold' }}>
              {stats ? `${stats.winRate} %` : '-'}
            </T>
          </Row>
          <View style={{ height: 16, backgroundColor: colors.cream, borderWidth: 3, borderColor: colors.ink }}>
            <View style={{ width: `${stats?.winRate ?? 0}%`, height: '100%', backgroundColor: colors.orange }} />
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <P size={10}>{stats?.recent.length === 1 ? 'DERNIER MATCH' : stats?.recent.length ? `${stats.recent.length} DERNIERS MATCHS` : 'DERNIERS MATCHS'}</P>
          {stats?.recent.length === 0 && (
            <T size={21} color={colors.inkSoft}>
              Pas encore de match. Va dans l'onglet MATCH et scanne la borne !
            </T>
          )}
          {stats?.recent.map((m) => (
            <View
              key={m.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                backgroundColor: colors.white,
                borderWidth: 3,
                borderColor: colors.ink,
                paddingVertical: 6,
                paddingHorizontal: 10,
              }}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: m.result ? RESULT_BG[m.result] : colors.lilac,
                  borderWidth: 3,
                  borderColor: colors.ink,
                }}
              >
                <P size={11}>{m.result ?? '-'}</P>
              </View>
              <T size={23} style={{ flex: 1 }} numberOfLines={1}>
                {m.me}{' '}
                <T size={23} style={{ fontWeight: 'bold' }}>
                  {m.scoreMe}-{m.scoreOpponent}
                </T>{' '}
                {m.opponent}
              </T>
              <T size={18}>{m.status === 'INTERRUPTED' ? 'interrompu' : relativeDay(m.endedAt)}</T>
            </View>
          ))}
        </View>

        <StatusDot ok={connected && onlineCount > 0}>{status}</StatusDot>
      </ScrollView>
    </View>
  );
}

function Avatar() {
  return (
    <View
      accessible={false}
      style={[
        block(4),
        { width: 56, height: 56, backgroundColor: colors.apricot, alignItems: 'center', justifyContent: 'center' },
      ]}
    >
      <View style={{ width: 24, height: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ width: 8, height: 8, backgroundColor: colors.ink }} />
        ))}
      </View>
    </View>
  );
}

function relativeDay(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const days = Math.round(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86_400_000,
  );
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} j`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
