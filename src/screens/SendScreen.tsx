import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Header from '../components/Header';
import Keypad from '../components/Keypad';
import TokenSelectorModal, { SelectableToken } from '../components/TokenSelectorModal';
import TransferTypeModal, { TransferType } from '../components/TransferTypeModal';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { RootStackParamList } from '../types/navigation';
import { getWalletBalance } from '../services/balanceService';
import Constants from 'expo-constants';
import { usePrivy, useEmbeddedSolanaWallet } from '@privy-io/expo';
import { PublicKey } from '@solana/web3.js';

interface SendScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Send'>;
}

const SendScreen: React.FC<SendScreenProps> = ({ navigation }) => {
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [tokens, setTokens] = useState<SelectableToken[]>([]);
  const [selectedToken, setSelectedToken] = useState<SelectableToken | undefined>();
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [showTransferTypeModal, setShowTransferTypeModal] = useState(false);
  const { currentTheme, themeId } = useTheme();
  const { wallet, connection } = useWallet();
  const { user } = usePrivy();
  const privySolanaWallet = useEmbeddedSolanaWallet();

  const privySolanaAddress = (privySolanaWallet.wallets?.[0] as any)?.address ?? null;
  const isPrivyUser = !!user && !!privySolanaAddress;
  const activeSolanaAddress = isPrivyUser ? privySolanaAddress : wallet?.publicKey.toBase58();

  useEffect(() => {
    let cancelled = false;
    const fetchTokens = async () => {
      if (!activeSolanaAddress) {
        setLoading(false);
        return;
      }

      try {
        const pubkey = new PublicKey(activeSolanaAddress);
        const balance = await Promise.race([
          getWalletBalance(pubkey, connection),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 25000))
        ]);
        if (cancelled) return;

        const tokenList: SelectableToken[] = [
          {
            mint: 'So11111111111111111111111111111111111111112',
            name: 'Solana',
            symbol: 'SOL',
            balance: balance.solBalance,
            priceUSD: balance.solValueUSD / (balance.solBalance || 1),
            valueUSD: balance.solValueUSD,
            logoURI: Constants.expoConfig?.extra?.solLogoUrl || 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
          },
          ...balance.tokens.map(token => ({
            mint: token.mint,
            name: token.name,
            symbol: token.symbol,
            balance: token.uiAmount,
            priceUSD: token.priceUSD,
            valueUSD: token.valueUSD,
            logoURI: token.logoURI,
          }))
        ];

        setTokens(tokenList);
        setSelectedToken(tokenList[0]);
      } catch (error) {
        console.error('Error fetching balance:', error);
        const fallbackTokens: SelectableToken[] = [
          {
            mint: 'So11111111111111111111111111111111111111112',
            name: 'Solana',
            symbol: 'SOL',
            balance: 0,
            priceUSD: 0,
            valueUSD: 0,
            logoURI: Constants.expoConfig?.extra?.solLogoUrl || 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
          },
        ];
        setTokens(fallbackTokens);
        setSelectedToken(fallbackTokens[0]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchTokens();
    return () => { cancelled = true; };
  }, [wallet, connection]);

  const handleKeyPress = (key: string): void => {
    if (key === 'del') {
      setAmount(amount.slice(0, -1));
    } else {
      // Prevent multiple decimal points
      if (key === '.' && amount.includes('.')) return;
      setAmount(amount + key);
    }
  };

  const isButtonDisabled = () => {
    if (loading) return true;
    if (!amount.trim()) return true;
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return true;
    if (!selectedToken) return true;
    if (selectedToken.valueUSD === 0) return true;
    if (amountNum > selectedToken.valueUSD) return true;
    return false;
  };

  const getButtonText = () => {
    if (loading) return 'Loading...';
    if (!selectedToken) return 'Next';
    if (selectedToken.valueUSD === 0) return 'Insufficient Balance';
    if (!amount.trim()) return 'Next';
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return 'Next';
    if (amountNum > selectedToken.valueUSD) return 'Insufficient Balance';
    return 'Next';
  };

  const handleNext = () => {
    if (!selectedToken || isButtonDisabled()) return;
    setShowTransferTypeModal(true);
  };

  const handleTransferTypeSelect = (type: TransferType) => {
    const amountNum = parseFloat(amount);

    // Convert USD to token amount
    const amountInToken = selectedToken!.priceUSD > 0 ? amountNum / selectedToken!.priceUSD : 0;

    navigation.navigate('EnterAddress', {
      amount,
      amountInSOL: amountInToken.toString(),
      tokenMint: selectedToken!.mint,
      tokenSymbol: selectedToken!.symbol,
      tokenDecimals: selectedToken!.mint === 'So11111111111111111111111111111111111111112' ? 9 : 6, // SOL has 9 decimals, most SPL tokens have 6
      transferType: type
    });
    setShowTransferTypeModal(false);
  };


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.primary }]}>
      <View style={styles.topGradient} pointerEvents="none">
        <LinearGradient
          colors={[currentTheme.gradientStart, 'transparent']}
          style={{ flex: 1 }}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>
      <Header
        title="Send"
        showBack={true}
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.content}>
        <View style={styles.amountContainer}>
          <TextInput
            style={[styles.amountInput, { color: currentTheme.text }]}
            value={amount}
            placeholder="0.00"
            placeholderTextColor={currentTheme.textLight}
            keyboardType="numeric"
            onChangeText={setAmount}
          />
          <Text style={[styles.currencyText, { color: currentTheme.text }]}>USD</Text>
        </View>
        <Text style={[styles.balanceSubtext, { color: currentTheme.textLight }]}>
          {loading || !selectedToken ? '...' : `${selectedToken.balance.toFixed(4)} ${selectedToken.symbol} available`}
        </Text>

        <View style={{ flex: 1 }} />

        {/* Token Selector and Quick Amount Buttons */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={[styles.tokenSelector, { backgroundColor: currentTheme.card }]}
            onPress={() => setShowTokenSelector(true)}
            disabled={loading}
          >
            <View style={styles.tokenSelectorLeft}>
              {selectedToken?.logoURI ? (
                <Image
                  source={{ uri: selectedToken.logoURI }}
                  style={styles.tokenSelectorImage}
                />
              ) : (
                <View style={[styles.tokenSelectorImage, { backgroundColor: currentTheme.border, justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={[styles.tokenSelectorImageText, { color: currentTheme.text }]}>
                    {selectedToken?.symbol[0] || '?'}
                  </Text>
                </View>
              )}
              <Text style={[styles.tokenSelectorSymbol, { color: currentTheme.text }]}>
                {selectedToken?.symbol || 'Select'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={currentTheme.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickAmountButton, { backgroundColor: currentTheme.border }]}
            onPress={() => {
              if (selectedToken && selectedToken.valueUSD > 0) {
                const halfValue = selectedToken.valueUSD / 2;
                setAmount(halfValue.toFixed(2));
              }
            }}
            disabled={loading || !selectedToken || selectedToken.valueUSD === 0}
          >
            <Text style={[styles.quickAmountButtonText, { color: currentTheme.text }]}>Half</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickAmountButton, { backgroundColor: currentTheme.border }]}
            onPress={() => {
              if (selectedToken && selectedToken.valueUSD > 0) {
                setAmount(selectedToken.valueUSD.toFixed(2));
              }
            }}
            disabled={loading || !selectedToken || selectedToken.valueUSD === 0}
          >
            <Text style={[styles.quickAmountButtonText, { color: currentTheme.text }]}>Max</Text>
          </TouchableOpacity>
        </View>

        <Keypad onKeyPress={handleKeyPress} />
      </View>

      {/* Token Selector Modal */}
      <TokenSelectorModal
        visible={showTokenSelector}
        tokens={tokens}
        selectedToken={selectedToken}
        onSelect={setSelectedToken}
        onClose={() => setShowTokenSelector(false)}
      />

      <TransferTypeModal
        visible={showTransferTypeModal}
        onSelect={handleTransferTypeSelect}
        onClose={() => setShowTransferTypeModal(false)}
      />

      <View style={styles.footer}>
        {themeId === 'white' ? (
          <TouchableOpacity
            style={[styles.nextButton, { backgroundColor: '#000', paddingVertical: 18, alignItems: 'center' }, isButtonDisabled() && { opacity: 0.8 }]}
            onPress={handleNext}
            disabled={isButtonDisabled()}
          >
            <Text style={[styles.nextButtonText, { color: '#fff' }]}>{getButtonText()}</Text>
          </TouchableOpacity>
        ) : (
          <LinearGradient
            colors={[currentTheme.gradientStart, currentTheme.gradientEnd]}
            style={[styles.nextButton, isButtonDisabled() && { opacity: 0.8 }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <TouchableOpacity
              style={styles.nextButtonInner}
              onPress={handleNext}
              disabled={isButtonDisabled()}
            >
              <Text style={[styles.nextButtonText, { color: currentTheme.btnText }]}>{getButtonText()}</Text>
            </TouchableOpacity>
          </LinearGradient>
        )}
      </View>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    opacity: 0.25,
    zIndex: 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
    gap: 8,
  },
  tokenSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 100,
  },
  quickAmountButton: {
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  quickAmountButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tokenSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenSelectorImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  tokenSelectorImageText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  tokenSelectorSymbol: {
    fontSize: 14,
    fontWeight: '600',
  },
  balanceSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginTop: 40,
  },
  amountInput: {
    fontSize: 56,
    fontWeight: 'bold',
    color: colors.black,
    textAlign: 'center',
    minWidth: 120,
  },
  currencyText: {
    fontSize: 24,
    color: colors.black,
    marginLeft: 8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  nextButton: {
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  nextButtonInner: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default SendScreen;