
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  View,
  useColorScheme,
} from 'react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FisherApp } from './src/screens/FisherApp';
import { StaffApp } from './src/screens/StaffApp';
import { WelcomeScreen } from './src/screens/WelcomeScreen';

import { SessionProvider, useSession } from './src/session';
import { ThemeProvider, useTheme } from './src/ThemeContext';
import { ToastProvider } from './src/ui';

function Root() {
  const session = useSession();
  const theme = useTheme();

  if (!session.ready || !theme.ready) {
    return (
      <View style={[styles.splash, { backgroundColor: theme.colors.abyss }]}>
        <ActivityIndicator size="large" color={theme.colors.yellow} />
      </View>
    );
  }

  if (session.staffSignedIn) return <StaffApp />;
  if (session.fisherToken) return <FisherApp token={session.fisherToken} />;

  return <WelcomeScreen />;
}

function AppStatusBar() {
  const { mode } = useTheme();
  const systemScheme = useColorScheme();

  const isDark =
    mode === 'dark' ||
    (mode === 'system' && systemScheme === 'dark');

  return (
    <StatusBar
      barStyle={isDark ? 'light-content' : 'dark-content'}
    />
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppStatusBar />
        <ToastProvider>
          <SessionProvider>
            <View style={styles.root}>
              <Root />
            </View>
          </SessionProvider>
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
