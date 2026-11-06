
import { Pressable, StyleSheet, Text } from 'react-native';
import { useColorScheme } from 'react-native';
import { useTheme } from '../ThemeContext';

export function ThemeSelector() {
  const { mode, setMode, colors } = useTheme();
  const systemScheme = useColorScheme();

  const isDark =
    mode === 'dark' ||
    (mode === 'system' && systemScheme === 'dark');

  return (
    <Pressable
      onPress={() => void setMode(isDark ? 'light' : 'dark')}
      style={[
        styles.button,
        { borderColor: colors.yellow },
      ]}
      accessibilityRole="button"
      accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <Text style={styles.icon}>
        {isDark ? '🌙' : '☀️'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    color: '#F6B93B',
    fontSize: 23,
    fontWeight: 'bold',
  },
});
