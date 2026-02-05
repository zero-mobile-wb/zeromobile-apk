import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { WalletProvider } from './src/context/WalletContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { CurrencyProvider } from './src/context/CurrencyContext';
import AppNavigator from './src/navigation/AppNavigator';
import { BiometricProvider } from './src/components/BiometricProvider';

export default function App() {
  // Notification permissions are now requested in WalletContext when wallet loads

  return (
    <WalletProvider>
      <ThemeProvider>
        <CurrencyProvider>
          <BiometricProvider>
            <StatusBar style="dark" />
            <AppNavigator />
          </BiometricProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </WalletProvider>
  );
}