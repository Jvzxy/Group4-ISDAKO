// First screen, before anyone is signed in: a fisher scans their QR code once, or staff sign in with the PIN.

import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, errorText, normalizeServerUrl } from '../api';
import { Scanner } from '../components/Scanner';
import { describeFisher } from '../format';
import { Icon } from '../Icon';
import { tokenFromQr } from '../qr';
import { useSession } from '../session';
import { colors } from '../theme';
import type { FisherPublic } from '../types';
import { Button, ErrorText, Field, LinkButton, Muted, Screen, Title, useToast } from '../ui';

type Step = 'home' | 'scan' | 'code' | 'confirm' | 'staff' | 'server';

export function WelcomeScreen() {
  const session = useSession();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>(session.serverUrl ? 'home' : 'server');
  const [found, setFound] = useState<{ token: string; fisher: FisherPublic } | null>(null);

  // Looks the QR up on the server and asks "is this you?" before saving it on the phone.
  const lookup = useCallback(
    async (token: string) => {
      try {
        const view = await api.fisherView(token);
        setFound({ token, fisher: view.fisher });
        setStep('confirm');
      } catch (err) {
        toast(errorText(err), 'error');
      }
    },
    [toast],
  );

  if (step === 'home') {
    return (
      <View style={[styles.home, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.logo}>
          <Icon name="fish" size={46} color={colors.abyss} />
        </View>
        <Text style={styles.brand}>ISDAKO</Text>
        <Text style={styles.tagline}>See exactly what you delivered. Just scan your QR code.</Text>

        <View style={styles.homeButtons}>
          <Button title="Scan my QR code" onPress={() => setStep('scan')} />
          <Button title="Type my code instead" variant="light" onPress={() => setStep('code')} />
        </View>

        <View style={styles.homeFooter}>
          <LinkButton light title="Staff sign in" onPress={() => setStep('staff')} />
          <LinkButton light title="Server settings" onPress={() => setStep('server')} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.backRow}>
        <LinkButton title="‹ Back" onPress={() => setStep('home')} />
      </View>

      {step === 'scan' ? (
        <Screen>
          <Title>Scan my QR code</Title>
          <View style={styles.gap}>
            <Muted>Ask the staff to show your QR code on their phone, then point this camera at it.</Muted>
          </View>
          <View style={styles.gap}>
            <Scanner onToken={lookup} />
          </View>
        </Screen>
      ) : null}

      {step === 'code' ? <CodeStep onLookup={lookup} /> : null}

      {step === 'confirm' && found ? (
        <Screen>
          <Title>Is this you?</Title>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmName}>{found.fisher.name}</Text>
            {describeFisher(found.fisher) ? <Muted>{describeFisher(found.fisher)}</Muted> : null}
          </View>
          <View style={styles.stack}>
            <Button title="Yes, show my deliveries" onPress={() => void session.claimFisher(found.token)} />
            <Button title="No, scan again" variant="ghost" onPress={() => setStep('scan')} />
          </View>
        </Screen>
      ) : null}

      {step === 'staff' ? <StaffStep /> : null}
      {step === 'server' ? <ServerStep onDone={() => setStep('home')} /> : null}
    </View>
  );
}

function CodeStep({ onLookup }: { onLookup: (token: string) => Promise<void> }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const token = tokenFromQr(code);
    if (!token) {
      setError('That code does not look right. It is about 22 letters and numbers, with no spaces.');
      return;
    }
    setError('');
    setBusy(true);
    await onLookup(token);
    setBusy(false);
  };

  return (
    <Screen>
      <Title>Type my code</Title>
      <View style={styles.gap}>
        <Muted>Use this if the camera does not work. The staff can give you your code.</Muted>
      </View>
      <Field
        label="My code"
        value={code}
        onChangeText={setCode}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />
      <ErrorText>{error}</ErrorText>
      <View style={styles.stack}>
        <Button title="Continue" loading={busy} onPress={() => void submit()} />
      </View>
    </Screen>
  );
}

function StaffStep() {
  const session = useSession();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!pin) {
      setError('Enter the staff PIN.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await session.signInStaff(pin);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title>Staff sign in</Title>
      <View style={styles.gap}>
        <Muted>Staff use the PIN to record deliveries and register fishers.</Muted>
      </View>
      <Field
        label="PIN"
        value={pin}
        onChangeText={setPin}
        secureTextEntry
        keyboardType="number-pad"
        autoComplete="off"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />
      <ErrorText>{error}</ErrorText>
      <View style={styles.stack}>
        <Button title="Sign in" loading={busy} onPress={() => void submit()} />
      </View>
    </Screen>
  );
}

function ServerStep({ onDone }: { onDone: () => void }) {
  const session = useSession();
  const toast = useToast();
  const [address, setAddress] = useState(session.serverUrl);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const url = normalizeServerUrl(address);
    if (!url) {
      setError('Enter an address like http://192.168.1.10:3000');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await session.setServerUrl(url);
      setAddress(url);
      const health = await api.health();
      toast(`Connected to ${health.name}.`);
      onDone();
    } catch (err) {
      setError(`Saved, but could not connect. ${errorText(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title>Server settings</Title>
      <View style={styles.gap}>
        <Muted>
          This is the address of the computer or website that runs the ISDAKO server. On the same Wi-Fi it looks like
          http://192.168.1.10:3000. The server prints it when it starts.
        </Muted>
      </View>
      <Field
        label="Server address"
        value={address}
        onChangeText={setAddress}
        placeholder="http://192.168.1.10:3000"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        autoComplete="off"
        returnKeyType="go"
        onSubmitEditing={() => void save()}
      />
      <ErrorText>{error}</ErrorText>
      <View style={styles.stack}>
        <Button title="Save and test connection" loading={busy} onPress={() => void save()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  home: { flex: 1, paddingHorizontal: 24, backgroundColor: colors.abyss },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.yellow,
  },
  brand: { marginTop: 20, fontSize: 44, fontWeight: '800', letterSpacing: 1, color: '#ffffff' },
  tagline: { marginTop: 8, maxWidth: 320, fontSize: 19, lineHeight: 26, color: colors.onDarkMuted },
  homeButtons: { gap: 12, marginTop: 40 },
  homeFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 'auto' },

  page: { flex: 1, backgroundColor: colors.ice },
  backRow: { paddingHorizontal: 16, paddingTop: 4 },
  gap: { marginTop: 8 },
  stack: { gap: 12, marginTop: 20 },
  confirmCard: {
    marginTop: 16,
    padding: 20,
    gap: 4,
    borderRadius: 16,
    backgroundColor: colors.yellow,
  },
  confirmName: { fontSize: 28, fontWeight: '800', color: colors.yellowInk },
});
