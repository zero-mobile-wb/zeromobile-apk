import { StackNavigationProp } from '@react-navigation/stack';

export type RootStackParamList = {
  Home: undefined;
  Wallet: undefined;
  Activity: undefined;
  Send: undefined;
  EnterAddress: {
    amount: string;
    amountInSOL: string;
    tokenMint: string;
    tokenSymbol: string;
    tokenDecimals: number;
  };
  SendDetails: {
    amount: string;
    amountInSOL: string;
    address: string;
    tokenMint: string;
    tokenSymbol: string;
    tokenDecimals: number;
  };
  Transaction: {
    amount: string;
    amountInSOL: string;
    address: string;
    tokenMint: string;
    tokenSymbol: string;
    tokenDecimals: number;
    status: 'submitting' | 'success' | 'error';
  };
  Receive: undefined;
  Browser: undefined;
  Settings: undefined;
  ThemeSelection: undefined;
  CurrencySelection: undefined;
  DisplaySeed: undefined;
  Mnemonic: undefined;
  ImportWallet: undefined;
  Tokens: undefined;
  WalletManagement: undefined;
  PrivateTransfer: undefined;
  ZeroAlphaLogin: undefined;
  ZeroAlphaScreen: undefined;
  ZeroAlphaProfile: undefined;
};

export type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;
export type WalletScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Wallet'>;
export type ActivityScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Activity'>;
export type SendScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Send'>;
export type ReceiveScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Receive'>;
export type SettingsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Settings'>;
export type ThemeSelectionScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ThemeSelection'>;
export type MnemonicScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Mnemonic'>;
export type ImportWalletScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ImportWallet'>;

export interface ScreenProps {
  navigation: StackNavigationProp<RootStackParamList>;
}