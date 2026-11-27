import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PixelIcon, type IconName } from '@/components/PixelIcon';
import { Button, ErrorText, P, Row, StatTile, T } from '@/components/ui';
import { useLive } from '@/lib/live';
import { colors } from '@/lib/theme';
import type { Match, Side } from '@/lib/types';
import { mmss, speedLabel, useNow } from '@/lib/useNow';

/** Tant qu'un bouton est tenu, la commande est renvoyée : la borne arrête la raquette si elle ne reçoit plus rien (400 ms). */
const REPEAT_MS = 150;

type Dir = -1 | 0 | 1;

/**
 * Manette du joueur 2 (la borne n'a de boutons que pour le joueur 1), du compte à rebours à la fin de la partie.
 * Paysage, tenu à deux mains : pouce gauche = HAUT, pouce droit = BAS, appui maintenu.
 * Rien ne défile et rien ne capte le toucher par-dessus les boutons (alertes en bandeau transparent, onglets masqués).
 * Les stats et « Fin du match » sont dans un panneau, pour ne pas les toucher par erreur en jouant.
 */
export function MatchManette({ match }: { match: Match }) {
  useKeepAwake(); // l'écran ne s'éteint pas pendant la partie
  const insets = useSafeAreaInsets();
  // Le système peut refuser le paysage (iOS 27+, rotation verrouillée…) : en portrait, HAUT en haut et BAS en bas.
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const { sendPad, padLatency, connected } = useLive();
  const side: Side = match.remote ?? 'right';
  const held = useRef<Dir>(0);
  const [active, setActive] = useState<Dir>(0);
  const [statsOpen, setStatsOpen] = useState(false);
  const now = useNow(true, 250);

  // Paysage le temps de la manette, retour en portrait ensuite (écran de fin, reste de l'appli).
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => undefined);
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
    };
  }, []);

  const release = useCallback(() => {
    if (!held.current) return;
    held.current = 0;
    setActive(0);
    sendPad(0);
  }, [sendPad]);

  // Appui maintenu : on renvoie la commande ; en quittant l'écran, la raquette s'arrête.
  useEffect(() => {
    const t = setInterval(() => {
      if (held.current) sendPad(held.current);
    }, REPEAT_MS);
    return () => {
      clearInterval(t);
      if (held.current) sendPad(0);
    };
  }, [sendPad]);

  // Appli en arrière-plan (appel, notification ouverte…), panneau des stats ouvert ou réseau coupé : on lâche tout.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') release();
    });
    return () => sub.remove();
  }, [release]);
  useEffect(() => {
    if (statsOpen || !connected) release();
  }, [statsOpen, connected, release]);

  function press(dir: -1 | 1) {
    if (!connected) return;
    held.current = dir;
    setActive(dir);
    sendPad(dir);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }
  function releaseDir(dir: -1 | 1) {
    if (held.current === dir) release(); // sinon l'autre bouton a pris la main entre-temps
  }

  const countdown =
    match.status === 'COUNTDOWN' && match.countdownEndsAt
      ? Math.max(0, Math.ceil((new Date(match.countdownEndsAt).getTime() - now) / 1000))
      : null;
  const elapsed = match.startedAt ? (now - new Date(match.startedAt).getTime()) / 1000 : 0;

  return (
    <View
      style={{
        flex: 1,
        flexDirection: landscape ? 'row' : 'column',
        backgroundColor: colors.cream,
        paddingLeft: Math.max(insets.left, 16),
        paddingRight: Math.max(insets.right, 16),
        paddingTop: Math.max(insets.top, 12),
        paddingBottom: Math.max(insets.bottom, 12),
        gap: 14,
      }}
    >
      <StatusBar hidden />
      <PadButton
        label="HAUT"
        icon="up"
        pressed={active === -1}
        disabled={!connected}
        onIn={() => press(-1)}
        onOut={() => releaseDir(-1)}
      />

      <View
        style={
          landscape
            ? { width: 232, justifyContent: 'space-between', alignItems: 'stretch', gap: 8 }
            : { alignItems: 'stretch', gap: 8 }
        }
      >
        <ScoreCard match={match} side={side} />
        <View
          style={{ alignItems: 'center', justifyContent: 'center', flex: landscape ? 1 : undefined, minHeight: 56 }}
          accessibilityLiveRegion="polite"
        >
          {countdown !== null ? (
            <>
              <P size={9}>PRÊT ?</P>
              <P
                size={44}
                color={colors.orange}
                style={{ textShadowColor: colors.ink, textShadowOffset: { width: 4, height: 4 }, textShadowRadius: 0.1 }}
              >
                {countdown || 'GO'}
              </P>
            </>
          ) : match.matchPoint ? (
            <View style={{ backgroundColor: colors.orange, borderWidth: 3, borderColor: colors.ink, padding: 8 }}>
              <P size={9}>BALLE DE MATCH !</P>
            </View>
          ) : (
            <P size={9}>EN DIRECT · {mmss(elapsed)}</P>
          )}
        </View>
        <Latency connected={connected} ms={padLatency} />
        <Button label="STATS & FIN" bg={colors.white} height={40} size={9} flat onPress={() => setStatsOpen(true)} />
      </View>

      <PadButton
        label="BAS"
        icon="down"
        pressed={active === 1}
        disabled={!connected}
        onIn={() => press(1)}
        onOut={() => releaseDir(1)}
      />

      <StatsPanel match={match} side={side} open={statsOpen} onClose={() => setStatsOpen(false)} />
    </View>
  );
}

