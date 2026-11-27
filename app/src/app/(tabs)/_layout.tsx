import { TabList, Tabs, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LiveOverlays } from '@/components/LiveOverlays';
import { PixelIcon, type IconName } from '@/components/PixelIcon';
import { P } from '@/components/ui';
import { LiveProvider, useLive } from '@/lib/live';
import { colors } from '@/lib/theme';

/** Barre d'onglets violette des maquettes : ACCUEIL / MATCH / RÉGLAGES. */
export default function TabsLayout() {
  return (
    <LiveProvider>
      <TabsNav />
      <LiveOverlays />
    </LiveProvider>
  );
}

function TabsNav() {
  const insets = useSafeAreaInsets();
  // Manette du joueur 2 : plein écran en paysage, pas d'onglet à toucher par erreur pendant la partie.
  const { manette } = useLive();
  return (
    <Tabs style={{ flex: 1, backgroundColor: colors.cream }}>
      <TabSlot />
      <TabList
        style={{
          flexDirection: 'row',
          height: manette ? 0 : 84 + insets.bottom,
          paddingBottom: manette ? 0 : insets.bottom,
          overflow: 'hidden',
          backgroundColor: colors.ink,
        }}
      >
        <TabTrigger name="index" href="/" asChild>
          <TabButton icon="home" label="ACCUEIL" />
        </TabTrigger>
        <TabTrigger name="match" href="/match" asChild>
          <TabButton icon="match" label="MATCH" />
        </TabTrigger>
        <TabTrigger name="reglages" href="/reglages" asChild>
          <TabButton icon="settings" label="RÉGLAGES" />
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}

type TabButtonProps = TabTriggerSlotProps & { icon: IconName; label: string };

function TabButton({ icon, label, isFocused, ref: _ref, ...props }: TabButtonProps) {
  const fg = isFocused ? colors.ink : colors.cream;
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: isFocused ? colors.orange : 'transparent',
      }}
    >
      <PixelIcon name={icon} color={fg} />
      <P size={9} color={fg}>
        {label}
      </P>
    </Pressable>
  );
}
