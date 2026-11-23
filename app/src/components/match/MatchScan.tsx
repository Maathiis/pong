import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useIsFocused } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button, ErrorText, P, StatusDot, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useLive } from '@/lib/live';
import { colors } from '@/lib/theme';
import { MatchScreen, PlayersCard, QrGlyph, Target } from './shared';

/** Contenu du QR code collé sur chaque borne : pong://borne/<id> (voir docs/CONTRAT-BORNE.md). */
export function parseBorneQr(data: string): string | null {
  const m = /^pong:\/\/borne\/([\w-]{1,32})\/?$/.exec(data.trim());
  return m ? m[1] : null;
}

export function MatchScan() {
  const { user } = useAuth();
  const { join, bornes, connected } = useLive();
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastScan = useRef<{ data: string; at: number } | null>(null);

  async function onScan({ data }: BarcodeScanningResult) {
    // la caméra renvoie le même code plusieurs fois par seconde : on ne traite qu'une fois
    const now = Date.now();
    if (joining || (lastScan.current?.data === data && now - lastScan.current.at < 3000)) return;
    lastScan.current = { data, at: now };

    const borneId = parseBorneQr(data);
    if (!borneId) return setError("Ce QR code n'est pas celui d'une borne Pong.");
    setError(null);
    setJoining(true);
    try {
      await join(borneId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setJoining(false);
    }
  }

  const onlineCount = Object.values(bornes).filter(Boolean).length;
  const canScan = permission?.granted && focused && !joining;

  return (
    <MatchScreen>
      <PlayersCard left={user?.pseudo ?? null} right={null} />

      <Target>
        {canScan ? (
          <CameraView
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onScan}
          />
        ) : joining ? (
          <ActivityIndicator color={colors.ink} size="large" />
        ) : (
          <QrGlyph />
        )}
      </Target>

      <View style={{ alignItems: 'center', gap: 10 }}>
        <P size={13} style={{ textAlign: 'center' }}>
          SCANNE LA BORNE
        </P>
        <T size={24} style={{ textAlign: 'center' }}>
          Vise le QR code collé sur la borne.
        </T>
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
        {permission && !permission.granted && (
          <Button
            label={permission.canAskAgain ? 'AUTORISER LA CAMÉRA' : 'CAMÉRA REFUSÉE (RÉGLAGES)'}
            onPress={requestPermission}
            disabled={!permission.canAskAgain}
          />
        )}
      </View>
    </MatchScreen>
  );
}
