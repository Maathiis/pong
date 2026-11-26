import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';
import { Button, ErrorText, P, StatusDot, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useLive } from '@/lib/live';
import { colors } from '@/lib/theme';
import { MatchScreen, PlayersCard, QrGlyph, Target } from './shared';

/** QR code affiché sur la matrice de la borne : « PONG: » + 8 caractères (voir docs/CONTRAT-BORNE.md). */
export function isJoinCode(data: string) {
  return /^PONG:[2-9A-HJ-NP-Z]{8}$/i.test(data.trim());
}

/**
 * Rejoindre une partie : la borne affiche un QR code sur sa matrice 24 × 24, le joueur le scanne.
 * Le code change à chaque joueur qui rejoint : il faut être devant la borne pour jouer.
 */
export function MatchScan() {
  const { user } = useAuth();
  const { join, bornes, connected } = useLive();
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastScan = useRef<{ data: string; at: number } | null>(null);

  // demande l'accès à la caméra dès l'arrivée sur l'écran, sans attendre un appui sur le bouton
  useEffect(() => {
    if (focused && permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [focused, permission, requestPermission]);

  async function onScan({ data }: BarcodeScanningResult) {
    // la caméra renvoie le même code plusieurs fois par seconde : on ne traite qu'une fois
    const now = Date.now();
    if (busy || (lastScan.current?.data === data && now - lastScan.current.at < 3000)) return;
    lastScan.current = { data, at: now };
    if (!isJoinCode(data)) return setError("Ce QR code n'est pas celui d'une borne Pong.");
    setError(null);
    setBusy(true);
    try {
      await join(data.trim());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const onlineCount = Object.values(bornes).filter(Boolean).length;
  const camera = permission?.granted && focused && !busy;

  return (
    <MatchScreen>
      <PlayersCard left={user?.pseudo ?? null} right={null} />

      <Target>
        {camera ? (
          <CameraView
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onScan}
            onMountError={(e) => setError(`Caméra indisponible : ${e.message}`)}
          />
        ) : busy ? (
          <ActivityIndicator color={colors.ink} size="large" />
        ) : (
          <QrGlyph />
        )}
      </Target>

      {permission && !permission.granted && (
        <View style={{ alignSelf: 'stretch' }}>
          {/* accès refusé définitivement : seul le menu Réglages du téléphone permet de le rendre */}
          <Button
            label={permission.canAskAgain ? 'AUTORISER LA CAMÉRA' : 'OUVRIR LES RÉGLAGES'}
            onPress={permission.canAskAgain ? requestPermission : () => Linking.openSettings()}
          />
        </View>
      )}

      <View style={{ alignItems: 'center', gap: 10 }}>
        <P size={13} style={{ textAlign: 'center' }}>
          SCANNE LA BORNE
        </P>
        <T size={20} color={colors.inkSoft} style={{ textAlign: 'center' }}>
          Le premier qui scanne joue à gauche.
        </T>
        <ErrorText style={{ textAlign: 'center' }}>{error}</ErrorText>
      </View>

      <View style={{ alignSelf: 'stretch', marginTop: 'auto', gap: 12 }}>
        <StatusDot boxed ok={connected && onlineCount > 0}>
          {!connected
            ? 'Serveur injoignable'
            : onlineCount
              ? `${onlineCount > 1 ? `${onlineCount} bornes` : 'Borne'} en ligne · prête`
              : 'Aucune borne en ligne'}
        </StatusDot>
      </View>
    </MatchScreen>
  );
}
