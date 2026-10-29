// Searchable list of fishers, used by the Scan and Fishers tabs.

import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { describeFisher } from '../format';
import { colors } from '../theme';
import type { FisherAdmin } from '../types';
import { Button, ErrorText, Field, Muted, Notice } from '../ui';
import { Row } from './Ledger';

export function FisherList({
  fishers,
  loadError,
  onRetry,
  onOpen,
  onAdd,
}: {
  /** null while loading */
  fishers: FisherAdmin[] | null;
  loadError: string | null;
  onRetry: () => void;
  onOpen: (fisher: FisherAdmin) => void;
  onAdd: () => void;
}) {
  const [query, setQuery] = useState('');

  if (fishers === null) {
    if (loadError) {
      return (
        <Notice>
          <ErrorText>{loadError}</ErrorText>
          <Button title="Try again" onPress={onRetry} />
        </Notice>
      );
    }
    return <ActivityIndicator color={colors.abyss} style={styles.loading} />;
  }

  if (fishers.length === 0) {
    return (
      <Notice>
        <Muted>No fishers yet. Add one to create their QR code.</Muted>
        <Button title="Add a fisher" onPress={onAdd} />
      </Notice>
    );
  }

  const q = query.trim().toLowerCase();
  const shown = q
    ? fishers.filter((f) => `${f.name} ${f.boat ?? ''} ${f.barangay ?? ''}`.toLowerCase().includes(q))
    : fishers;

  return (
    <View>
      <Field
        label="Find a fisher"
        value={query}
        onChangeText={setQuery}
        placeholder="Name, boat or barangay"
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />
      <View style={styles.list}>
        {shown.map((f) => (
          <Row key={f.id} onPress={() => onOpen(f)}>
            <Text style={styles.name}>{f.name}</Text>
            {describeFisher(f) ? <Text style={styles.sub}>{describeFisher(f)}</Text> : null}
          </Row>
        ))}
        {shown.length === 0 ? <Muted>No fisher matches that search.</Muted> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 24 },
  list: { marginTop: 8 },
  name: { fontSize: 18, fontWeight: '800', color: colors.abyss },
  sub: { fontSize: 14, color: colors.muted },
});
