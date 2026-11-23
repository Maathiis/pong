import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { block, colors, fonts } from '@/lib/theme';

/** Texte pixel (Press Start 2P) : titres, étiquettes, chiffres. */
export function P({ size = 10, color = colors.ink, style, ...rest }: TextProps & { size?: number; color?: string }) {
  return (
    <Text
      {...rest}
      style={[{ fontFamily: fonts.pixel, fontSize: size, color, lineHeight: Math.round(size * 1.45) }, style]}
    />
  );
}

/** Texte courant (VT323). */
export function T({ size = 22, color = colors.ink, style, ...rest }: TextProps & { size?: number; color?: string }) {
  return <Text {...rest} style={[{ fontFamily: fonts.mono, fontSize: size, color, lineHeight: size * 1.1 }, style]} />;
}

/** Fond crème, sans marge du haut : le bandeau gère la zone de la caméra frontale. */
export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flex: 1, backgroundColor: colors.cream }, style]}>{children}</View>;
}

/** Petit nuage pixel (rectangles blancs). */
export function Cloud({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[{ position: 'absolute' }, style]}>
      <View style={{ width: 48, height: 10, backgroundColor: colors.white }} />
      <View style={{ position: 'absolute', left: 10, top: -8, width: 48, height: 10, backgroundColor: colors.white }} />
    </View>
  );
}

/** Bandeau du haut (ciel bleu, titre pixel avec ombre). */
export function Header({ title, color = colors.sky, children }: { title?: string; color?: string; children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: color,
        borderBottomWidth: 4,
        borderColor: colors.ink,
        paddingTop: insets.top + 16,
        paddingBottom: 16,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Cloud style={{ top: insets.top + 10, left: 24 }} />
      {title ? <ShadowTitle size={16}>{title}</ShadowTitle> : null}
      {children}
    </View>
  );
}

/** Titre blanc avec ombre portée violette (effet borne d'arcade). */
export function ShadowTitle({ children, size = 16, offset = 3 }: { children: ReactNode; size?: number; offset?: number }) {
  return (
    <P
      size={size}
      color={colors.white}
      style={{ textShadowColor: colors.ink, textShadowOffset: { width: offset, height: offset }, textShadowRadius: 0.1 }}
    >
      {children}
    </P>
  );
}

export function Card({
  children,
  bg = colors.white,
  shadow = 4,
  style,
}: {
  children: ReactNode;
  bg?: string;
  shadow?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[block(shadow), { backgroundColor: bg, padding: 12 }, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  bg = colors.orange,
  height = 58,
  size = 12,
  disabled,
  loading,
  flat,
  style,
}: {
  label: string;
  onPress?: () => void;
  bg?: string;
  height?: number;
  size?: number;
  disabled?: boolean;
  loading?: boolean;
  flat?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          height,
          backgroundColor: bg,
          borderWidth: 4,
          borderColor: colors.ink,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
          // bouton « physique » : l'ombre du dessous disparaît quand on appuie
          boxShadow: flat || pressed ? undefined : `0px 6px 0px ${colors.ink}`,
          transform: [{ translateY: pressed && !flat ? 6 : 0 }],
          marginBottom: flat ? 0 : 6,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={colors.ink} /> : <P size={size}>{label}</P>}
    </Pressable>
  );
}

/** Interrupteur pixel (vert + curseur à droite = activé). */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      hitSlop={10}
      style={{
        width: 48,
        height: 24,
        borderWidth: 3,
        borderColor: colors.ink,
        backgroundColor: value ? colors.lime : colors.lilac,
        flexDirection: 'row',
        justifyContent: value ? 'flex-end' : 'flex-start',
      }}
    >
      <View style={{ width: 16, backgroundColor: colors.ink }} />
    </Pressable>
  );
}

/** Carte de stat : petite étiquette pixel + gros chiffre. */
export function StatTile({
  label,
  value,
  color = colors.ink,
  bg = colors.white,
  big,
}: {
  label: string;
  value: string | number;
  color?: string;
  bg?: string;
  big?: boolean;
}) {
  return (
    <Card bg={bg} shadow={big ? 5 : 4} style={{ flex: 1, gap: 6, paddingVertical: big ? 12 : 10 }}>
      <P size={big ? 9 : 8}>{label}</P>
      <P size={big ? 26 : 20} color={color}>
        {value}
      </P>
    </Card>
  );
}

export function Row({ children, gap = 12, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', gap }, style]}>{children}</View>;
}

/** Pastille de statut (carré vert / rouge) + texte. */
export function StatusDot({ ok, children, boxed }: { ok: boolean; children: ReactNode; boxed?: boolean }) {
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 12, height: 12, backgroundColor: ok ? colors.online : colors.offline }} />
      <T size={boxed ? 22 : 20} style={{ flexShrink: 1 }}>
        {children}
      </T>
    </View>
  );
  if (!boxed) return content;
  return <View style={[styles.boxed]}>{content}</View>;
}

export function ErrorText({ children, style }: { children?: string | null; style?: StyleProp<TextStyle> }) {
  if (!children) return null;
  return (
    <T size={20} color={colors.offline} style={style} accessibilityLiveRegion="polite">
      {children}
    </T>
  );
}

const styles = StyleSheet.create({
  boxed: {
    backgroundColor: colors.white,
    borderWidth: 4,
    borderColor: colors.ink,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
});
