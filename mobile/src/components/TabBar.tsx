
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../Icon';
import type { IconName } from '../Icon';

import { TAB_BAR_HEIGHT } from '../theme';
import { useTheme } from '../ThemeContext';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon: IconName;
}

export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: ReadonlyArray<TabItem<T>>;
  active: T;
  onChange: (id: T) => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.bar,
        {
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          borderTopColor: colors.line,
          backgroundColor: colors.foam,
        },
      ]}
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;

        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
            onPress={() => onChange(tab.id)}
            style={[
              styles.tab,
              selected && { borderTopColor: colors.yellow },
            ]}
          >
            <Icon
              name={tab.icon}
              size={26}
              color={selected ? colors.abyss : colors.muted}
            />

            <Text
              style={[
                styles.label,
                { color: selected ? colors.abyss : colors.muted },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderTopWidth: 4,
    borderTopColor: 'transparent',
    marginTop: -1,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});
