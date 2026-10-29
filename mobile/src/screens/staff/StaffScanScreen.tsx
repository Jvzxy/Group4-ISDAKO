import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { FisherList } from '../../components/FisherList';
import { Scanner } from '../../components/Scanner';
import type { FisherAdmin } from '../../types';
import { Screen, SectionTitle, Title, useToast } from '../../ui';

export function StaffScanScreen({
  fishers,
  loadError,
  refresh,
  onOpen,
  onAdd,
}: {
  fishers: FisherAdmin[] | null;
  loadError: string | null;
  refresh: () => Promise<FisherAdmin[] | null>;
  onOpen: (fisher: FisherAdmin) => void;
  onAdd: () => void;
}) {
  const toast = useToast();

  const onToken = useCallback(
    async (token: string) => {
      let found = fishers?.find((f) => f.token === token);
      if (!found) {
        // not in the list we have: it may be a newly registered fisher, so ask the server again
        const latest = await refresh();
        found = latest?.find((f) => f.token === token);
      }
      if (found) onOpen(found);
      else toast('This QR code was not recognized. It may have been replaced.', 'error');
    },
    [fishers, refresh, onOpen, toast],
  );

  return (
    <Screen>
      <Title>Scan a QR code</Title>
      <View style={styles.camera}>
        <Scanner onToken={onToken} hint="Scan the fisher's QR code to record their delivery." />
      </View>
      <SectionTitle>Or find a fisher by name</SectionTitle>
      <FisherList fishers={fishers} loadError={loadError} onRetry={() => void refresh()} onOpen={onOpen} onAdd={onAdd} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  camera: { marginTop: 12 },
});
