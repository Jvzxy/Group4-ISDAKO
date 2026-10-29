// One fisher, as staff see them: their tag and deliveries, a form to record a new delivery,
// their phone and SMS setting, and their QR code (to show them, or to replace it if it was lost).

import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, errorText } from '../../api';
import { Ledger } from '../../components/Ledger';
import { QrCode } from '../../components/QrCode';
import { TagCard } from '../../components/TagCard';
import { VoidModal } from '../../components/VoidModal';
import { COMMON_SPECIES } from '../../constants';
import { describeFisher, formatPhone, parseNumber, smsNotice } from '../../format';
import { useFisherView } from '../../hooks';
import { colors } from '../../theme';
import type { Delivery, FisherAdmin } from '../../types';
import {
  Button,
  ErrorText,
  Field,
  LinkButton,
  Muted,
  SectionTitle,
  SwitchRow,
  useToast,
} from '../../ui';

export function FisherDetail({
  fisher,
  startWithQr,
  onBack,
  onChanged,
}: {
  fisher: FisherAdmin;
  startWithQr: boolean;
  onBack: () => void;
  onChanged: (fisher: FisherAdmin) => void;
}) {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { view, error, refreshing, refresh, reload } = useFisherView(fisher.token);
  const [qrOpen, setQrOpen] = useState(startWithQr);
  const [voiding, setVoiding] = useState<Delivery | null>(null);

  const confirmVoid = async (d: Delivery, reason: string) => {
    const result = await api.voidDelivery(d.id, reason);
    const notice = smsNotice(result.sms, 'Voided');
    toast(notice.message, notice.kind);
    setVoiding(null);
    await reload();
  };

  const back = <LinkButton light title="‹ Back" onPress={onBack} />;

  return (
    <>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor="#ffffff"
            colors={[colors.yellow]}
            progressBackgroundColor={colors.abyss}
          />
        }
      >
        {view ? (
          <TagCard fisher={view.fisher} summary={view.summary} topLeft={back} />
        ) : (
          <View style={[styles.loadingHeader, { paddingTop: insets.top + 12 }]}>
            {back}
            <Text style={styles.loadingName}>{fisher.name}</Text>
            {error ? <ErrorText>{error.message}</ErrorText> : <ActivityIndicator color={colors.yellow} />}
          </View>
        )}

        <View style={styles.body}>
          <Button title="Show QR code" variant="dark" onPress={() => setQrOpen(true)} />

          <EntryForm token={fisher.token} onSaved={() => void reload()} />

          {view ? <Ledger deliveries={view.deliveries} onVoid={setVoiding} /> : null}
          {error && view ? <Text style={styles.stale}>Could not refresh. Showing the last update.</Text> : null}

          <PhoneCard fisher={fisher} onChanged={onChanged} />
        </View>
      </ScrollView>

      <VoidModal delivery={voiding} onCancel={() => setVoiding(null)} onConfirm={confirmVoid} />
      <QrModal fisher={fisher} visible={qrOpen} onClose={() => setQrOpen(false)} onChanged={onChanged} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Record a delivery
// ---------------------------------------------------------------------------

function EntryForm({ token, onSaved }: { token: string; onSaved: () => void }) {
  const toast = useToast();
  const [species, setSpecies] = useState('');
  const [kg, setKg] = useState('');
  const [pieces, setPieces] = useState('');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const kgValue = parseNumber(kg);
    const piecesValue = parseNumber(pieces);
    const priceValue = parseNumber(price);
    if (!species.trim()) {
      setError('Enter the type of fish.');
      return;
    }
    if ([kgValue, piecesValue, priceValue].some((n) => n !== null && !Number.isFinite(n))) {
      setError('Kilos, number of fish and price must be numbers.');
      return;
    }
    if (kgValue === null && piecesValue === null) {
      setError('Enter the kilos or the number of fish.');
      return;
    }

    setError('');
    setBusy(true);
    try {
      const result = await api.addDelivery({
        token,
        species: species.trim(),
        kg: kgValue,
        pieces: piecesValue,
        pricePerKg: priceValue,
        note: note.trim() || null,
      });
      const notice = smsNotice(result.sms, 'Saved');
      toast(notice.message, notice.kind);
      setSpecies('');
      setKg('');
      setPieces('');
      setPrice('');
      setNote('');
      onSaved();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>Record a delivery</Text>
      <Field label="Type of fish" value={species} onChangeText={setSpecies} maxLength={60} autoCapitalize="words" autoComplete="off" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.chips}
      >
        {COMMON_SPECIES.map((name) => (
          <Pressable
            key={name}
            accessibilityRole="button"
            onPress={() => setSpecies(name)}
            style={[styles.chip, species === name && styles.chipOn]}
          >
            <Text style={[styles.chipText, species === name && styles.chipTextOn]}>{name}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.pair}>
        <View style={styles.half}>
          <Field label="Kilos (kg)" value={kg} onChangeText={setKg} placeholder="0" keyboardType="decimal-pad" />
        </View>
        <View style={styles.half}>
          <Field label="Number of fish" value={pieces} onChangeText={setPieces} placeholder="0" keyboardType="number-pad" />
        </View>
      </View>
      <Field label="Price per kilo (₱)" value={price} onChangeText={setPrice} placeholder="Optional" keyboardType="decimal-pad" />
      <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" maxLength={200} />
      <ErrorText>{error}</ErrorText>
      <View style={styles.submit}>
        <Button title="Save delivery" loading={busy} onPress={() => void submit()} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Phone number and SMS alerts
// ---------------------------------------------------------------------------

function PhoneCard({ fisher, onChanged }: { fisher: FisherAdmin; onChanged: (fisher: FisherAdmin) => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState('');
  const [sms, setSms] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const start = () => {
    setPhone(fisher.phone ? formatPhone(fisher.phone) : '');
    setSms(fisher.phone ? fisher.smsOptIn : true);
    setError('');
    setEditing(true);
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await api.setPhone(fisher.id, phone.trim() === '' ? null : phone, sms);
      onChanged(result.fisher);
      setEditing(false);
      toast('Saved.');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <SectionTitle>Phone and SMS alerts</SectionTitle>
      {editing ? (
        <View>
          <Field
            label="Mobile number"
            value={phone}
            onChangeText={setPhone}
            placeholder="0917 123 4567"
            keyboardType="phone-pad"
            maxLength={30}
            hint="Leave it empty to remove the number."
          />
          <SwitchRow
            label="Send SMS alerts"
            description="Texts the fisher each time a delivery is recorded."
            value={sms}
            onValueChange={setSms}
          />
          <ErrorText>{error}</ErrorText>
          <View style={styles.pairButtons}>
            <View style={styles.half}>
              <Button title="Save" loading={busy} onPress={() => void save()} />
            </View>
            <View style={styles.half}>
              <Button title="Cancel" variant="ghost" disabled={busy} onPress={() => setEditing(false)} />
            </View>
          </View>
        </View>
      ) : (
        <View>
          <Muted>
            {fisher.phone
              ? `${formatPhone(fisher.phone)}. SMS alerts are ${fisher.smsOptIn ? 'on' : 'off'}.`
              : 'No mobile number. Add one to send SMS alerts.'}
          </Muted>
          <LinkButton title={fisher.phone ? 'Change number' : 'Add a mobile number'} onPress={start} />
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// QR code dialog
// ---------------------------------------------------------------------------

function QrModal({
  fisher,
  visible,
  onClose,
  onChanged,
}: {
  fisher: FisherAdmin;
  visible: boolean;
  onClose: () => void;
  onChanged: (fisher: FisherAdmin) => void;
}) {
  const toast = useToast();
  const first = fisher.name.split(' ')[0] ?? fisher.name;

  const replace = () => {
    Alert.alert(
      'Issue a new QR code?',
      `The old QR code stops working right away. ${first} will need to scan the new one.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Issue new code',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                const result = await api.newQr(fisher.id);
                onChanged(result.fisher);
                toast('New QR code issued.');
              } catch (err) {
                toast(errorText(err), 'error');
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          <QrCode token={fisher.token} size={220} />
          <Text style={styles.qrName}>{fisher.name}</Text>
          {describeFisher(fisher) ? <Muted>{describeFisher(fisher)}</Muted> : null}
          <View style={styles.qrHelp}>
            <Muted>{`Ask ${first} to open ISDAKO, tap "Scan my QR code", and scan this.`}</Muted>
          </View>
          <View style={styles.modalActions}>
            <Button title="Done" onPress={onClose} />
          </View>
          <LinkButton title="Lost it? Issue a new QR code" danger onPress={replace} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: 40 },
  body: { paddingHorizontal: 16 },
  loadingHeader: { paddingHorizontal: 16, paddingBottom: 28, gap: 8, backgroundColor: colors.abyss },
  loadingName: { fontSize: 28, fontWeight: '800', color: '#ffffff' },
  stale: { marginTop: 8, fontSize: 14, fontWeight: '700', color: colors.coral },

  form: {
    marginTop: 20,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.abyss,
    borderRadius: 16,
    backgroundColor: colors.foam,
  },
  formTitle: { fontSize: 19, fontWeight: '800', color: colors.abyss },
  chips: { gap: 8, paddingVertical: 10 },
  chip: {
    paddingHorizontal: 14,
    minHeight: 40,
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 999,
    backgroundColor: colors.ice,
  },
  chipOn: { borderColor: colors.abyss, backgroundColor: colors.abyss },
  chipText: { fontSize: 15, fontWeight: '700', color: colors.abyss },
  chipTextOn: { color: '#ffffff' },
  pair: { flexDirection: 'row', gap: 12 },
  pairButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  half: { flex: 1 },
  submit: { marginTop: 14 },

  backdrop: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(14,58,82,0.78)' },
  modalCard: { alignItems: 'center', padding: 20, borderRadius: 20, backgroundColor: colors.foam },
  qrName: { marginTop: 14, fontSize: 24, fontWeight: '800', textAlign: 'center', color: colors.abyss },
  qrHelp: { marginTop: 8 },
  modalActions: { alignSelf: 'stretch', marginTop: 16 },
});
