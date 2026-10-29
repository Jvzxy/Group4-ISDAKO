// Deliveries grouped by day. Staff also get a Void button on each line.

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dayHeading, fmtMoney, fmtTime, localYmd, qtyText, todayYmd, totalsText } from '../format';
import { colors } from '../theme';
import type { Delivery } from '../types';
import { LinkButton, Muted, SectionTitle } from '../ui';

function groupByDay(deliveries: Delivery[]): Array<{ ymd: string; items: Delivery[] }> {
  const groups: Array<{ ymd: string; items: Delivery[] }> = [];
  for (const d of deliveries) {
    const ymd = localYmd(d.deliveredAt);
    const last = groups[groups.length - 1];
    if (last && last.ymd === ymd) last.items.push(d);
    else groups.push({ ymd, items: [d] });
  }
  return groups;
}

function Line({ d, onVoid }: { d: Delivery; onVoid?: (d: Delivery) => void }) {
  const voided = d.voidedAt !== null;
  const meta = d.note ? `${fmtTime(d.deliveredAt)}, ${d.note}` : fmtTime(d.deliveredAt);
  return (
    <View style={styles.line}>
      <View style={styles.lineRow}>
        <View style={styles.lineMain}>
          <Text style={[styles.species, voided && styles.struck]}>{d.species}</Text>
          <Text style={styles.meta}>{meta}</Text>
        </View>
        <View style={styles.lineQty}>
          <Text style={[styles.qty, voided && styles.struck]}>{qtyText(d)}</Text>
          {d.amount !== null ? <Text style={styles.meta}>{fmtMoney(d.amount)}</Text> : null}
        </View>
      </View>
      {voided ? <Text style={styles.voidNote}>{d.voidReason ? `Voided: ${d.voidReason}` : 'Voided'}</Text> : null}
      {onVoid && !voided ? <LinkButton title="Void" danger onPress={() => onVoid(d)} /> : null}
    </View>
  );
}

export function Ledger({ deliveries, onVoid }: { deliveries: Delivery[]; onVoid?: (d: Delivery) => void }) {
  if (deliveries.length === 0) {
    return (
      <View>
        <SectionTitle>Deliveries</SectionTitle>
        <Muted>No deliveries yet. When one is recorded, it shows up here.</Muted>
      </View>
    );
  }

  const today = todayYmd();
  return (
    <View>
      <SectionTitle>Deliveries</SectionTitle>
      {groupByDay(deliveries).map((group) => {
        const counted = group.items.filter((d) => d.voidedAt === null);
        const total = {
          kg: counted.reduce((sum, d) => sum + (d.kg ?? 0), 0),
          pieces: counted.reduce((sum, d) => sum + (d.pieces ?? 0), 0),
        };
        return (
          <View key={group.ymd} style={styles.day}>
            <View style={styles.dayHead}>
              <Text style={styles.dayTitle}>{dayHeading(group.ymd)}</Text>
              {group.ymd === today ? (
                <View style={styles.pill}>
                  <Text style={styles.pillText}>Today</Text>
                </View>
              ) : null}
              <Text style={styles.dayTotal}>{totalsText(total)}</Text>
            </View>
            {group.items.map((d) => (
              <Line key={d.id} d={d} onVoid={onVoid} />
            ))}
          </View>
        );
      })}
    </View>
  );
}

/** A tappable row used by the staff lists (fishers, today's deliveries). */
export function Row({ onPress, children }: { onPress: () => void; children: ReactNode }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  day: { marginTop: 16 },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 6,
    borderBottomWidth: 3,
    borderBottomColor: colors.abyss,
  },
  dayTitle: { fontSize: 17, fontWeight: '800', color: colors.abyss },
  pill: { paddingHorizontal: 10, paddingVertical: 1, borderRadius: 999, backgroundColor: colors.yellow },
  pillText: { fontSize: 13, fontWeight: '800', color: colors.yellowInk },
  dayTotal: { marginLeft: 'auto', fontSize: 16, fontWeight: '800', color: colors.abyss },

  line: { paddingTop: 12, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: colors.line },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14 },
  lineMain: { flex: 1 },
  lineQty: { alignItems: 'flex-end' },
  species: { fontSize: 18, fontWeight: '800', color: colors.abyss },
  qty: { fontSize: 16, fontWeight: '800', color: colors.abyss },
  meta: { fontSize: 14, color: colors.muted },
  struck: { color: colors.muted, textDecorationLine: 'line-through' },
  voidNote: { marginTop: 2, fontSize: 14, fontWeight: '700', color: colors.coral },

  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowPressed: { opacity: 0.6 },
});
