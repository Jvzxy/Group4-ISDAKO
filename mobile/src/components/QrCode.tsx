
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { qrValue } from '../qr';
import { useTheme } from '../ThemeContext';

/** A fisher's QR code. It is drawn on the phone, so it also works with no signal. */
export function QrCode({
  token,
  size = 220,
}: {
  token: string;
  size?: number;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.frame,
        {
          borderColor: colors.abyss,
          backgroundColor: '#ffffff',
        },
      ]}
      accessibilityLabel="QR code"
      accessible
    >
      <QRCode
        value={qrValue(token)}
        size={size}
        ecl="M"
        color="#000000"
        backgroundColor="#ffffff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: 'center',
    padding: 12,
    borderWidth: 3,
    borderRadius: 16,
  },
});