function PadButton({
  label,
  icon,
  pressed,
  disabled,
  onIn,
  onOut,
}: {
  label: string;
  icon: IconName;
  pressed: boolean;
  disabled: boolean;
  onIn: () => void;
  onOut: () => void;
}) {
  // ombre dure qui « s'enfonce » à l'appui (5 px → 1 px), comme une touche de borne d'arcade
  const shadow = pressed ? 1 : 5;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Raquette vers le ${label.toLowerCase()}`}
      accessibilityState={{ disabled, selected: pressed }}
      onPressIn={onIn}
      onPressOut={onOut}
      style={{
        flex: 1,
        backgroundColor: disabled ? colors.lilac : pressed ? colors.orange : colors.pink,
        borderWidth: 4,
        borderColor: colors.ink,
        boxShadow: `${shadow}px ${shadow}px 0px ${colors.ink}`,
        transform: [{ translateX: 5 - shadow }, { translateY: 5 - shadow }],
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        marginRight: 5,
        marginBottom: 5,
      }}
    >
      <PixelIcon name={icon} color={colors.ink} size={56} />
      <P size={18}>{label}</P>
    </Pressable>
  );
}

function ScoreCard({ match, side }: { match: Match; side: Side }) {
  const cell = (s: Side) => (
    <View
      style={{
        flex: 1,
        backgroundColor: s === 'left' ? colors.mint : colors.pink,
        padding: 8,
        alignItems: 'center',
        gap: 6,
        borderLeftWidth: s === 'right' ? 3 : 0,
        borderColor: colors.ink,
      }}
    >
      <P size={8} numberOfLines={1}>
        {s === side ? 'TOI' : (match[s]?.pseudo ?? '???')}
      </P>
      <P size={26}>{match.score[s]}</P>
    </View>
  );
  return (
    <View
      style={{ flexDirection: 'row', borderWidth: 4, borderColor: colors.ink, backgroundColor: colors.white }}
      accessibilityLabel={`Score ${match.left?.pseudo ?? 'joueur 1'} ${match.score.left}, ${match.right?.pseudo ?? 'joueur 2'} ${match.score.right}`}
    >
      {cell('left')}
      {cell('right')}
    </View>
  );
}

/** Aller-retour téléphone → serveur → borne → téléphone (la borne renvoie pad_ack). */
function Latency({ connected, ms }: { connected: boolean; ms: number | null }) {
  const color = !connected ? colors.offline : ms === null ? colors.inkSoft : ms < 100 ? colors.online : ms < 200 ? colors.apricot : colors.offline;
  const text = !connected ? 'HORS LIGNE' : ms === null ? 'LATENCE —' : `LATENCE ${ms} MS`;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <View style={{ width: 10, height: 10, backgroundColor: color }} />
      <P size={8}>{text}</P>
    </View>
  );
}

/** Stats en direct et « Fin du match », à part pour ne pas les toucher par erreur pendant la partie. */
function StatsPanel({ match, side, open, onClose }: { match: Match; side: Side; open: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { requestEnd } = useLive();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iAsked = match.endRequests.includes(side);
  return (
    <Modal
      visible={open}
      animationType="fade"
      onRequestClose={onClose}
      // sans ça, iOS repasse en portrait pour afficher le panneau
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right', 'portrait']}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: colors.cream,
          paddingLeft: Math.max(insets.left, 20),
          paddingRight: Math.max(insets.right, 20),
          paddingTop: Math.max(insets.top, 14),
          paddingBottom: Math.max(insets.bottom, 14),
          gap: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <P size={11}>STATS DU MATCH</P>
          <Button label="RETOUR À LA MANETTE" height={40} size={9} onPress={onClose} style={{ width: 240 }} />
        </View>
        <ScrollView contentContainerStyle={{ flexDirection: width > height ? 'row' : 'column', gap: 14 }}>
          <View style={{ flex: 1, gap: 12 }}>
            <Row>
              <StatTile label="VITESSE BALLE MAX" value={speedLabel(match.stats.maxSpeed)} color={colors.statSpeed} />
              <StatTile label="BUTS D'AFFILÉE MAX" value={match.stats.maxStreak} color={colors.statStreak} />
            </Row>
            <Row>
              <StatTile label="ÉCHANGE LE + LONG" value={match.stats.longestRally} color={colors.statRally} />
              <StatTile label="REBONDS TOTAL" value={match.stats.totalBounces} color={colors.statBounces} />
            </Row>
          </View>
          <View style={{ flex: 1, gap: 10 }}>
            <View style={{ backgroundColor: colors.white, borderWidth: 4, borderColor: colors.ink, padding: 10, gap: 2 }}>
              <P size={9}>EN DIRECT</P>
              {match.feed.slice(0, 4).map((f, i) => (
                <T key={`${f.at}-${i}`} size={20} numberOfLines={1}>
                  {f.text}
                </T>
              ))}
            </View>
            <T size={18} color={colors.inkSoft}>
              {match.endRequests.length === 0
                ? 'La partie s’arrête quand les deux joueurs demandent la fin.'
                : `${match.endRequests.length} joueur sur 2 a demandé la fin.`}
            </T>
            <ErrorText>{error}</ErrorText>
            <Button
              label={iAsked ? 'FIN DEMANDÉE' : 'FIN DU MATCH'}
              bg={colors.pink}
              height={46}
              size={10}
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
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
