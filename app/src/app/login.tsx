import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Cloud, ErrorText, P, ShadowTitle, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { colors, fonts } from '@/lib/theme';

type Mode = 'login' | 'signup';

export default function Login() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('signup');
  const [pseudo, setPseudo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const signup = mode === 'signup';

  async function submit() {
    setError(null);
    if (signup && !consent) return setError('Coche la case pour accepter que ton pseudo soit visible.');
    setLoading(true);
    try {
      if (signup) await signUp(pseudo, email, password, consent);
      else await signIn(email, password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.cream }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View
          style={{
            backgroundColor: colors.sky,
            borderBottomWidth: 4,
            borderColor: colors.ink,
            paddingTop: insets.top + 28,
            paddingBottom: 28,
            alignItems: 'center',
            gap: 14,
          }}
        >
          <Cloud style={{ top: insets.top + 12, left: 28 }} />
          <Cloud style={{ top: insets.top + 68, right: 40 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }} accessible={false}>
            <View style={{ width: 12, height: 56, backgroundColor: colors.mint, borderWidth: 3, borderColor: colors.ink }} />
            <View style={{ width: 18, height: 18, backgroundColor: colors.apricot, borderWidth: 3, borderColor: colors.ink }} />
            <View style={{ width: 12, height: 56, backgroundColor: colors.pink, borderWidth: 3, borderColor: colors.ink }} />
          </View>
          <ShadowTitle size={44} offset={5}>
            PONG
          </ShadowTitle>
          <P size={10} style={{ letterSpacing: 2 }}>
            BORNE CONNECTÉE
          </P>
        </View>

        <View style={{ flex: 1, padding: 24, paddingBottom: insets.bottom + 24, gap: 18 }}>
          <View style={{ flexDirection: 'row', borderWidth: 4, borderColor: colors.ink, backgroundColor: colors.white }}>
            {(['login', 'signup'] as const).map((m) => (
              <Pressable
                key={m}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === m }}
                onPress={() => {
                  setMode(m);
                  setError(null);
                }}
                style={{
                  flex: 1,
                  height: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: mode === m ? colors.orange : 'transparent',
                }}
              >
                <P size={11}>{m === 'login' ? 'CONNEXION' : 'INSCRIPTION'}</P>
              </Pressable>
            ))}
          </View>

          {signup && (
            <Field
              label="PSEUDO (SUR LA BORNE)"
              value={pseudo}
              onChangeText={(v) => setPseudo(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="NATHAN"
              maxLength={8}
              autoCapitalize="characters"
            />
          )}
          <Field
            label="E-MAIL"
            value={email}
            onChangeText={setEmail}
            placeholder="toi@mail.fr"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Field
            label="MOT DE PASSE"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoComplete={signup ? 'new-password' : 'current-password'}
            onSubmitEditing={submit}
          />

          {signup && (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consent }}
              onPress={() => setConsent(!consent)}
              style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderWidth: 3,
                  borderColor: colors.ink,
                  backgroundColor: consent ? colors.orange : colors.white,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {consent && <View style={{ width: 8, height: 8, backgroundColor: colors.ink }} />}
              </View>
              <T size={20} style={{ flex: 1 }}>
                J'accepte que mon pseudo et mon score soient visibles publiquement (RGPD). Je peux supprimer mon compte à
                tout moment.
              </T>
            </Pressable>
          )}

          <ErrorText>{error}</ErrorText>
          <Button label={signup ? 'CRÉER MON COMPTE' : 'JOUER !'} size={14} height={60} onPress={submit} loading={loading} />

          <View style={{ marginTop: 'auto', alignItems: 'center', gap: 6 }}>
            <T size={20} color={colors.inkSoft}>
              Le tableau des scores reste visible sans compte.
            </T>
            <Link href="/scores" asChild>
              <Pressable accessibilityRole="link" hitSlop={8} style={{ padding: 6 }}>
                <P size={10} style={{ textDecorationLine: 'underline' }}>
                  VOIR LES SCORES &gt;
                </P>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, ...input }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ gap: 8 }}>
      <P size={10}>{label}</P>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#A99BC4"
        autoCorrect={false}
        {...input}
        style={{
          height: 52,
          backgroundColor: colors.white,
          borderWidth: 4,
          borderColor: colors.ink,
          color: colors.ink,
          fontFamily: fonts.mono,
          fontSize: 26,
          paddingHorizontal: 14,
        }}
      />
    </View>
  );
}
