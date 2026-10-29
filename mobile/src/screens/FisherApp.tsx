// What a fisher sees every time they open the app: today's catch on the tag, then every delivery.

import { useState } from 'react';
import type { ReactElement } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, errorText } from '../api';
import { Ledger } from '../components/Ledger';
import { QrCode } from '../components/QrCode';
import { TabBar } from '../components/TabBar';
import type { TabItem } from '../components/TabBar';
import { TagCard } from '../components/TagCard';
import { describeFisher, fmtTime } from '../format';
import { useFisherView } from '../hooks';
import { useSession } from '../session';
import { colors } from '../theme';
import type { FisherPublic } from '../types';
import { Button, LinkButton, Muted, Screen, SwitchRow, Title, useToast } from '../ui';

type Tab = 'catch' | 'qr';

const TABS: ReadonlyArray<TabItem<Tab>> = [
  { id: 'catch', label: 'My catch', icon: 'fish' },
  { id: 'qr', label: 'My QR', icon: 'qr' },
];

export function FisherApp({ token }: { token: string }) {
  const session = useSession();
  const { view, error, refreshing, updatedAt, refresh, reload } = useFisherView(token);
  const [tab, setTab] = useState<Tab>('catch');

  let content: ReactElement | null = null;
  if (!view && !error) {
    content = (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.abyss} />
      </View>
    );
  } else if (!view && error) {
    content = (
      <View style={styles.problem}>
        <Title>{error.notFound ? 'This QR code no longer works' : "Can't load your deliveries"}</Title>
        <Muted>
          {error.notFound
            ? 'It may have been replaced. Ask the staff to show your new QR code, then scan it.'
            : error.message}
        </Muted>
        {error.notFound ? (
          <Button title="Scan a new QR code" onPress={() => void session.signOutFisher()} />
        ) : (
          <Button title="Try again" onPress={() => void reload()} />
        )}
      </View>
    );
  } else if (view && tab === 'catch') {
    content = (
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.catchContent}
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
        <TagCard fisher={view.fisher} summary={view.summary} />
        <View style={styles.body}>
          {error ? <Text style={styles.stale}>Could not refresh. Showing your last update.</Text> : null}
          <Ledger deliveries={view.deliveries} />
          <Text style={styles.updated}>
            {updatedAt ? `Updated ${fmtTime(updatedAt)}. Pull down to refresh.` : 'Pull down to refresh.'}
          </Text>
        </View>
      </ScrollView>
    );
  } else if (view) {
    content = <MyQr token={token} view={view.fisher} onChanged={reload} />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.flex}>{content}</View>
      {view ? <TabBar tabs={TABS} active={tab} onChange={setTab} /> : null}
    </View>
  );
}

function MyQr({
  token,
  view: fisher,
  onChanged,
}: {
  token: string;
  view: FisherPublic;
  onChanged: () => Promise<void>;
}) {
  const session = useSession();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);

  const toggleSms = async (next: boolean) => {
    setSaving(true);
    try {
      await api.setSms(token, next);
      await onChanged();
      toast(next ? 'SMS alerts are on.' : 'SMS alerts are off.');
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const useAnother = () => {
    Alert.alert('Use a different QR code?', 'This phone will forget your QR code. You can scan it again any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Continue', style: 'destructive', onPress: () => void session.signOutFisher() },
    ]);
  };

  return (
    <Screen contentStyle={{ paddingTop: insets.top + 16 }}>
      <Title>My QR code</Title>
      <View style={styles.gap}>
        <Muted>Show this to the staff when you deliver. They scan it to record your catch.</Muted>
      </View>
      <View style={styles.qrWrap}>
        <QrCode token={token} size={230} />
        <Text style={styles.qrName}>{fisher.name}</Text>
        {describeFisher(fisher) ? <Muted>{describeFisher(fisher)}</Muted> : null}
      </View>

      <SwitchRow
        label="SMS alerts"
        description={
          fisher.phoneHint
            ? `We text ${fisher.phoneHint} each time a delivery is recorded.`
            : 'No phone number on file. Ask the staff to add yours.'
        }
        value={fisher.smsOptIn}
        disabled={saving || !fisher.phoneHint}
        onValueChange={(next) => void toggleSms(next)}
      />

      <View style={styles.signOut}>
        <LinkButton title="Use a different QR code" onPress={useAnother} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ice },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  problem: { flex: 1, justifyContent: 'center', gap: 12, padding: 24 },
  catchContent: { paddingBottom: 32 },
  body: { paddingHorizontal: 16 },
  stale: { marginBottom: 8, fontSize: 14, fontWeight: '700', color: colors.coral },
  updated: { marginTop: 28, fontSize: 14, color: colors.muted },
  gap: { marginTop: 8 },
  qrWrap: { alignItems: 'center', gap: 4, marginTop: 20 },
  qrName: { marginTop: 12, fontSize: 24, fontWeight: '800', color: colors.abyss },
  signOut: { marginTop: 28 },
});
