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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Header from '../components/Header';
import Keypad from '../components/Keypad';
import TokenSelectorModal, { SelectableToken } from '../components/TokenSelectorModal';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { RootStackParamList } from '../types/navigation';
import { getWalletBalance } from '../services/balanceService';
import Constants from 'expo-constants';

interface SendScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Send'>;
}

const SendScreen: React.FC<SendScreenProps> = ({ navigation }) => {
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [tokens, setTokens] = useState<SelectableToken[]>([]);
  const [selectedToken, setSelectedToken] = useState<SelectableToken | undefined>();
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const { currentTheme } = useTheme();
  const { wallet, connection } = useWallet();

  useEffect(() => {
    const fetchTokens = async () => {
      if (!wallet) return;

      try {
        const balance = await getWalletBalance(wallet.publicKey, connection);

        // Build token list
        const tokenList: SelectableToken[] = [
          {
            mint: 'So11111111111111111111111111111111111111112',
            name: 'Solana',
            symbol: 'SOL',
            balance: balance.solBalance,
            priceUSD: balance.solValueUSD / balance.solBalance || 0,
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
        // Set SOL as default
        setSelectedToken(tokenList[0]);
      } catch (error) {
        console.error('Error fetching balance:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTokens();
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
    if (!amount.trim()) return true;
    const amountNum = parseFloat(amount);
    if (amountNum <= 0) return true;
    if (!selectedToken) return true;
    if (selectedToken.valueUSD === 0) return true;
    if (amountNum > selectedToken.valueUSD) return true;
    return false;
  };

  const getButtonText = () => {
    if (!selectedToken) return 'Next';
    if (selectedToken.valueUSD === 0) return 'Insufficient Balance';
    if (!amount.trim()) return 'Next';
    const amountNum = parseFloat(amount);
    if (amountNum <= 0) return 'Next';
    if (amountNum > selectedToken.valueUSD) return 'Insufficient Balance';
    return 'Next';
  };

  const handleNext = () => {
    if (!selectedToken || isButtonDisabled()) return;

    const amountNum = parseFloat(amount);

    // Convert USD to token amount
    const amountInToken = selectedToken.priceUSD > 0 ? amountNum / selectedToken.priceUSD : 0;

    navigation.navigate('EnterAddress', {
      amount,
      amountInSOL: amountInToken.toString(),
      tokenMint: selectedToken.mint,
      tokenSymbol: selectedToken.symbol,
      tokenDecimals: selectedToken.mint === 'So11111111111111111111111111111111111111112' ? 9 : 6 // SOL has 9 decimals, most SPL tokens have 6
    });
  };


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.primary }]}>
      <Header
        title="Send"
        showBack={true}
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.content}>
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>
            ${loading || !selectedToken ? '...' : selectedToken.valueUSD.toFixed(2)}
          </Text>
          <Text style={styles.balanceSOL}>
            {loading || !selectedToken ? '...' : `${selectedToken.balance.toFixed(4)} ${selectedToken.symbol}`}
          </Text>
        </View>

        <View style={styles.amountContainer}>
          <TextInput
            style={styles.amountInput}
            value={amount}
            placeholder="0.00"
            placeholderTextColor={colors.gray}
            keyboardType="numeric"
            onChangeText={setAmount}
          />
          <Text style={styles.currencyText}>USD</Text>
        </View>

        {/* Token Selector and Quick Amount Buttons */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={styles.tokenSelector}
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
                <View style={[styles.tokenSelectorImage, styles.tokenSelectorImagePlaceholder]}>
                  <Text style={styles.tokenSelectorImageText}>
                    {selectedToken?.symbol[0] || '?'}
                  </Text>
                </View>
              )}
              <Text style={styles.tokenSelectorSymbol}>
                {selectedToken?.symbol || 'Select'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={colors.black} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAmountButton}
            onPress={() => {
              if (selectedToken && selectedToken.valueUSD > 0) {
                const halfValue = selectedToken.valueUSD / 2;
                setAmount(halfValue.toFixed(2));
              }
            }}
            disabled={loading || !selectedToken}
          >
            <Text style={styles.quickAmountButtonText}>Half</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAmountButton}
            onPress={() => {
              if (selectedToken && selectedToken.valueUSD > 0) {
                setAmount(selectedToken.valueUSD.toFixed(2));
              }
            }}
            disabled={loading || !selectedToken}
          >
            <Text style={styles.quickAmountButtonText}>Max</Text>
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

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, isButtonDisabled() && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={isButtonDisabled()}
        >
          <Text style={styles.nextButtonText}>{getButtonText()}</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
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
    marginVertical: 12,
    gap: 8,
  },
  tokenSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 100,
  },
  quickAmountButton: {
    backgroundColor: colors.black,
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  quickAmountButtonText: {
    color: colors.white,
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
  tokenSelectorImagePlaceholder: {
    backgroundColor: colors.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenSelectorImageText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  tokenSelectorSymbol: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.black,
  },
  balanceContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 16,
    color: colors.gray,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.black,
  },
  balanceSOL: {
    fontSize: 16,
    color: colors.gray,
    marginTop: 4,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 16,
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
    paddingVertical: 43,
  },
  nextButton: {
    backgroundColor: colors.black,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  nextButtonDisabled: {
    backgroundColor: colors.gray,
    opacity: 0.5,
  },
  nextButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default SendScreen;