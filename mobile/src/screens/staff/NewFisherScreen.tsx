import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { api, errorText } from '../../api';
import type { FisherAdmin } from '../../types';
import { Button, ErrorText, Field, Muted, Screen, SwitchRow, Title } from '../../ui';

export function NewFisherScreen({ onCreated }: { onCreated: (fisher: FisherAdmin) => void }) {
  const [name, setName] = useState('');
  const [boat, setBoat] = useState('');
  const [barangay, setBarangay] = useState('');
  const [phone, setPhone] = useState('');
  const [sms, setSms] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (name.trim().length < 2) {
      setError('Enter the fisher’s name.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const result = await api.createFisher({
        name,
        boat: boat.trim() || null,
        barangay: barangay.trim() || null,
        phone: phone.trim() || null,
        smsOptIn: sms,
      });
      setName('');
      setBoat('');
      setBarangay('');
      setPhone('');
      setSms(true);
      onCreated(result.fisher);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title>New fisher</Title>
      <View style={styles.gap}>
        <Muted>
          Each fisher gets their own QR code. They scan it once in the ISDAKO app and from then on see their deliveries.
        </Muted>
      </View>
      <Field label="Name" value={name} onChangeText={setName} maxLength={80} autoCapitalize="words" autoComplete="off" />
      <Field label="Boat name (optional)" value={boat} onChangeText={setBoat} maxLength={60} autoCapitalize="words" />
      <Field label="Barangay (optional)" value={barangay} onChangeText={setBarangay} maxLength={60} autoCapitalize="words" />
      <Field
        label="Mobile number (optional)"
        value={phone}
        onChangeText={setPhone}
        placeholder="0917 123 4567"
        keyboardType="phone-pad"
        maxLength={30}
        hint="Needed for SMS alerts. Philippine mobile numbers only."
      />
      <SwitchRow
        label="Send SMS alerts"
        description="Texts the fisher each time a delivery is recorded. Needs a mobile number."
        value={sms}
        onValueChange={setSms}
      />
      <ErrorText>{error}</ErrorText>
      <View style={styles.submit}>
        <Button title="Create QR code" loading={busy} onPress={() => void submit()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { marginTop: 4 },
  submit: { marginTop: 16 },
});
