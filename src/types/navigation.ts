import { StackNavigationProp } from '@react-navigation/stack';

export type RootStackParamList = {
  Home: undefined;
  Lock: undefined;
  Auth: undefined;
  Wallet: undefined;
  Activity: undefined;
  Swap: { inputToken?: string; inputSymbol?: string; outputToken?: string; outputSymbol?: string } | undefined;
  Send: undefined;
  EnterAddress: {
    amount: string;
    amountInSOL: string;
    tokenMint: string;
    tokenSymbol: string;
    tokenDecimals: number;
    transferType?: 'Public' | 'Private';
    chain?: string;
  };
  SendDetails: {
    amount: string;
    amountInSOL: string;
    address: string;
    tokenMint: string;
    tokenSymbol: string;
    tokenDecimals: number;
    transferType?: 'Public' | 'Private';
    chain?: string;
  };
  Transaction: {
    amount: string;
    amountInSOL: string;
    address: string;
    tokenMint: string;
    tokenSymbol: string;
    tokenDecimals: number;
    status: 'submitting' | 'success' | 'error';
    transferType?: 'Public' | 'Private';
    chain?: string;
  };
  Receive: undefined;
  Onramp: undefined;
  Withdraw: undefined;
  Browser: { initialUrl?: string } | undefined;
  Settings: undefined;
  ThemeSelection: undefined;
  CurrencySelection: undefined;
  DisplaySeed: undefined;
  Mnemonic: undefined;
  ImportWallet: undefined;
  CreateInvoice: undefined;
  Business: undefined;
  Tokens: undefined;
  SpendEmail: undefined;
  SpendLogin: { email?: string } | undefined;
  SpendForgotPassword: undefined;
  SpendOtp: { email: string };
  SpendPassword: { email: string; otp: string };
  SpendLinkAccount: undefined;
  SpendDashboard: undefined;
  SpendActions: { open?: 'send' } | undefined;
  SpendTransactions: undefined;
  SpendSettings: undefined;
  SpendNotifications: undefined;
  SpendFundraisers: { kind?: 'fundraiser' | 'regular' } | undefined;
  SpendFundraiser: { slug: string };
  WalletManagement: undefined;
  ZeroAlphaLogin: undefined;
  ZeroAlphaPoints: undefined;
  ZeroAlphaProfile: undefined;
  ZeroAlphaRewards: undefined;
  AdapterConnect: {
    callback: string;
    id: string;
    isInternal?: boolean;
  };
  ManageWalletModal: undefined;
  TokenDetail: { tokenSymbol: string; tokenName?: string; tokenLogo?: string; tokenMint?: string; priceUSD?: number; coingeckoId?: string };
  SecurityWarning: { type: 'privateKey' | 'mnemonic' };
  ShowSecret: { type: 'privateKey' | 'mnemonic' };
  AdapterSign: {
    type: 'signTransaction' | 'signAll' | 'signMessage';
    payload: string;
    callback: string;
    id: string;
    network?: string;
  };
  AdapterSignAll: {
    type: 'signTransaction' | 'signAll' | 'signMessage';
    payload: string;
    callback: string;
    id: string;
    network?: string;
  };
  AdapterSignMessage: {
    type: 'signTransaction' | 'signAll' | 'signMessage';
    payload: string;
    callback: string;
    id: string;
    network?: string;
  };

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