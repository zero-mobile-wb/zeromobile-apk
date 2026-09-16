import 'fast-text-encoding';
import 'react-native-get-random-values';
import '@ethersproject/shims';

import React from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useFonts } from 'expo-font';
import { PrivyProvider } from '@privy-io/expo';
import { SmartWalletsProvider } from '@privy-io/expo/smart-wallets';
import Constants from 'expo-constants';
import { WalletProvider } from './src/context/WalletContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { CurrencyProvider } from './src/context/CurrencyContext';
import { NetworkProvider } from './src/context/NetworkContext';
import AppNavigator from './src/navigation/AppNavigator';
import { BiometricProvider } from './src/components/BiometricProvider';
import { SpendAuthProvider } from './src/zerospend/context/SpendAuthContext';
import { TwoFactorProvider } from './src/zerospend/context/TwoFactorContext';
import ErrorBoundary from './src/components/ErrorBoundary';

const PRIVY_APP_ID = Constants.expoConfig?.extra?.privyAppId ?? 'cmkbvfb9s03ynk00dnjbp7ajf';
const PRIVY_CLIENT_ID = Constants.expoConfig?.extra?.privyClientId ?? 'client-WY6V6xD7tGWELpSqNZZfQ2yMVos4MoPdEkDM8fwFTJbyx';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    'Satoshi-Medium': require('./assets/fonts/Satoshi-Medium.ttf'),
    'Satoshi-Light': require('./assets/fonts/Satoshi-Light.ttf'),
    'PetitFormalScript': require('./assets/fonts/PetitFormalScript-Regular.ttf'),
  });
  // Never white-screen forever: font files download from Metro, and on a
  // flaky LAN/phone connection that can stall. After 4s render anyway with
  // system-font fallback; custom fonts swap in if/when they arrive.
  const [fontsTimedOut, setFontsTimedOut] = React.useState(false);
  React.useEffect(() => {
    if (fontsLoaded) return;
    const t = setTimeout(() => {
      console.log('[App] Font load timed out, rendering with fallback fonts', fontError);
      setFontsTimedOut(true);
    }, 4000);
    return () => clearTimeout(t);
  }, [fontsLoaded]);
  if (!fontsLoaded && !fontsTimedOut) return null;

  return (
    <ErrorBoundary>
      <KeyboardProvider>
      <PrivyProvider appId={PRIVY_APP_ID} clientId={PRIVY_CLIENT_ID}>
        <SmartWalletsProvider>
          <NetworkProvider>
            <WalletProvider>
              <ThemeProvider>
                <CurrencyProvider>
                  <SpendAuthProvider>
                    <TwoFactorProvider>
                      <BiometricProvider>
                        <AppNavigator />
                      </BiometricProvider>
                    </TwoFactorProvider>
                  </SpendAuthProvider>
                </CurrencyProvider>
              </ThemeProvider>
            </WalletProvider>
          </NetworkProvider>
        </SmartWalletsProvider>
      </PrivyProvider>
      </KeyboardProvider>
    </ErrorBoundary>
  );
}