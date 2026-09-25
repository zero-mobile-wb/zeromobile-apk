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
import { usePrivy, useEmbeddedSolanaWallet, useEmbeddedEthereumWallet } from '@privy-io/expo';
import { PublicKey } from '@solana/web3.js';
import { EVM_CHAINS, getEvmBalance } from '../services/chainService';
import { getErc20Balance } from '../services/evmTransferService';
import { STABLECOINS } from '../constants/stablecoins';

const USDC_LOGO = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png';
const USDC_ADDRESSES = new Set([
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
  '0x8ac76a08595d2c9e6e7bb52fda756ec9c6c771',
]);

interface SendScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Send'>;
}

const SendScreen: React.FC<SendScreenProps> = ({ navigation }) => {
  const [amount, setAmount] = useState<string>('');
  const [inputMode, setInputMode] = useState<'usd' | 'token'>('usd');
  const [loading, setLoading] = useState(true);
  const [tokens, setTokens] = useState<SelectableToken[]>([]);
  const [selectedToken, setSelectedToken] = useState<SelectableToken | undefined>();
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [showTransferTypeModal, setShowTransferTypeModal] = useState(false);
  const { currentTheme, themeId } = useTheme();
  const { wallet, connection, evmWallets } = useWallet();
  const { user } = usePrivy();
  const privySolanaWallet = useEmbeddedSolanaWallet();
  const privyEthWallet = useEmbeddedEthereumWallet();

  const privySolanaAddress = (privySolanaWallet.wallets?.[0] as any)?.address ?? null;
  const isPrivyUser = !!user && !!privySolanaAddress;
  const activeSolanaAddress = isPrivyUser ? privySolanaAddress : wallet?.publicKey.toBase58();
  const privyEvmAddress = (privyEthWallet.wallets?.[0] as any)?.address ?? null;

  useEffect(() => {
    let cancelled = false;
    const fetchTokens = async () => {
      const tokenList: SelectableToken[] = [];

      // 1. Fetch Solana tokens
      try {
        if (activeSolanaAddress) {
          const pubkey = new PublicKey(activeSolanaAddress);
          const balance = await Promise.race([
            getWalletBalance(pubkey, connection),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 25000))
          ]);
          if (cancelled) return;

          tokenList.push({
            mint: 'So11111111111111111111111111111111111111112',
            name: 'Solana',
            symbol: 'SOL',
            balance: balance.solBalance,
            priceUSD: balance.solValueUSD / (balance.solBalance || 1),
            valueUSD: balance.solValueUSD,
            logoURI: Constants.expoConfig?.extra?.solLogoUrl || 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
            chain: 'solana',
          });
          for (const token of balance.tokens) {
            tokenList.push({
              mint: token.mint,
              name: token.name,
              symbol: token.symbol,
              balance: token.uiAmount,
              priceUSD: token.priceUSD,
              valueUSD: token.valueUSD,
              logoURI: token.logoURI,
              chain: 'solana',
            });
          }
        }
      } catch (error) {
        console.error('Error fetching Solana balance:', error);
        if (tokenList.length === 0) {
          tokenList.push({
            mint: 'So11111111111111111111111111111111111111112',
            name: 'Solana',
            symbol: 'SOL',
            balance: 0,
            priceUSD: 0,
            valueUSD: 0,
            logoURI: Constants.expoConfig?.extra?.solLogoUrl || 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
            chain: 'solana',
          });
        }
      }

      // 2. Fetch EVM native + ERC-20 balances
      for (const chain of EVM_CHAINS) {
        if (cancelled) break;
        const localEvmWallet = evmWallets.find(w => w.chainId === chain.id);
        // For Privy users, use the Privy EVM address for all EVM chains (same address)
        const evmAddress = localEvmWallet?.address || (isPrivyUser && privyEvmAddress ? privyEvmAddress as `0x${string}` : undefined);
        if (!evmAddress) {
          console.log('[Send] No EVM wallet for', chain.id, 'local:', !!localEvmWallet, 'privy:', !!privyEvmAddress);
          continue;
        }
        console.log('[Send] Fetching EVM balance for', chain.id, evmAddress);

        // Native balance
        try {
          const nativeBalance = await getEvmBalance(evmAddress, chain);
          console.log('[Send]', chain.id, 'native balance:', nativeBalance);
          if (!cancelled && nativeBalance > 0.00001) {
            const ethPrice = chain.id === 'ethereum' ? 3400 : chain.id === 'base' ? 3400 : chain.id === 'polygon' ? 0.5 : 0;
            const nativeName = chain.id === 'ethereum' ? 'Ethereum' : chain.name;
            tokenList.push({
              mint: chain.id,
              name: nativeName,
              symbol: chain.nativeCurrency.symbol,
              balance: nativeBalance,
              priceUSD: ethPrice,
              valueUSD: nativeBalance * ethPrice,
              decimals: chain.decimals,
              logoURI: chain.logo,
              chain: chain.id,
            });
          }
        } catch (e) { console.log('[Send]', chain.id, 'native error:', e); }

        // ERC-20 via alchemy_getTokenBalances (discovers all tokens)
        const alchemyRpcUrl = chain.rpcUrls[0];
        if (alchemyRpcUrl.includes('alchemy.com')) {
          try {
            const resp = await fetch(alchemyRpcUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0', id: 1,
                method: 'alchemy_getTokenBalances',
                params: [evmAddress, 'erc20'],
              }),
            });
            const data = await resp.json();
            const balances = data?.result?.tokenBalances || [];
            console.log('[Send]', chain.id, 'ERC-20 tokens found:', balances.length);

            for (const bal of balances) {
              if (cancelled) break;
              if (!bal.contractAddress || bal.tokenBalance === '0x0' || bal.tokenBalance === '0') continue;

              // Get token metadata
              try {
                const metaResp = await fetch(alchemyRpcUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    jsonrpc: '2.0', id: 2,
                    method: 'alchemy_getTokenMetadata',
                    params: [bal.contractAddress],
                  }),
                });
                const metaData = await metaResp.json();
                const meta = metaData?.result;
                if (!meta) continue;

                const decimals = meta.decimals || 18;
                const rawBalance = BigInt(bal.tokenBalance);
                const humanBalance = Number(rawBalance) / Math.pow(10, decimals);
                if (humanBalance <= 0.00001) continue;

                const knownSymbols: Record<string, string> = {
                  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'USD Coin (Ethereum)',
                  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 'USD Coin (Base)',
                  '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359': 'USD Coin (Polygon)',
                  '0xaf88d065e77c8cc2239327c5edb3a432268e5831': 'USD Coin (Arbitrum)',
                  '0x8ac76a08595d2c9e6e7bb52fda756ec9c6c771': 'USD Coin (BNB Chain)',
                  '0xdac17f958d2ee523a2206206994597c13d831ec7': 'Tether (Ethereum)',
                  '0x55d398326f99059ff775485246999027b3197955': 'Tether (BNB Chain)',
                  '0xfd086bc7d6060cb9a4eb1a1c1bebc0bf5aa3142': 'Tether (Arbitrum)',
                  '0xc2132d05d31c914a87c6611c10748aeb04b58e8f': 'Tether (Polygon)',
                };

                tokenList.push({
                  mint: bal.contractAddress,
                  name: knownSymbols[bal.contractAddress.toLowerCase()] || meta.name || 'Unknown',
                  symbol: meta.symbol || '???',
                  balance: humanBalance,
                  priceUSD: 0,
                  valueUSD: 0,
                  decimals,
                  logoURI: USDC_ADDRESSES.has(bal.contractAddress.toLowerCase()) ? USDC_LOGO : (meta.logo || meta.logoURI || meta.icon || ''),
                  chainId: ({ ethereum: 1, base: 8453, polygon: 137, monad: 143, arc: 5042 } as Record<string, number>)[chain.id] || 0,
                  chain: chain.id,
                });
              } catch {}
            }
          } catch (e) { console.log('[Send]', chain.id, 'ERC-20 error:', e); }
        } else {
          // Fallback: only check known stablecoins
          for (const stablecoin of STABLECOINS) {
            if (cancelled) break;
            const chainConfig = stablecoin.chains.find(c => c.id === chain.id);
            if (!chainConfig || chainConfig.contractAddress === '0x...') continue;
            try {
              const erc20Balance = await getErc20Balance(chain.rpcUrls, chainConfig.contractAddress as `0x${string}`, evmAddress, chainConfig.decimals);
              if (!cancelled && erc20Balance && erc20Balance > 0.00001) {
                tokenList.push({
                  mint: chainConfig.contractAddress,
                  name: stablecoin.name,
                  symbol: stablecoin.symbol,
                  balance: erc20Balance,
                  priceUSD: 1,
                  valueUSD: erc20Balance,
                  decimals: chainConfig.decimals,
                  logoURI: stablecoin.logo,
                  chainId: chainConfig.evmChainId,
                  chain: chain.id,
                });
              }
            } catch {}
          }
        }
      }

      if (cancelled) return;
      setTokens(tokenList);
      setSelectedToken(tokenList[0]);
      setLoading(false);
    };

    fetchTokens();
    return () => { cancelled = true; };
  }, [wallet, connection, evmWallets, privyEvmAddress]);

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

    if (inputMode === 'usd') {
      if (selectedToken.valueUSD === 0) return true;
      if (amountNum > selectedToken.valueUSD) return true;
    } else {
      // token mode — compare against token balance
      if (selectedToken.balance === 0) return true;
      if (amountNum > selectedToken.balance) return true;
    }
    return false;
  };

  const getButtonText = () => {
    if (loading) return 'Loading...';
    if (!selectedToken) return 'Next';
    if (inputMode === 'token') {
      if (selectedToken.balance === 0) return 'Insufficient Balance';
    } else {
      if (selectedToken.valueUSD === 0) return 'Insufficient Balance';
    }
    if (!amount.trim()) return 'Next';
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return 'Next';
    if (inputMode === 'usd' && amountNum > selectedToken.valueUSD) return 'Insufficient Balance';
    if (inputMode === 'token' && amountNum > selectedToken.balance) return 'Insufficient Balance';
    return 'Next';
  };

  const handleNext = () => {
    if (!selectedToken || isButtonDisabled()) return;
    setShowTransferTypeModal(true);
  };

  const handleTransferTypeSelect = (type: TransferType) => {
    const amountNum = parseFloat(amount);
    let amountInToken: number;

    if (inputMode === 'token') {
      // Already entering token amount — use directly
      amountInToken = amountNum;
    } else {
      // Entering USD — convert to token amount
      amountInToken = selectedToken!.priceUSD > 0 ? amountNum / selectedToken!.priceUSD : 0;
    }

    navigation.navigate('EnterAddress', {
      amount: inputMode === 'usd' ? amount : amountInToken.toFixed(6),
      amountInSOL: amountInToken.toString(),
      tokenMint: selectedToken!.mint,
      tokenSymbol: selectedToken!.symbol,
      tokenDecimals: selectedToken!.decimals ?? (selectedToken!.mint === 'So11111111111111111111111111111111111111112' ? 9 : 6),
      transferType: type,
      chain: selectedToken!.chain || 'solana',
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
          <Text style={[styles.currencyText, { color: currentTheme.text }]}>
            {inputMode === 'usd' ? 'USD' : selectedToken?.symbol || 'TOKEN'}
          </Text>
        </View>
        <Text style={[styles.balanceSubtext, { color: currentTheme.textLight }]}>
          {loading || !selectedToken
            ? '...'
            : inputMode === 'usd'
              ? `$${selectedToken.valueUSD.toFixed(2)} available · tap token to enter amount`
              : `${selectedToken.balance.toFixed(4)} ${selectedToken.symbol} available`
          }
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
              if (selectedToken) {
                const half = inputMode === 'token'
                  ? selectedToken.balance / 2
                  : selectedToken.valueUSD / 2;
                setAmount(half.toFixed(6));
              }
            }}
            disabled={loading || !selectedToken || (inputMode === 'token' ? selectedToken.balance === 0 : selectedToken.valueUSD === 0)}
          >
            <Text style={[styles.quickAmountButtonText, { color: currentTheme.text }]}>Half</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickAmountButton, { backgroundColor: currentTheme.border }]}
            onPress={() => {
              if (selectedToken) {
                const max = inputMode === 'token'
                  ? selectedToken.balance
                  : selectedToken.valueUSD;
                setAmount(max.toFixed(6));
              }
            }}
            disabled={loading || !selectedToken || (inputMode === 'token' ? selectedToken.balance === 0 : selectedToken.valueUSD === 0)}
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
        onSelect={(token) => {
          setSelectedToken(token);
          setInputMode('token');
          setAmount('');
        }}
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