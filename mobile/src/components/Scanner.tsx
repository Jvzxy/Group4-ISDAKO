// Scans ISDAKO QR codes and passes the extracted token to the parent for handling.

import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { tokenFromQr } from '../qr';
import { useTheme } from '../ThemeContext';
import { Button, Muted } from '../ui';

const DEFAULT_HINT = 'Point the camera at the QR code.';

export function Scanner({
  onToken,
  hint = DEFAULT_HINT,
}: {
  /** Receives the QR token once per scan; scanning pauses until this callback completes. */
  onToken: (token: string) => void | Promise<void>;
  hint?: string;
}) {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [message, setMessage] = useState(hint);
  const busy = useRef(false);
  const lastWrongAt = useRef(0);

  const onScanned = useCallback(
    (result: { data: string }) => {
      if (busy.current) return;

      const token = tokenFromQr(result.data);

      if (!token) {
        // Repeated camera results are common, so limit how often an invalid-code message appears.
        const now = Date.now();

        if (now - lastWrongAt.current > 2500) {
          lastWrongAt.current = now;
          setMessage('That is not an ISDAKO QR code. Try another one.');
        }

        return;
      }

      busy.current = true;
      setMessage(hint);

      void (async () => {
        try {
          await onToken(token);
        } finally {
          // Pause briefly before scanning again to avoid immediately repeating a failed lookup.
          setTimeout(() => {
            busy.current = false;
          }, 1500);
        }
      })();
    },
    [hint, onToken],
  );

  if (permission === null) {
    return (
      <View style={[styles.box, styles.center, { backgroundColor: colors.abyss }]}>
        <ActivityIndicator color={colors.yellow} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View
        style={[
          styles.permission,
          {
            borderColor: colors.line,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <Text style={[styles.permissionTitle, { color: colors.abyss }]}>
          Camera access is needed
        </Text>

        <Muted>
          {permission.canAskAgain
            ? 'ISDAKO uses the camera only to read QR codes.'
            : "Camera access is turned off. Turn it on for this app in your phone's Settings, then come back."}
        </Muted>

        {permission.canAskAgain ? (
          <Button
            title="Allow camera"
            onPress={() => void requestPermission()}
          />
        ) : (
          <Button
            title="Open Settings"
            onPress={() => void Linking.openSettings()}
          />
        )}
      </View>
    );
  }

  return (
    <View>
      <View style={[styles.box, { backgroundColor: colors.abyss }]}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={onScanned}
        />

        <View style={[styles.frame, { borderColor: colors.yellow }]} />
      </View>

      <Text
        style={[styles.message, { color: colors.muted }]}
        accessibilityLiveRegion="polite"
      >
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    aspectRatio: 1,
    maxHeight: 340,
    width: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 18,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    position: 'absolute',
    top: '15%',
    left: '15%',
    right: '15%',
    bottom: '15%',
    borderWidth: 4,
    borderRadius: 18,
  },
  message: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 21,
  },
  permission: {
    gap: 12,
    padding: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 14,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
});
