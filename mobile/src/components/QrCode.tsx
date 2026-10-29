import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { qrValue } from '../qr';
import { colors } from '../theme';

/** A fisher's QR code. It is drawn on the phone, so it also works with no signal. */
export function QrCode({ token, size = 220 }: { token: string; size?: number }) {
  return (
    <View style={styles.frame} accessibilityLabel="QR code" accessible>
      <QRCode value={qrValue(token)} size={size} ecl="M" color="#000000" backgroundColor="#ffffff" />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: 'center',
    padding: 12,
    borderWidth: 3,
    borderColor: colors.abyss,
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
});
