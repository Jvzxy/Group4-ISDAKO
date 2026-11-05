
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { describeFisher, fmtMoney, fmtNum } from '../format';
import { useTheme } from '../ThemeContext';
import type { FisherPublic, Summary, Totals } from '../types';

const OVERLAP = 56;

function headline(t: Totals): { value: string; unit: string } {
  if (t.kg > 0) return { value: fmtNum(t.kg), unit: 'kg' };
  if (t.pieces > 0) return { value: fmtNum(t.pieces), unit: 'pcs' };
  return { value: '0', unit: 'kg' };
}

function StripCell({
  label,
  totals,
  first,
}: {
  label: string;
  totals: Totals;
  first?: boolean;
}) {
  const { colors } = useTheme();
  const h = headline(totals);

  return (
    <View
      style={[
        styles.cell,
        !first && { borderLeftColor: 'rgba(59,42,0,0.35)' },
        !first && styles.cellDivider,
      ]}
    >
      <Text style={[styles.cellLabel, { color: colors.yellowInk }]}>
        {label}
      </Text>

      <Text
        style={[styles.cellValue, { color: colors.yellowInk }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {h.value}
        <Text style={[styles.cellUnit, { color: colors.yellowInk }]}>
          {' '}{h.unit}
        </Text>
      </Text>
    </View>
  );
}

export function TagCard({
  fisher,
  summary,
  topLeft,
}: {
  fisher: Pick<FisherPublic, 'name' | 'boat' | 'barangay'>;
  summary: Summary;
  /** e.g. a Back button, shown above the tag */
  topLeft?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [height, setHeight] = useState(0);
  const angle = useRef(new Animated.Value(5)).current;

  // One swing when the tag first appears, then it hangs still.
  // Skipped if the phone asks for reduced motion.
  useEffect(() => {
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (cancelled) return;

        if (reduce) {
          angle.setValue(0);
          return;
        }

        const swing = (to: number, ms: number) =>
          Animated.timing(angle, {
            toValue: to,
            duration: ms,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          });

        Animated.sequence([
          swing(-3.5, 380),
          swing(2, 340),
          swing(-0.9, 300),
          swing(0, 280),
        ]).start();
      })
      .catch(() => angle.setValue(0));

    return () => {
      cancelled = true;
      angle.stopAnimation();
    };
  }, [angle]);

  const rotate = angle.interpolate({
    inputRange: [-10, 10],
    outputRange: ['-10deg', '10deg'],
  });

  const { today, week, month, all } = summary;
  const big = headline(today);
  const sub = describeFisher(fisher);

  return (
    <View
      style={[
        styles.sky,
        {
          paddingTop: insets.top + 12,
          marginBottom: OVERLAP + 20,
          backgroundColor: colors.abyss,
        },
      ]}
    >
      <Svg
        style={styles.wave}
        width="100%"
        height={28}
        viewBox="0 0 120 28"
        preserveAspectRatio="none"
      >
        <Path d="M0 14C20 0 40 0 60 14s40 14 60 0V28H0z" fill={colors.ice} />
      </Svg>

      {topLeft}

      <Animated.View
        onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
        style={[
          styles.swing,
          {
            transform: [
              { translateY: -height / 2 },
              { rotate },
              { translateY: height / 2 },
            ],
          },
        ]}
      >
        <View style={styles.string} />

        <View style={[styles.tag, { backgroundColor: colors.yellow }]}>
          <View style={[styles.hole, { backgroundColor: colors.abyss }]} />

          <Text
            style={[styles.name, { color: colors.yellowInk }]}
            accessibilityRole="header"
          >
            {fisher.name}
          </Text>

          {sub ? (
            <Text style={[styles.sub, { color: colors.yellowInk }]}>
              {sub}
            </Text>
          ) : null}

          <Text
            style={[styles.big, { color: colors.yellowInk }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityLabel={`${big.value} ${big.unit === 'pcs' ? 'pieces' : 'kilograms'} delivered today`}
          >
            {big.value}
            <Text style={[styles.bigUnit, { color: colors.yellowInk }]}>
              {' '}{big.unit}
            </Text>
          </Text>

          <Text style={[styles.bigLabel, { color: colors.yellowInk }]}>
            {today.deliveries === 0
              ? 'Nothing delivered today yet'
              : 'Delivered today'}
          </Text>

          {today.kg > 0 && today.pieces > 0 ? (
            <Text style={[styles.extra, { color: colors.yellowInk }]}>
              {fmtNum(today.pieces)} pcs
            </Text>
          ) : null}

          {today.amount > 0 ? (
            <Text style={[styles.extra, { color: colors.yellowInk }]}>
              {fmtMoney(today.amount)}
            </Text>
          ) : null}

          <View style={styles.strip}>
            <StripCell label="7 days" totals={week} first />
            <StripCell label="This month" totals={month} />
            <StripCell label="All time" totals={all} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sky: {
    paddingHorizontal: 16,
    zIndex: 2,
  },
  wave: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -1,
  },
  swing: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: -OVERLAP,
    zIndex: 3,
  },
  string: {
    alignSelf: 'center',
    width: 3,
    height: 44,
    marginBottom: -20,
    borderRadius: 2,
    backgroundColor: '#b9cfd8',
  },
  tag: {
    paddingTop: 44,
    paddingHorizontal: 22,
    borderRadius: 22,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  hole: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  name: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
  },
  sub: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '600',
  },
  big: {
    marginTop: 16,
    fontSize: 68,
    lineHeight: 72,
    fontWeight: '800',
  },
  bigUnit: {
    fontSize: 24,
    fontWeight: '800',
  },
  bigLabel: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '700',
  },
  extra: {
    fontSize: 16,
    fontWeight: '700',
  },
  strip: {
    flexDirection: 'row',
    marginTop: 20,
    marginHorizontal: -22,
    borderTopWidth: 2,
    borderTopColor: 'rgba(59,42,0,0.35)',
  },
  cell: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  cellDivider: {
    borderLeftWidth: 2,
  },
  cellLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  cellValue: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: '800',
  },
  cellUnit: {
    fontSize: 13,
    fontWeight: '700',
  },
});
