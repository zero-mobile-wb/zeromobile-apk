import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import Constants from 'expo-constants';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationOptions, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { RootStackParamList } from '../types/navigation';

// Locks the app when it returns from the background: in-memory keys are
// dropped on minimize, and re-entry always routes through the Lock screen
// when an account exists on the device.
const BackgroundLock: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { wallet, wallets, isPrivyUser, lockWallet } = useWallet();
  const appState = useRef(AppState.currentState);
  const walletRef = useRef(wallet);
  walletRef.current = wallet;
  const hasAccountRef = useRef(false);
  hasAccountRef.current = wallets.length > 0 || isPrivyUser;

  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      const prev = appState.current;
      appState.current = nextState;
      if (prev !== 'background' && nextState === 'background') {
        // Minimized: drop in-memory keys immediately.
        if (walletRef.current) lockWallet();
      } else if (prev === 'background' && nextState === 'active') {
        // Re-entered: gate through Lock ONLY when coming back to an unlocked
        // area. Onboarding screens (Home/Auth, or Lock itself) never lock —
        // otherwise switching apps mid-signup (e.g. copying the email OTP)
        // would bounce the user to Lock and break the flow.
        if (hasAccountRef.current) {
          const state = navigation.getState?.();
          const current = state?.routes?.[state.index]?.name;
          if (current !== 'Lock' && current !== 'Home' && current !== 'Auth') {
            navigation.reset({ index: 0, routes: [{ name: 'Lock' }] });
          }
        }
      }
    });
    return () => sub.remove();
  }, [lockWallet, navigation]);

  return null;
};

// Routes ZeroSpend push taps (cold start): if the app was launched from a
// spend notification, land on the notifications inbox.
// Built app only — expo-notifications is never imported inside Expo Go, where
// even importing the library triggers the SDK 53+ remote-push warning.
const PushTapHandler: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  useEffect(() => {
    if (Constants.appOwnership === 'expo') return;
    let sub: { remove: () => void } | undefined;
    let cancelled = false;
    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        if (cancelled) return;
        const last = await Notifications.getLastNotificationResponseAsync();
        const data = last?.notification.request.content.data as any;
        if (data?.spend) navigation.navigate('SpendNotifications');
        if (cancelled) return;
        sub = Notifications.addNotificationResponseReceivedListener(response => {
          const data = response.notification.request.content.data as any;
          if (data?.spend) navigation.navigate('SpendNotifications');
        });
      } catch { /* notifications unavailable */ }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [navigation]);
  return null;
};

// Import screens
import HomeScreen from '../screens/HomeScreen';
import LockScreen from '../screens/LockScreen';
import AuthScreen from '../screens/AuthScreen';
import WalletScreen from '../screens/WalletScreen';
import ActivityScreen from '../screens/ActivityScreen';
import SwapScreen from '../screens/SwapScreen';
import SendScreen from '../screens/SendScreen';
import EnterAddressScreen from '../screens/EnterAddressScreen';
import SendDetailsScreen from '../screens/SendDetailsScreen';
import TransactionScreen from '../screens/TransactionScreen';
import ReceiveScreen from '../screens/ReceiveScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ThemeSelectionScreen from '../screens/ThemeSelectionScreen';
import CurrencySelectionScreen from '../screens/CurrencySelectionScreen';
import TokensScreen from '../screens/TokensScreen';
import SpendEmailScreen from '../zerospend/screens/EmailScreen';
import SpendOtpScreen from '../zerospend/screens/OtpScreen';
import SpendPasswordScreen from '../zerospend/screens/PasswordScreen';
import SpendLinkAccountScreen from '../zerospend/screens/LinkAccountScreen';
import SpendLoginScreen from '../zerospend/screens/LoginScreen';
import SpendDashboardScreen from '../zerospend/screens/DashboardScreen';
import SpendActionsScreen from '../zerospend/screens/SpendActionsScreen';
import SpendTransactionsScreen from '../zerospend/screens/SpendTransactionsScreen';
import SpendSettingsScreen from '../zerospend/screens/SpendSettingsScreen';
import SpendNotificationsScreen from '../zerospend/screens/SpendNotificationsScreen';
import SpendFundraisersScreen from '../zerospend/screens/FundraisersListScreen';
import SpendFundraiserScreen from '../zerospend/screens/FundraiserScreen';
import BrowserScreen from '../screens/BrowserScreen';
import OnrampScreen from '../zerospend/screens/OnrampScreen';
import WithdrawScreen from '../zerospend/screens/WithdrawScreen';
import AdapterConnectScreen from '../screens/adapter/AdapterConnectScreen';
import AdapterSignScreen from '../screens/adapter/AdapterSignScreen';

