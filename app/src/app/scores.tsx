import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ErrorText, Header, P, T } from '@/components/ui';
import { api } from '@/lib/api';
import { colors } from '@/lib/theme';
import type { Leaderboard } from '@/lib/types';

const MEDALS = [colors.apricot, colors.mint, colors.pink];

/** Tableau des scores public (accessible sans compte). */
export default function Scores() {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<Leaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRows(await api.leaderboard());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <Header title="SCORES" />
      <FlatList
        data={rows ?? []}
        keyExtractor={(r) => r.pseudo}
        contentContainerStyle={{ padding: 20, gap: 8 }}
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
        ListHeaderComponent={
          <View style={{ gap: 8, marginBottom: 4 }}>
            <ErrorText>{error}</ErrorText>
            {!rows && !error && <ActivityIndicator color={colors.ink} />}
            {rows?.length === 0 && <T>Aucun match terminé pour l'instant.</T>}
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: colors.white,
              borderWidth: 3,
              borderColor: colors.ink,
              paddingVertical: 8,
              paddingHorizontal: 10,
            }}
          >
            <View
              style={{
                width: 34,
                height: 34,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: MEDALS[item.rank - 1] ?? colors.lilac,
                borderWidth: 3,
                borderColor: colors.ink,
              }}
            >
              <P size={11}>{item.rank}</P>
            </View>
            <P size={12} style={{ flex: 1 }}>
              {item.pseudo}
            </P>
            <T size={22}>
              {item.wins} V · {item.played} J · {item.winRate} %
            </T>
          </View>
        )}
      />
      <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 16 }}>
        <Button label="RETOUR" bg={colors.white} height={50} size={11} onPress={() => router.back()} />
      </View>
    </View>
  );
}
