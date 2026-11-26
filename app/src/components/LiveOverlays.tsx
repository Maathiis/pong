import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { P, T } from '@/components/ui';
import { useLive } from '@/lib/live';
import { block, colors } from '@/lib/theme';

const ALERT_BG = { speed: colors.orange, match_point: colors.apricot, borne_offline: colors.pink } as const;

/**
 * Au-dessus de tous les onglets :
 *  - bandeau « hors ligne » pendant une coupure réseau (la reconnexion est automatique) ;
 *  - bannière d'alerte (seuil de vitesse, balle de match, borne hors ligne), touchée pour fermer.
 */
export function LiveOverlays() {
  const insets = useSafeAreaInsets();
  const { connected, alert, dismissAlert } = useLive();
  return (
    <>
      <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 6, left: 12, right: 12 }}>
        {!connected && (
          <View
            accessibilityRole="alert"
            style={[
              block(3),
              {
                backgroundColor: colors.pink,
                paddingVertical: 6,
                paddingHorizontal: 10,
                flexDirection: 'row',
                gap: 10,
                alignItems: 'center',
              },
            ]}
          >
            <View style={{ width: 10, height: 10, backgroundColor: colors.offline }} />
            <P size={8} style={{ flex: 1 }}>
              HORS LIGNE · RECONNEXION…
            </P>
          </View>
        )}
      </View>
      {/* L'alerte s'affiche en bas, au-dessus des onglets, pour ne pas cacher le score. */}
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', bottom: 84 + insets.bottom + 10, left: 12, right: 12 }}
      >
        {alert && (
          <Pressable
            accessibilityRole="alert"
            accessibilityLabel={`${alert.title}. ${alert.body}`}
            onPress={dismissAlert}
            style={[block(4), { backgroundColor: ALERT_BG[alert.kind], padding: 12, gap: 4 }]}
          >
            <P size={11}>{alert.title}</P>
            <T size={21}>{alert.body}</T>
          </Pressable>
        )}
      </View>
    </>
  );
}
