import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Card, Header, P } from '@/components/ui';
import { block, colors } from '@/lib/theme';

export function MatchScreen({ children, header = 'MATCH' }: { children: ReactNode; header?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <Header title={header} />
      <View style={{ flex: 1, padding: 20, paddingTop: 18, gap: 18, alignItems: 'center' }}>{children}</View>
    </View>
  );
}

/** Carte « JOUEUR 1 VS JOUEUR 2 » ; un joueur absent s'affiche « ??? » en pointillés. */
export function PlayersCard({ left, right }: { left: string | null; right: string | null }) {
  return (
    <Card style={{ alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ gap: 6 }}>
        <P size={9}>JOUEUR 1</P>
        <PseudoTag pseudo={left} bg={colors.mint} />
      </View>
      <P size={14}>VS</P>
      <View style={{ gap: 6, alignItems: 'flex-end' }}>
        <P size={9}>JOUEUR 2</P>
        <PseudoTag pseudo={right} bg={colors.pink} />
      </View>
    </Card>
  );
}

function PseudoTag({ pseudo, bg }: { pseudo: string | null; bg: string }) {
  return (
    <View
      style={{
        borderWidth: 3,
        borderColor: colors.ink,
        borderStyle: pseudo ? 'solid' : 'dashed',
        backgroundColor: pseudo ? bg : 'transparent',
        paddingVertical: 4,
        paddingHorizontal: 8,
      }}
    >
      <P size={14}>{pseudo ?? '???'}</P>
    </View>
  );
}

/** Cible orange en pointillés (anneaux) avec un contenu au centre : viseur caméra ou pictogramme. */
export function Target({ children, size = 250 }: { children: ReactNode; size?: number }) {
  const ring = (inset: number, opacity: number) => (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: inset,
        left: inset,
        right: inset,
        bottom: inset,
        borderWidth: 6,
        borderStyle: 'dashed',
        borderColor: colors.orange,
        opacity,
      }}
    />
  );
  return (
    <View style={{ width: size, height: size }}>
      {ring(0, 0.45)}
      {ring(30, 0.75)}
      <View
        style={[
          block(5),
          {
            position: 'absolute',
            top: 60,
            left: 60,
            right: 60,
            bottom: 60,
            backgroundColor: colors.apricot,
            borderWidth: 6,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

/** Pictogramme QR code pixel (celui de la maquette). */
export function QrGlyph({ size = 72 }: { size?: number }) {
  const u = size / 12;
  const r = (x: number, y: number, w: number, h: number, c: string, k: number) => (
    <View key={k} style={{ position: 'absolute', left: x * u, top: y * u, width: w * u, height: h * u, backgroundColor: c }} />
  );
  return (
    <View style={{ width: size, height: size }} accessible={false}>
      {[
        r(3, 2, 6, 8, colors.cream, 0),
        r(3, 1, 6, 1, colors.ink, 1),
        r(2, 2, 1, 8, colors.ink, 2),
        r(9, 2, 1, 8, colors.ink, 3),
        r(3, 10, 6, 1, colors.ink, 4),
        r(4, 4, 1, 1, colors.ink, 5),
        r(5, 5, 1, 2, colors.ink, 6),
        r(4, 7, 1, 1, colors.ink, 7),
        r(7, 4, 1, 4, colors.ink, 8),
      ]}
    </View>
  );
}
