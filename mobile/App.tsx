import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FisherApp } from './src/screens/FisherApp';
import { StaffApp } from './src/screens/StaffApp';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { SessionProvider, useSession } from './src/session';
import { colors } from './src/theme';
import { ToastProvider } from './src/ui';

function Root() {
  const session = useSession();

  if (!session.ready) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.yellow} />
      </View>
    );
  }
  if (session.staffSignedIn) return <StaffApp />;
  if (session.fisherToken) return <FisherApp token={session.fisherToken} />;
  return <WelcomeScreen />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <ToastProvider>
        <SessionProvider>
          <View style={styles.root}>
            <Root />
          </View>
        </SessionProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ice },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.abyss },
});
