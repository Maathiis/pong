import { useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Button, Card, ErrorText, Header, P, T, Toggle } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { defaultServerUrl, getServerUrl, setServerUrl } from '@/lib/config';
import { useLive } from '@/lib/live';
import { colors, fonts } from '@/lib/theme';
import type { Settings } from '@/lib/types';
import { speedLabel } from '@/lib/useNow';

export default function Reglages() {
  const { user, setUser, signOut } = useAuth();
  const { refresh } = useLive();
  const [error, setError] = useState<string | null>(null);
  const [server, setServer] = useState(getServerUrl());
  const [editingServer, setEditingServer] = useState(false);

  async function toggle<K extends keyof Settings>(key: K, value: Settings[K]) {
    if (!user) return;
    setError(null);
    setUser({ ...user, settings: { ...user.settings, [key]: value } }); // affichage immédiat
    try {
      setUser(await api.updateSettings({ [key]: value }));
    } catch (e) {
      setUser(user);
      setError((e as Error).message);
    }
  }

  async function saveServer() {
    const url = await setServerUrl(server);
    setServer(url);
    setEditingServer(false);
    Alert.alert(
      'Adresse enregistrée',
      `L'appli utilisera ${url}.\nRelance l'appli si la connexion temps réel ne revient pas.`,
    );
    refresh().catch(() => undefined);
  }

  function confirmDelete() {
    Alert.alert('Supprimer ton compte ?', "Ton pseudo, tes scores et ton historique seront effacés. C'est définitif.", [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteAccount();
            await signOut();
          } catch (e) {
            setError((e as Error).message);
          }
        },
      },
    ]);
  }

  if (!user) return null;
  const s = user.settings;

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <Header title="RÉGLAGES" />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 20, paddingTop: 16, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View
            style={{ width: 52, height: 52, backgroundColor: colors.apricot, borderWidth: 4, borderColor: colors.ink }}
          />
          <View style={{ gap: 4, flex: 1 }}>
            <P size={14}>{user.pseudo}</P>
            <T size={20} color={colors.inkSoft} numberOfLines={1}>
              {user.email}
            </T>
          </View>
        </Card>

        <Section title="ALERTES">
          <Line label="Borne hors ligne">
            <Toggle label="Borne hors ligne" value={s.alertOffline} onChange={(v) => toggle('alertOffline', v)} />
          </Line>
          <Line label="Balle plus rapide que…">
            <Toggle
              label="Balle plus rapide que le seuil"
              value={s.alertSpeedRecord}
              onChange={(v) => toggle('alertSpeedRecord', v)}
            />
          </Line>
          {s.alertSpeedRecord && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 12,
                paddingBottom: 10,
                borderBottomWidth: 3,
                borderColor: colors.ink,
              }}
            >
              <T size={20} color={colors.inkSoft}>
                Seuil d'alerte
              </T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Step
                  label="Baisser le seuil"
                  sign="-"
                  disabled={s.speedAlertThreshold <= 1.5}
                  onPress={() => toggle('speedAlertThreshold', Math.round((s.speedAlertThreshold - 0.5) * 10) / 10)}
                />
                <P size={12} style={{ minWidth: 56, textAlign: 'center' }}>
                  {speedLabel(s.speedAlertThreshold)}
                </P>
                <Step
                  label="Monter le seuil"
                  sign="+"
                  disabled={s.speedAlertThreshold >= 5}
                  onPress={() => toggle('speedAlertThreshold', Math.round((s.speedAlertThreshold + 0.5) * 10) / 10)}
                />
              </View>
            </View>
          )}
          <Line label="Balle de match" last>
            <Toggle label="Balle de match" value={s.alertMatchPoint} onChange={(v) => toggle('alertMatchPoint', v)} />
          </Line>
        </Section>

        <Section title="APPLI">
          <Line label="Sons rétro">
            <Toggle label="Sons rétro" value={s.retroSounds} onChange={(v) => toggle('retroSounds', v)} />
          </Line>
          <Line label="Adresse du serveur" last onPress={() => setEditingServer(true)}>
            {!editingServer && (
              <T size={20} color={colors.inkSoft} numberOfLines={1} style={{ maxWidth: 170 }}>
                {server.replace(/^https?:\/\//, '')}
              </T>
            )}
          </Line>
          {editingServer && (
            <View style={{ padding: 12, paddingTop: 0, gap: 10 }}>
              <TextInput
                value={server}
                onChangeText={setServer}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder={defaultServerUrl()}
                accessibilityLabel="Adresse du serveur"
                style={{
                  height: 48,
                  borderWidth: 3,
                  borderColor: colors.ink,
                  paddingHorizontal: 10,
                  fontFamily: fonts.mono,
                  fontSize: 22,
                  color: colors.ink,
                }}
              />
              <T size={18} color={colors.inkSoft}>
                Laisse vide pour revenir à {defaultServerUrl()}.
              </T>
              <Button label="ENREGISTRER" height={44} size={10} onPress={saveServer} />
            </View>
          )}
        </Section>

        <ErrorText>{error}</ErrorText>

        <View style={{ marginTop: 'auto', gap: 12 }}>
          <Button label="SE DÉCONNECTER" bg={colors.white} height={52} size={11} flat onPress={signOut} />
          <Button label="SUPPRIMER MON COMPTE" bg={colors.pink} height={52} size={10} onPress={confirmDelete} />
          <T size={18} color={colors.inkSoft} style={{ textAlign: 'center' }}>
            Supprime ton pseudo, tes scores et ton historique (RGPD).
          </T>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <P size={10}>{title}</P>
      <View style={{ backgroundColor: colors.white, borderWidth: 3, borderColor: colors.ink }}>{children}</View>
    </View>
  );
}

function Line({
  label,
  children,
  last,
  onPress,
}: {
  label: string;
  children?: React.ReactNode;
  last?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderBottomWidth: last ? 0 : 3,
        borderColor: colors.ink,
        minHeight: 44,
      }}
    >
      <T size={22}>{label}</T>
      {children}
    </Pressable>
  );
}

function Step({
  sign,
  label,
  onPress,
  disabled,
}: {
  sign: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={{
        width: 34,
        height: 34,
        borderWidth: 3,
        borderColor: colors.ink,
        backgroundColor: colors.apricot,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <P size={12}>{sign}</P>
    </Pressable>
  );
}
