import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { fmtTime, qtyText } from '../format';
import { colors } from '../theme';
import type { Delivery } from '../types';
import { Button, ErrorText, Field } from '../ui';

/** Asks staff to confirm voiding a delivery, with an optional reason. */
export function VoidModal({
  delivery,
  onCancel,
  onConfirm,
}: {
  delivery: Delivery | null;
  onCancel: () => void;
  /** Throw to keep the dialog open and show the error. */
  onConfirm: (delivery: Delivery, reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (delivery) {
      setReason('');
      setError('');
      setBusy(false);
    }
  }, [delivery]);

  const confirm = async () => {
    if (!delivery) return;
    setBusy(true);
    setError('');
    try {
      await onConfirm(delivery, reason.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={delivery !== null} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Void this delivery?</Text>
          {delivery ? (
            <Text style={styles.summary}>
              {delivery.species}, {qtyText(delivery)} at {fmtTime(delivery.deliveredAt)}
            </Text>
          ) : null}
          <Text style={styles.note}>
            The record stays, but it no longer counts in the totals. If SMS alerts are on, the fisher gets a correction
            text.
          </Text>
          <Field label="Reason (optional)" value={reason} onChangeText={setReason} maxLength={120} autoCapitalize="sentences" />
          <ErrorText>{error}</ErrorText>
          <View style={styles.actions}>
            <Button title="Void delivery" variant="danger" loading={busy} onPress={() => void confirm()} />
            <Button title="Keep it" variant="ghost" disabled={busy} onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(14,58,82,0.72)' },
  card: { padding: 20, borderRadius: 20, backgroundColor: colors.foam },
  title: { fontSize: 22, fontWeight: '800', color: colors.abyss },
  summary: { marginTop: 6, fontSize: 17, fontWeight: '700', color: colors.abyss },
  note: { marginTop: 8, fontSize: 15, lineHeight: 21, color: colors.muted },
  actions: { gap: 10, marginTop: 16 },
});
