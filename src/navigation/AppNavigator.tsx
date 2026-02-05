import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../types/navigation';

// Import screens
import HomeScreen from '../screens/HomeScreen';
import WalletScreen from '../screens/WalletScreen';
import ActivityScreen from '../screens/ActivityScreen';
import SendScreen from '../screens/SendScreen';
import EnterAddressScreen from '../screens/EnterAddressScreen';
import SendDetailsScreen from '../screens/SendDetailsScreen';
import TransactionScreen from '../screens/TransactionScreen';
import ReceiveScreen from '../screens/ReceiveScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ThemeSelectionScreen from '../screens/ThemeSelectionScreen';
import CurrencySelectionScreen from '../screens/CurrencySelectionScreen';
import DisplaySeedScreen from '../screens/DisplaySeedScreen';
import MnemonicScreen from '../screens/MnemonicScreen';
import ImportWalletScreen from '../screens/ImportWalletScreen';
import TokensScreen from '../screens/TokensScreen';
import WalletManagementScreen from '../screens/WalletManagementScreen';
import BrowserScreen from '../screens/BrowserScreen';
import PrivateTransferScreen from '../screens/PrivateTransferScreen';
import ZeroAlphaLoginScreen from '../screens/ZeroAlphaLoginScreen';
import ZeroAlphaScreen from '../screens/ZeroAlphaScreen';
import ZeroAlphaProfileScreen from '../screens/ZeroAlphaProfileScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigatorContent: React.FC = () => {
  const { currentTheme } = useTheme();

  const screenOptions: NativeStackNavigationOptions = {
    headerShown: false,
    contentStyle: { backgroundColor: currentTheme.primary },
    animation: 'slide_from_right',
  };

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home" screenOptions={screenOptions}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Wallet" component={WalletScreen} />
        <Stack.Screen name="Activity" component={ActivityScreen} />
        <Stack.Screen name="Send" component={SendScreen} />
        <Stack.Screen name="EnterAddress" component={EnterAddressScreen} />
        <Stack.Screen name="SendDetails" component={SendDetailsScreen} />
        <Stack.Screen name="Transaction" component={TransactionScreen} />
        <Stack.Screen name="Receive" component={ReceiveScreen} />
        <Stack.Screen name="Browser" component={BrowserScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="ThemeSelection" component={ThemeSelectionScreen} />
        <Stack.Screen name="CurrencySelection" component={CurrencySelectionScreen} />
        <Stack.Screen name="DisplaySeed" component={DisplaySeedScreen} />
        <Stack.Screen name="Mnemonic" component={MnemonicScreen} />
        <Stack.Screen name="ImportWallet" component={ImportWalletScreen} />
        <Stack.Screen name="Tokens" component={TokensScreen} />
        <Stack.Screen name="WalletManagement" component={WalletManagementScreen} />
        <Stack.Screen name="PrivateTransfer" component={PrivateTransferScreen} />
        <Stack.Screen name="ZeroAlphaLogin" component={ZeroAlphaLoginScreen} />
        <Stack.Screen name="ZeroAlphaScreen" component={ZeroAlphaScreen} />
        <Stack.Screen name="ZeroAlphaProfile" component={ZeroAlphaProfileScreen} />
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