// Every delivery on one day, for all fishers.

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { api, errorText } from '../../api';
import { Row } from '../../components/Ledger';
import { VoidModal } from '../../components/VoidModal';
import { dayHeading, fmtMoney, fmtTime, qtyText, shiftYmd, smsNotice, todayYmd, totalsText } from '../../format';
import { colors } from '../../theme';
import type { DayDelivery, DayView, Delivery } from '../../types';
import { Button, ErrorText, LinkButton, Muted, Screen, Title, useToast } from '../../ui';

export function TodayScreen({ onOpenToken }: { onOpenToken: (token: string) => void }) {
  const toast = useToast();
  const [ymd, setYmd] = useState(todayYmd());
  const [data, setData] = useState<DayView | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [voiding, setVoiding] = useState<Delivery | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await api.day(ymd);
      setData(next);
      setError('');
    } catch (err) {
      setError(errorText(err));
    }
  }, [ymd]);

  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const confirmVoid = async (d: Delivery, reason: string) => {
    const result = await api.voidDelivery(d.id, reason);
    const notice = smsNotice(result.sms, 'Voided');
    toast(notice.message, notice.kind);
    setVoiding(null);
    await load();
  };

  const isToday = ymd >= todayYmd();

  return (
    <>
      <Screen
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} colors={[colors.abyss]} />}
      >
        <Title>Deliveries</Title>

        <View style={styles.dayNav}>
          <View style={styles.navButton}>
            <Button small variant="ghost" title="‹" onPress={() => setYmd(shiftYmd(ymd, -1))} />
          </View>
          <View style={styles.dayLabel}>
            <Text style={styles.dayText}>{dayHeading(ymd)}</Text>
            {isToday ? <Muted>Today</Muted> : <LinkButton title="Back to today" onPress={() => setYmd(todayYmd())} />}
          </View>
          <View style={styles.navButton}>
            <Button small variant="ghost" title="›" disabled={isToday} onPress={() => setYmd(shiftYmd(ymd, 1))} />
          </View>
        </View>

        {error ? <ErrorText>{error}</ErrorText> : null}
        {!data && !error ? <ActivityIndicator color={colors.abyss} style={styles.loading} /> : null}

        {data ? (
          <View>
            <View style={styles.totals}>
              <Text style={styles.totalsMain}>{totalsText(data.totals)}</Text>
              <Text style={styles.totalsSub}>
                {data.totals.deliveries} {data.totals.deliveries === 1 ? 'delivery' : 'deliveries'}
                {data.totals.amount > 0 ? `, ${fmtMoney(data.totals.amount)}` : ''}
              </Text>
            </View>
            {data.items.length === 0 ? <Muted>No deliveries on this day.</Muted> : null}
            {data.items.map((d) => (
              <DayLine key={d.id} d={d} onOpen={() => onOpenToken(d.fisherToken)} onVoid={() => setVoiding(d)} />
            ))}
          </View>
        ) : null}
      </Screen>
      <VoidModal delivery={voiding} onCancel={() => setVoiding(null)} onConfirm={confirmVoid} />
    </>
  );
}

function DayLine({ d, onOpen, onVoid }: { d: DayDelivery; onOpen: () => void; onVoid: () => void }) {
  const voided = d.voidedAt !== null;
  return (
    <View>
      <Row onPress={onOpen}>
        <View style={styles.lineRow}>
          <View style={styles.lineMain}>
            <Text style={[styles.fisher, voided && styles.struck]}>{d.fisherName}</Text>
            <Text style={styles.meta}>{`${d.species}, ${fmtTime(d.deliveredAt)}`}</Text>
          </View>
          <View style={styles.lineQty}>
            <Text style={[styles.qty, voided && styles.struck]}>{qtyText(d)}</Text>
            {d.amount !== null ? <Text style={styles.meta}>{fmtMoney(d.amount)}</Text> : null}
          </View>
        </View>
        {voided ? <Text style={styles.voidNote}>{d.voidReason ? `Voided: ${d.voidReason}` : 'Voided'}</Text> : null}
      </Row>
      {!voided ? <LinkButton title="Void" danger onPress={onVoid} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dayNav: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  navButton: { width: 56 },
  dayLabel: { flex: 1, alignItems: 'center' },
  dayText: { fontSize: 18, fontWeight: '800', color: colors.abyss, textAlign: 'center' },
  loading: { marginTop: 24 },

  totals: { marginTop: 16, marginBottom: 8, padding: 16, borderRadius: 14, backgroundColor: colors.abyss },
  totalsMain: { fontSize: 28, fontWeight: '800', color: '#ffffff' },
  totalsSub: { marginTop: 2, fontSize: 15, color: colors.onDarkMuted },

  lineRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14 },
  lineMain: { flex: 1 },
  lineQty: { alignItems: 'flex-end' },
  fisher: { fontSize: 18, fontWeight: '800', color: colors.abyss },
  qty: { fontSize: 16, fontWeight: '800', color: colors.abyss },
  meta: { fontSize: 14, color: colors.muted },
  struck: { color: colors.muted, textDecorationLine: 'line-through' },
  voidNote: { marginTop: 2, fontSize: 14, fontWeight: '700', color: colors.coral },
});
