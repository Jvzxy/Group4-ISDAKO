// What staff see after signing in: scan a fisher's QR, today's deliveries, the fisher list, and registration.

import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, errorText } from '../api';
import { TabBar } from '../components/TabBar';
import type { TabItem } from '../components/TabBar';
import { Icon } from '../Icon';
import { useSession } from '../session';
import { colors } from '../theme';
import type { FisherAdmin } from '../types';
import { Button } from '../ui';
import { FisherDetail } from './staff/FisherDetail';
import { FishersScreen } from './staff/FishersScreen';
import { NewFisherScreen } from './staff/NewFisherScreen';
import { StaffScanScreen } from './staff/StaffScanScreen';
import { TodayScreen } from './staff/TodayScreen';

type Tab = 'scan' | 'today' | 'fishers' | 'new';

const TABS: ReadonlyArray<TabItem<Tab>> = [
  { id: 'scan', label: 'Scan', icon: 'scan' },
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'fishers', label: 'Fishers', icon: 'fish' },
  { id: 'new', label: 'New', icon: 'plus' },
];

export function StaffApp() {
  const session = useSession();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('scan');
  const [fishers, setFishers] = useState<FisherAdmin[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ id: number; showQr: boolean } | null>(null);

  const refresh = useCallback(async (): Promise<FisherAdmin[] | null> => {
    try {
      const result = await api.fishers();
      setFishers(result.fishers);
      setLoadError(null);
      return result.fishers;
    } catch (err) {
      setLoadError(errorText(err));
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const upsert = useCallback((fisher: FisherAdmin) => {
    setFishers((list) =>
      [...(list ?? []).filter((f) => f.id !== fisher.id), fisher].sort((a, b) => a.name.localeCompare(b.name)),
    );
  }, []);

  const open = useCallback((fisher: FisherAdmin) => setDetail({ id: fisher.id, showQr: false }), []);

  const openByToken = useCallback(
    (token: string) => {
      const found = fishers?.find((f) => f.token === token);
      if (found) open(found);
    },
    [fishers, open],
  );

  // Android back button: close the fisher, then go back to the Scan tab, then leave the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (detail) {
        setDetail(null);
        return true;
      }
      if (tab !== 'scan') {
        setTab('scan');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [detail, tab]);

  const detailFisher = detail ? (fishers?.find((f) => f.id === detail.id) ?? null) : null;

  let content: ReactElement;
  if (detail && detailFisher) {
    content = (
      <FisherDetail
        key={detailFisher.id}
        fisher={detailFisher}
        startWithQr={detail.showQr}
        onBack={() => setDetail(null)}
        onChanged={upsert}
      />
    );
  } else if (tab === 'scan') {
    content = (
      <StaffScanScreen
        fishers={fishers}
        loadError={loadError}
        refresh={refresh}
        onOpen={open}
        onAdd={() => setTab('new')}
      />
    );
  } else if (tab === 'today') {
    content = <TodayScreen onOpenToken={openByToken} />;
  } else if (tab === 'fishers') {
    content = (
      <FishersScreen
        fishers={fishers}
        loadError={loadError}
        refresh={refresh}
        onOpen={open}
        onAdd={() => setTab('new')}
      />
    );
  } else {
    content = (
      <NewFisherScreen
        onCreated={(fisher) => {
          upsert(fisher);
          setTab('fishers');
          setDetail({ id: fisher.id, showQr: true });
        }}
      />
    );
  }

  return (
    <View style={styles.root}>
      {detail && detailFisher ? null : (
        <View style={[styles.topbar, { paddingTop: insets.top + 10 }]}>
          <View style={styles.brand}>
            <Icon name="fish" size={26} color={colors.yellow} />
            <Text style={styles.brandText}>ISDAKO</Text>
            <Text style={styles.badge}>Staff</Text>
          </View>
          <Button small variant="light" title="Sign out" onPress={() => void session.signOutStaff()} />
        </View>
      )}
      <View style={styles.flex}>{content}</View>
      <TabBar
        tabs={TABS}
        active={tab}
        onChange={(next) => {
          setDetail(null);
          setTab(next);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ice },
  flex: { flex: 1 },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: colors.abyss,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: { fontSize: 20, fontWeight: '800', letterSpacing: 0.5, color: '#ffffff' },
  badge: {
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '800',
    color: colors.yellowInk,
    backgroundColor: colors.yellow,
  },
});