// Security Screens
import ManageWalletModal from '../screens/security/ManageWalletModal';
import SecurityWarningScreen from '../screens/security/SecurityWarningScreen';
import ShowSecretScreen from '../screens/security/ShowSecretScreen';
import ImportWalletScreen from '../screens/security/ImportWalletScreen';
import CreateInvoiceScreen from '../screens/CreateInvoiceScreen';
import BusinessScreen from '../screens/BusinessScreen';
import TokenDetailScreen from '../screens/TokenDetailScreen';


const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigatorContent: React.FC = () => {
  const { currentTheme } = useTheme();

  const screenOptions: NativeStackNavigationOptions = {
    headerShown: false,
    contentStyle: { backgroundColor: currentTheme.primary },
    animation: 'fade',
  };

  const prefix = Linking.createURL('/');

  const linking = {
    prefixes: ['zerowallet://', prefix],
    config: {
      screens: {
        AdapterConnect: 'connect',
        AdapterSign: 'sign',
        // 'signAll' and 'signMessage' deep links will also map to AdapterSign
        AdapterSignAll: 'signAll',
        AdapterSignMessage: 'signMessage',
      },
    },
  };

  return (
    <NavigationContainer linking={linking}>
      <BackgroundLock />
      <PushTapHandler />
      <Stack.Navigator initialRouteName="Home" screenOptions={screenOptions}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Lock" component={LockScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="Wallet" component={WalletScreen} />
        <Stack.Screen name="Activity" component={ActivityScreen} />
        <Stack.Screen name="Swap" component={SwapScreen} />
        <Stack.Screen name="Send" component={SendScreen} />
        <Stack.Screen name="EnterAddress" component={EnterAddressScreen} />
        <Stack.Screen name="SendDetails" component={SendDetailsScreen} />
        <Stack.Screen name="Transaction" component={TransactionScreen} />
        <Stack.Screen name="Receive" component={ReceiveScreen} />
        <Stack.Screen name="Browser" component={BrowserScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="ThemeSelection" component={ThemeSelectionScreen} />
        <Stack.Screen name="CurrencySelection" component={CurrencySelectionScreen} />
        <Stack.Screen name="Tokens" component={TokensScreen} />
        <Stack.Screen name="SpendEmail" component={SpendEmailScreen} />
        <Stack.Screen name="SpendOtp" component={SpendOtpScreen} />
        <Stack.Screen name="SpendPassword" component={SpendPasswordScreen} />
        <Stack.Screen name="SpendLinkAccount" component={SpendLinkAccountScreen} />
        <Stack.Screen name="SpendLogin" component={SpendLoginScreen} />
        <Stack.Screen name="SpendDashboard" component={SpendDashboardScreen} />
        <Stack.Screen name="SpendActions" component={SpendActionsScreen} />
        <Stack.Screen name="SpendTransactions" component={SpendTransactionsScreen} />
        <Stack.Screen name="SpendSettings" component={SpendSettingsScreen} />
        <Stack.Screen name="SpendNotifications" component={SpendNotificationsScreen} />
        <Stack.Screen name="SpendFundraisers" component={SpendFundraisersScreen} />
        <Stack.Screen name="SpendFundraiser" component={SpendFundraiserScreen} />
        <Stack.Screen name="Onramp" component={OnrampScreen} />
        <Stack.Screen name="Withdraw" component={WithdrawScreen} />
        <Stack.Screen name="AdapterConnect" component={AdapterConnectScreen}
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen name="AdapterSign" component={AdapterSignScreen}
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        {/* Mapping the different URI routes to the same signing component */}
        <Stack.Screen name="AdapterSignAll" component={AdapterSignScreen as any}
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen name="AdapterSignMessage" component={AdapterSignScreen as any}
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />

        {/* Security / Secret Management */}
        <Stack.Screen name="CreateInvoice" component={CreateInvoiceScreen as any} />
        <Stack.Screen name="Business" component={BusinessScreen as any} />
        <Stack.Screen name="SecurityWarning" component={SecurityWarningScreen} />
        <Stack.Screen name="ShowSecret" component={ShowSecretScreen} />
        <Stack.Screen name="ImportWallet" component={ImportWalletScreen as any} />
        <Stack.Screen name="ManageWalletModal" component={ManageWalletModal}
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen name="TokenDetail" component={TokenDetailScreen} />

      </Stack.Navigator>
    </NavigationContainer>
  );
};

const AppNavigator: React.FC = () => {
  return (
    <SafeAreaProvider>
      <AppNavigatorContent />
    </SafeAreaProvider>
  );
};

export default AppNavigator;