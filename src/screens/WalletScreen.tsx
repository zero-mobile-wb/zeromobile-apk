import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Image,
  ActivityIndicator,
  Modal,
  Animated,
  PanResponder,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useWallet } from '../context/WalletContext';
import { useCurrency } from '../context/CurrencyContext';
import Header from '../components/Header';
import Navigation from '../components/Navigation';
import SkeletonLoader from '../components/SkeletonLoader';
import CustomRefreshLoader from '../components/CustomRefreshLoader';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../types/navigation';
import { getWalletBalance, WalletBalance } from '../services/balanceService';
import { useNetwork } from '../context/NetworkContext';
import { getTransactionHistory } from '../services/heliusApi';
import TransactionItem, { Transaction } from '../components/TransactionItem';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { ZeroAlphaService } from '../services/zeroAlphaService';
import Constants from 'expo-constants';
import { ChainId, CHAINS, EVM_CHAINS, getEvmBalance } from '../services/chainService';
import ChainSetupModal from '../components/ChainSetupModal';
import { STABLECOINS, VISIBLE_CHAIN_COUNT, Stablecoin } from '../constants/stablecoins';
import { getStablecoinBalances, StablecoinBalance } from '../services/stablecoinService';
import LiquidGlassButton from '../components/LiquidGlassButton';
import LiquidGlassChainButton from '../components/LiquidGlassChainButton';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { parseSolanaPayUrl, SolanaPayParams } from '../utils/solanaPay';
import { useEmbeddedSolanaWallet, useEmbeddedEthereumWallet } from '@privy-io/expo';
import { PublicKey, Connection } from '@solana/web3.js';
import { RPC_URL } from '../context/WalletContext';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl as string;

interface WalletScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Wallet'>;
}

const WalletScreen: React.FC<WalletScreenProps> = ({ navigation }) => {
  const { currentTheme, themeId } = useTheme();
  const { wallet, connection, evmWallets, activeSolanaAddress, isPrivyUser } = useWallet();
  const privySolanaWallet = useEmbeddedSolanaWallet();
  const privyEthWallet = useEmbeddedEthereumWallet();
  const { formatAmount } = useCurrency();

  // Resolve addresses: prioritize Privy if logged in, otherwise fallback to local keypair
  const privySolanaAddress = (privySolanaWallet.wallets?.[0] as any)?.address ?? null;
  const privyEvmAddress = (privyEthWallet.wallets?.[0] as any)?.address ?? null;

  const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const { network } = useNetwork();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [evmBalances, setEvmBalances] = useState<Record<string, number>>({});
  const [loadingEvm, setLoadingEvm] = useState(false);
  const [selectedChain, setSelectedChain] = useState<ChainId | 'all' | 'evm'>('all');
  const [showChainPicker, setShowChainPicker] = useState(false);

  const [isScanning, setIsScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedPayment, setScannedPayment] = useState<SolanaPayParams | null>(null);
  const [balanceCheck, setBalanceCheck] = useState<{ loading: boolean; hasBalance: boolean; balance: number }>({ loading: true, hasBalance: false, balance: 0 });
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [stablecoinBalances, setStablecoinBalances] = useState<StablecoinBalance[]>([]);
  const [loadingStablecoins, setLoadingStablecoins] = useState(false);

  useEffect(() => {
    if (!scannedPayment || !activeSolanaAddress || !connection) return;
    setBalanceCheck({ loading: true, hasBalance: false, balance: 0 });
    (async () => {
      try {
        const ownerPubkey = new PublicKey(activeSolanaAddress);
        const mint = new PublicKey(scannedPayment.splToken);
        // getParsedTokenAccountsByOwner returns jsonParsed data so uiAmount is readable
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(ownerPubkey, { mint });
        let bal = 0;
        for (const acc of tokenAccounts.value) {
          const info = (acc.account.data as any).parsed?.info?.tokenAmount;
          if (info) bal += info.uiAmount ?? 0;
        }
        console.log('[SolanaPay] Token balance:', bal, 'required:', scannedPayment.amount);
        setBalanceCheck({ loading: false, hasBalance: bal >= scannedPayment.amount, balance: bal });
      } catch (e) {
        console.error('[SolanaPay] Balance check error:', e);
        setBalanceCheck({ loading: false, hasBalance: false, balance: 0 });
      }
    })();
  }, [scannedPayment, activeSolanaAddress, connection]);

  const executePayment = useCallback(async () => {
    if (!scannedPayment || !activeSolanaAddress || !connection) return;
    setPaymentStatus('processing');
    try {
      const decimals = 6;
      if (isPrivyUser) {
        const [web3, spl] = await Promise.all([
          import('@solana/web3.js'),
          import('@solana/spl-token'),
        ]);
        const provider = await privySolanaWallet.getProvider?.();
        if (!provider) { setPaymentStatus('error'); return; }
        const fromPubkey = new web3.PublicKey(activeSolanaAddress);
        const toPubkey = new web3.PublicKey(scannedPayment.recipient);
        const mintPubkey = new web3.PublicKey(scannedPayment.splToken);
        const fromATA = await spl.getAssociatedTokenAddress(mintPubkey, fromPubkey);
        const toATA = await spl.getAssociatedTokenAddress(mintPubkey, toPubkey);
        const amountUnits = Math.floor(scannedPayment.amount * Math.pow(10, decimals));
        const tx = new web3.Transaction();
        const toAtaInfo = await connection.getAccountInfo(toATA);
        if (!toAtaInfo) {
          tx.add(spl.createAssociatedTokenAccountInstruction(fromPubkey, toATA, toPubkey, mintPubkey));
        }
        const transferIx = spl.createTransferInstruction(fromATA, toATA, fromPubkey, amountUnits);
        if (scannedPayment.reference) {
          try {
            transferIx.keys.push({
              pubkey: new web3.PublicKey(scannedPayment.reference),
              isSigner: false,
              isWritable: false,
            });
          } catch (e) {
            console.warn('Invalid reference public key:', scannedPayment.reference);
          }
        }
        tx.add(transferIx);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = fromPubkey;

        const { signAndSendWithPrivy } = await import('../services/transactionService');
        const signature = await signAndSendWithPrivy(connection, tx, provider);
        
        try {
           await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
        } catch (confirmError: any) {
           console.log('Confirmation timeout or error, assuming sent:', confirmError.message);
        }
        setPaymentStatus('success');
        setTimeout(() => { setScannedPayment(null); setPaymentStatus('idle'); }, 1500);
      } else {
        if (!wallet) { setPaymentStatus('error'); return; }
        const { sendSPLToken } = await import('../services/transactionService');
        const result = await sendSPLToken(
          connection, 
          { type: 'keypair', keypair: wallet }, 
          scannedPayment.recipient, 
          scannedPayment.splToken, 
          scannedPayment.amount, 
          decimals,
          scannedPayment.reference
        );
        if (result.success) {
          setPaymentStatus('success');
          setTimeout(() => { setScannedPayment(null); setPaymentStatus('idle'); }, 1500);
        } else {
          setPaymentStatus('error');
        }
      }
    } catch (e) {
      console.error('[SolanaPay] Payment error:', e);
      setPaymentStatus('error');
    }
  }, [scannedPayment, activeSolanaAddress, isPrivyUser, privySolanaWallet, wallet, connection]);


  const tokenName = scannedPayment?.splToken === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' ? 'USDT' : 'USDC';

  useFocusEffect(
    React.useCallback(() => {
      const loadZeroUser = async () => {
        const user = await ZeroAlphaService.getStoredUser();
        if (user) await ZeroAlphaService.getUserStats(user.email);
      };
      loadZeroUser();
    }, [])
  );

  const fetchBalance = async (forceRefresh: boolean = false) => {
    // Privy user path — build a PublicKey from Privy address and fetch
    if (isPrivyUser && privySolanaAddress) {
      try {
        const pubkey = new PublicKey(privySolanaAddress);
        const balance = await getWalletBalance(pubkey, connection, forceRefresh);
        setWalletBalance(balance);
      } catch (e) {
        console.error('[WalletScreen] Privy balance fetch error:', e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
      return;
    }
    if (!wallet) { setLoading(false); return; }
    try {
      const balance = await getWalletBalance(wallet.publicKey, connection, forceRefresh);
      setWalletBalance(balance);
    } catch (error) {
      console.error('Error fetching balance:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchTransactions = async (address?: string) => {
    const addr = address ?? activeSolanaAddress;
    if (!addr) {
      setLoadingTxs(false);
      return;
    }
    setLoadingTxs(true);
    try {
      // Privy wallets are always on mainnet regardless of network toggle
      const effectiveNetwork = isPrivyUser ? 'mainnet-beta' : network;
      const txs = await getTransactionHistory(addr, 3, effectiveNetwork);
      setTransactions(txs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTxs(false);
    }
  };

  const onRefresh = async () => { setRefreshing(true); await Promise.all([fetchBalance(true), fetchEvmBalances(), fetchTransactions(activeSolanaAddress ?? undefined)]); };

  const quickBalance = async () => {
    const address = activeSolanaAddress;
    if (!address) return;
    try {
      const pubkey = new PublicKey(address);
      const solLamports = await connection.getBalance(pubkey);
      setWalletBalance(prev => {
        // If we already have a real balance with totalUSD or tokens, don't overwrite it with empty data
        if (prev && (prev.totalUSD > 0 || prev.tokens.length > 0)) {
          return {
            ...prev,
            solBalance: solLamports / 1e9,
          };
        }
        return {
          totalUSD: 0,
          solBalance: solLamports / 1e9,
          solValueUSD: 0,
          tokens: [],
          lastUpdated: Date.now(),
        };
      });
      setLoading(false);
    } catch {
      setLoading(false);
    }
  };

  const fetchEvmBalances = useCallback(async () => {
    const results: Record<string, number> = {};

    // Local EVM wallets (keypair-derived)
    if (evmWallets.length > 0) {
      setLoadingEvm(true);
      await Promise.all(
        evmWallets.map(async (ew) => {
          const chain = EVM_CHAINS.find(c => c.id === ew.chainId);
          if (!chain) return;
          const balance = await getEvmBalance(ew.address, chain);
          results[ew.chainId] = balance;
        })
      );
    }

    // Privy EVM wallet
    if (privyEvmAddress) {
      await Promise.all(
        EVM_CHAINS.map(async (chain) => {
          const balance = await getEvmBalance(privyEvmAddress, chain);
          results[`privy_evm_${chain.id}`] = balance;
        })
      );
    }

    setEvmBalances(results);
    setLoadingEvm(false);
  }, [evmWallets, privyEvmAddress]);

  const fetchStablecoinBalances = useCallback(async () => {
    if (!activeSolanaAddress) return;
    setLoadingStablecoins(true);
    try {
      const solAddress = activeSolanaAddress;
      const evmWalletList = evmWallets.map(w => ({ address: w.address as `0x${string}`, chainId: w.chainId }));
      if (privyEvmAddress) {
        evmWalletList.push({ address: privyEvmAddress, chainId: 'ethereum' });
      }
      const usdcPrice = walletBalance?.tokens.find((t: any) => t.symbol === 'USDC')?.priceUSD ?? 1.0;
      const balances = await getStablecoinBalances(solAddress, evmWalletList, usdcPrice, connection);
      setStablecoinBalances(balances);
    } catch (error) {
      console.error('Error fetching stablecoin balances:', error);
    } finally {
      setLoadingStablecoins(false);
    }
  }, [activeSolanaAddress, evmWallets, privyEvmAddress, walletBalance, connection]);

  useEffect(() => {
    const addr = activeSolanaAddress ?? undefined;
    quickBalance();
    fetchBalance();
    fetchEvmBalances();
    fetchTransactions(addr);
    fetchStablecoinBalances();
    const interval = setInterval(() => {
      fetchBalance(true);
      fetchEvmBalances();
      fetchTransactions(addr);
    }, 30000);
    return () => clearInterval(interval);
  }, [wallet, connection, privySolanaAddress, network]);

  useEffect(() => {
    fetchEvmBalances();
  }, [evmWallets, privyEvmAddress]);

  const chainOptions: { id: ChainId | 'all' | 'evm'; label: string; logo?: string }[] = [
    { id: 'all', label: 'All chains' },
    { id: 'solana', label: 'Solana', logo: CHAINS.solana.logo },
    { id: 'evm', label: 'EVM Chains', logo: CHAINS.ethereum.logo },
  ];

  const renderTokensTab = () => {
    const showSol = selectedChain === 'all' || selectedChain === 'solana';
    const showEvm = (id: ChainId) => selectedChain === 'all' || selectedChain === id;

    return (
      <View style={styles.tabContent}>
        {/* SOL + SPL Tokens */}
        {showSol && (
          <>
            <View style={styles.tokenItem}>
              <View style={styles.tokenInfo}>
                <Image
                  source={{ uri: Constants.expoConfig?.extra?.solLogoUrl || CHAINS.solana.logo }}
                  style={styles.tokenImage}
                />
                <View style={styles.tokenDetails}>
                  <Text style={[styles.tokenName, { color: currentTheme.text }]}>Solana</Text>
                  <Text style={[styles.tokenSymbol, { color: currentTheme.textLight }]}>SOL</Text>
                </View>
              </View>
              <View style={styles.tokenBalance}>
                <Text style={[styles.tokenAmount, { color: currentTheme.text }]}>{walletBalance?.solBalance.toFixed(3) || '0.000'}</Text>
                <Text style={[styles.tokenValue, { color: currentTheme.textLight }]}>${walletBalance?.solValueUSD.toFixed(2) || '0.00'}</Text>
              </View>
            </View>

            {walletBalance?.tokens?.filter((token: any) => !['USDC', 'USDT'].includes(token.symbol))?.map((token: any, i: number) => (
              <View key={i} style={styles.tokenItem}>
                <View style={styles.tokenInfo}>
                  {token.logoURI ? (
                    <Image source={{ uri: token.logoURI }} style={styles.tokenImage} />
                  ) : (
                    <View style={[styles.tokenImage, styles.tokenImagePlaceholder, { backgroundColor: currentTheme.border }]}>
                      <Text style={[styles.tokenImageText, { color: currentTheme.text }]}>{token.symbol?.[0] || '?'}</Text>
                    </View>
                  )}
                  <View style={styles.tokenDetails}>
                    <View style={styles.tokenNameRow}>
                      <Text style={[styles.tokenName, { color: currentTheme.text }]}>{token.name || token.symbol}</Text>
                    </View>
                    <Text style={[styles.tokenSymbol, { color: currentTheme.textLight }]}>{token.symbol}</Text>
                  </View>
                </View>
                <View style={styles.tokenBalance}>
                  <Text style={[styles.tokenAmount, { color: currentTheme.text }]}>{token.uiAmount?.toFixed(3) || '0'}</Text>
                  <Text style={[styles.tokenValue, { color: currentTheme.textLight }]}>${token.valueUSD?.toFixed(2) || '0.00'}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Stablecoin Rows (USDC/USDT) */}
        {STABLECOINS.map(sc => {
          const data = stablecoinBalances.find(b => b.symbol === sc.symbol);
          const totalBalance = data?.totalBalance ?? 0;
          const totalUSD = data?.totalUSD ?? 0;

          return (
            <TouchableOpacity
              key={sc.symbol}
              style={styles.tokenItem}
              onPress={() => navigation.navigate('TokenDetail', { tokenSymbol: sc.symbol })}
              activeOpacity={0.7}
            >
              <View style={styles.tokenInfo}>
                <Image source={{ uri: sc.logo }} style={styles.tokenImage} />
                <View style={styles.tokenDetails}>
                  <Text style={[styles.tokenName, { color: currentTheme.text }]}>{sc.name}</Text>
                  <View style={styles.chainLogosRow}>
                    {sc.chains.map((chain) => (
                      <Image
                        key={chain.id}
                        source={{ uri: chain.logo }}
                        style={styles.chainLogoSmall}
                      />
                    ))}
                  </View>
                </View>
              </View>
              <View style={styles.tokenBalance}>
                <Text style={[styles.tokenAmount, { color: currentTheme.text }]}>
                  {totalBalance > 0 ? totalBalance.toFixed(2) : '0.00'}
                </Text>
                <Text style={[styles.tokenValue, { color: currentTheme.textLight }]}>
                  ${totalUSD.toFixed(2)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* EVM Chain Tokens (local keypair) */}
        {!isPrivyUser && evmWallets.map((ew) => {
          const chain = EVM_CHAINS.find(c => c.id === ew.chainId);
          if (!chain) return null;
          const balance = evmBalances[ew.chainId];
          return (
            <View key={ew.chainId} style={styles.tokenItem}>
              <View style={styles.tokenInfo}>
                <Image source={{ uri: chain.logo }} style={styles.tokenImage} />
                <View style={styles.tokenDetails}>
                  <Text style={[styles.tokenName, { color: currentTheme.text }]}>{chain.name}</Text>
                  <Text style={[styles.tokenSymbol, { color: currentTheme.textLight }]}>{chain.symbol}</Text>
                </View>
              </View>
              <View style={styles.tokenBalance}>
                {loadingEvm ? (
                  <ActivityIndicator size="small" color={currentTheme.textLight} />
                ) : (
                  <>
                    <Text style={[styles.tokenAmount, { color: currentTheme.text }]}>
                      {balance !== undefined ? balance.toFixed(3) : '0.000'}
                    </Text>
                    <Text style={[styles.tokenValue, { color: currentTheme.textLight }]}>{chain.symbol}</Text>
                  </>
                )}
              </View>
            </View>
          );
        })}

        {/* Privy EVM wallet */}
        {privyEvmAddress && EVM_CHAINS.map(chain => (
          <View key={`privy_evm_${chain.id}`} style={styles.tokenItem}>
            <View style={styles.tokenInfo}>
              <Image source={{ uri: chain.logo }} style={styles.tokenImage} />
              <View style={styles.tokenDetails}>
                <View style={styles.tokenNameRow}>
                  <Text style={[styles.tokenName, { color: currentTheme.text }]}>{chain.name}</Text>
                  <View style={[styles.privyBadge, { backgroundColor: currentTheme.border }]}>
                    <Ionicons name="lock-closed" size={9} color={currentTheme.textLight} />
                  </View>
                </View>
                <Text style={[styles.tokenSymbol, { color: currentTheme.textLight }]}>{chain.symbol}</Text>
              </View>
            </View>
            <View style={styles.tokenBalance}>
              {loadingEvm ? (
                <ActivityIndicator size="small" color={currentTheme.textLight} />
              ) : (
                <>
                  <Text style={[styles.tokenAmount, { color: currentTheme.text }]}>
                    {evmBalances[`privy_evm_${chain.id}`] !== undefined ? evmBalances[`privy_evm_${chain.id}`].toFixed(3) : '0.000'}
                  </Text>
                  <Text style={[styles.tokenValue, { color: currentTheme.textLight }]}>{chain.symbol}</Text>
                </>
              )}
            </View>
          </View>
        ))}

        {/* Transaction History */}
        <View style={styles.txHistorySection}>
          <Text style={[styles.txHistoryTitle, { color: currentTheme.text }]}>Transaction History</Text>
          {loadingTxs ? (
            <ActivityIndicator size="small" color={currentTheme.textLight} style={{ marginVertical: 20 }} />
          ) : transactions.length === 0 ? (
            <View style={styles.txHistoryEmpty}>
              <Ionicons name="receipt-outline" size={24} color={currentTheme.textLight} />
              <Text style={[styles.txHistoryEmptyText, { color: currentTheme.textLight }]}>No transactions yet</Text>
            </View>
          ) : (
            <View>
              {transactions.map((tx) => (
                <TransactionItem key={tx.signature} item={tx} />
              ))}
              <TouchableOpacity onPress={() => navigation.navigate('Activity')} style={{ alignItems: 'center', marginTop: 12 }}>
                <Text style={{ color: currentTheme.textLight, fontSize: 14 }}>View all activity</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.primary }]}>
      <ChainSetupModal />

      {/* Background gradient behind header + balance */}
      <View style={styles.topGradient} pointerEvents="none">
        <LinearGradient
          colors={[currentTheme.gradientStart, 'transparent']}
          style={{ flex: 1 }}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>

      <Header
        showAddress={true}
        onTokensPress={() => navigation.navigate('Tokens')}
        showBrowser={true}
        onBrowserPress={() => navigation.navigate('Browser')}
        onCreateInvoice={() => navigation.navigate('Business' as any)}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="transparent" colors={['transparent']} style={{ opacity: 0 }} progressBackgroundColor="transparent" />
        }
      >
        {refreshing && (
          <View style={styles.customRefreshLoader}>
            <CustomRefreshLoader size={40} />
          </View>
        )}

        {/* Balance */}
        <View style={styles.balanceSection}>
          <View style={[styles.balanceInfo, { alignSelf: 'stretch' }]}>
            <Text style={[styles.balanceLabel, { color: currentTheme.text, textAlign: 'center' }]}>Total value</Text>
            {loading ? (
              <View style={styles.skeletonContainer}>
                <SkeletonLoader width={200} height={48} borderRadius={12} />
                <View style={{ height: 8 }} />
                <SkeletonLoader width={100} height={16} borderRadius={8} />
              </View>
            ) : (
              <>
                <Text style={[styles.balanceAmount, { color: currentTheme.text, textAlign: 'center' }]} numberOfLines={1} adjustsFontSizeToFit>
                  {walletBalance ? formatAmount(walletBalance.totalUSD) : formatAmount(0)}
                </Text>
                {walletBalance && <Text style={[styles.solBalanceText, { color: currentTheme.textLight, textAlign: 'center' }]}>{walletBalance.solBalance.toFixed(4)} SOL</Text>}
              </>
            )}
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActionsGrid}>
            <View style={styles.quickActionsRow}>
              <View style={styles.quickActionItem}>
                <LiquidGlassButton size={64} onPress={() => navigation.navigate('Send')}>
                  <Ionicons name="arrow-up" size={24} color={currentTheme.text} />
                </LiquidGlassButton>
                <Text style={[styles.quickActionLabel, { color: currentTheme.textLight }]}>Send</Text>
              </View>
              <View style={styles.quickActionItem}>
                <LiquidGlassButton size={64} onPress={() => navigation.navigate('Receive')}>
                  <Ionicons name="arrow-down" size={24} color={currentTheme.text} />
                </LiquidGlassButton>
                <Text style={[styles.quickActionLabel, { color: currentTheme.textLight }]}>Receive</Text>
              </View>
              <View style={styles.quickActionItem}>
                <LiquidGlassButton size={64} onPress={async () => {
                  if (!permission?.granted) {
                    const { granted } = await requestPermission();
                    if (!granted) return;
                  }
                  setScannedPayment(null);
                  setIsScanning(true);
                }}>
                  <Image source={require('../assets/scanner.png')} style={[styles.scanIconImage, { tintColor: currentTheme.text }]} />
                </LiquidGlassButton>
                <Text style={[styles.quickActionLabel, { color: currentTheme.textLight }]}>Scan</Text>
              </View>
              <View style={styles.quickActionItem}>
                <LiquidGlassButton size={64} onPress={() => navigation.navigate('Activity')}>
                  <MaterialCommunityIcons name="history" size={24} color={currentTheme.text} />
                </LiquidGlassButton>
                <Text style={[styles.quickActionLabel, { color: currentTheme.textLight }]}>History</Text>
              </View>
            </View>
          </View>

          {/* Chain Selector */}
          <View style={styles.chainSelectorRow}>
            <LiquidGlassChainButton onPress={() => setShowChainPicker(true)}>
              <Ionicons name="chevron-down" size={18} color={currentTheme.text} />
              <Text style={[styles.chainSelectorText, { color: currentTheme.text }]}>
                {selectedChain === 'all' ? 'All chains' : selectedChain === 'evm' ? 'EVM (ETH / MON)' : CHAINS[selectedChain]?.name || 'Select chain'}
              </Text>
            </LiquidGlassChainButton>
            <TouchableOpacity onPress={() => navigation.navigate('Tokens')}>
              <Ionicons name="options-outline" size={20} color={currentTheme.text} />
            </TouchableOpacity>
          </View>

          {renderTokensTab()}

          {/* Chain Picker Modal */}
          <Modal visible={showChainPicker} transparent animationType="fade" onRequestClose={() => setShowChainPicker(false)}>
            <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowChainPicker(false)}>
              <View style={[styles.pickerSheet, { backgroundColor: currentTheme.card }]}>
                <View style={[styles.pickerHandle, { backgroundColor: currentTheme.border }]} />
                <Text style={[styles.pickerTitle, { color: currentTheme.text }]}>Select Chain</Text>
                {chainOptions.map(opt => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.pickerOption, { backgroundColor: currentTheme.card }, selectedChain === opt.id && { backgroundColor: currentTheme.border }]}
                    onPress={() => {
                      setSelectedChain(opt.id);
                      setShowChainPicker(false);
                    }}
                  >
                    {opt.id !== 'all' && opt.logo ? (
                      <Image source={{ uri: opt.logo }} style={styles.pickerOptionImage} />
                    ) : (
                      <View style={[styles.pickerOptionIcon, { backgroundColor: currentTheme.border }]}>
                        <Ionicons name="layers-outline" size={20} color={currentTheme.text} />
                      </View>
                    )}
                    <Text style={[styles.pickerOptionText, { color: currentTheme.text }, selectedChain === opt.id && { fontWeight: '700' }]}>
                      {opt.label}
                    </Text>
                    {selectedChain === opt.id && (
                      <Ionicons name="checkmark" size={20} color={currentTheme.text} style={{ marginLeft: 'auto' }} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>
        </View>

        <View style={styles.spacer} />
        {/* Scanner Modal */}
        <Modal visible={isScanning} animationType="slide" transparent={false}>
          <View style={styles.cameraContainer}>
            <View style={styles.cameraHeader}>
              <TouchableOpacity onPress={() => setIsScanning(false)} style={styles.cameraCloseButton}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={({ data }) => {
                setIsScanning(false);
                const parsed = parseSolanaPayUrl(data);
                if (parsed) {
                  setScannedPayment(parsed);
                } else {
                  const addr = data.replace('solana:', '').split('?')[0];
                  if (addr.length >= 32) navigation.navigate('Send');
                }
              }}
            />
            <View style={styles.overlay}>
              <View style={styles.scanTarget} />
              <Text style={styles.scanText}>Scan Solana Pay QR</Text>
            </View>
          </View>
        </Modal>

        {/* Payment Details Modal */}
        <Modal visible={!!scannedPayment} animationType="slide" transparent>
          <TouchableOpacity style={styles.paymentOverlay} activeOpacity={1} onPress={() => setScannedPayment(null)}>
            <TouchableOpacity style={[styles.paymentSheet, { backgroundColor: currentTheme.card }]} activeOpacity={1}>
              <View style={[styles.paymentHandle, { backgroundColor: currentTheme.border }]} />
              {scannedPayment && (
                <>
                  <View style={styles.paymentAmountRow}>
                    <Text style={[styles.paymentAmountLabel, { color: currentTheme.textLight }]}>Amount</Text>
                    <Text style={[styles.paymentAmountValue, { color: currentTheme.text }]}>{scannedPayment.amount.toFixed(2)} {tokenName}</Text>
                  </View>
                  <View style={styles.paymentAmountRow}>
                    <Text style={[styles.paymentAmountLabel, { color: currentTheme.textLight }]}>Network</Text>
                    <Text style={[styles.paymentAmountValue, { color: currentTheme.text }]}>Solana</Text>
                  </View>
                  {scannedPayment.message && (
                    <View style={styles.paymentAmountRow}>
                      <Text style={[styles.paymentAmountLabel, { color: currentTheme.textLight }]}>Memo</Text>
                      <Text style={[styles.paymentAmountValue, { color: currentTheme.text }]}>{scannedPayment.message}</Text>
                    </View>
                  )}
                  <View style={styles.paymentAmountRow}>
                    <Text style={[styles.paymentAmountLabel, { color: currentTheme.textLight }]}>From</Text>
                    <Text style={[styles.paymentAmountValue, { color: currentTheme.text }]}>{scannedPayment.label || 'Merchant'}</Text>
                  </View>

                  {balanceCheck.loading ? (
                    <View style={styles.balanceCheckRow}>
                      <ActivityIndicator size="small" color={currentTheme.text} />
                      <Text style={[styles.balanceCheckText, { color: currentTheme.textLight }]}>Checking balance...</Text>
                    </View>
                  ) : !balanceCheck.hasBalance ? (
                    <View style={styles.balanceCheckRow}>
                      <Ionicons name="alert-circle" size={20} color="#ef4444" />
                      <Text style={[styles.balanceCheckText, { color: '#ef4444' }]}>Insufficient {tokenName} balance</Text>
                    </View>
                  ) : paymentStatus === 'processing' ? (
                    <View style={[styles.payStatusCard, { backgroundColor: currentTheme.border }]}>
                      <ActivityIndicator size="large" color={currentTheme.text} />
                      <Text style={[styles.payStatusText, { color: currentTheme.text }]}>Processing payment...</Text>
                    </View>
                  ) : paymentStatus === 'success' ? (
                    <View style={[styles.payStatusCard, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
                      <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
                      <Text style={[styles.payStatusText, { color: '#22c55e', fontSize: 18 }]}>Payment sent!</Text>
                    </View>
                  ) : paymentStatus === 'error' ? (
                    <View style={[styles.payStatusCard, { backgroundColor: currentTheme.border }]}>
                      <Ionicons name="close-circle" size={48} color="#ef4444" />
                      <Text style={[styles.payStatusText, { color: '#ef4444' }]}>Payment failed</Text>
                      <TouchableOpacity onPress={() => { setPaymentStatus('idle'); }}>
                        <Text style={[styles.cancelText, { color: currentTheme.textLight }]}>Try again</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      {themeId === 'white' ? (
                        <TouchableOpacity
                          style={[styles.payButton, { backgroundColor: '#000' }]}
                          onPress={executePayment}
                        >
                          <View style={styles.payButtonInner}>
                            <Ionicons name="send" size={18} color="#fff" />
                            <Text style={[styles.payButtonText, { color: '#fff' }]}>
                              Pay {scannedPayment.amount.toFixed(2)} {tokenName}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ) : (
                        <LinearGradient
                          colors={[currentTheme.gradientStart, currentTheme.gradientEnd]}
                          style={styles.payButton}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          <TouchableOpacity style={styles.payButtonInner} onPress={executePayment}>
                            <Ionicons name="send" size={18} color={currentTheme.btnText} />
                            <Text style={[styles.payButtonText, { color: currentTheme.btnText }]}>
                              Pay {scannedPayment.amount.toFixed(2)} {tokenName}
                            </Text>
                          </TouchableOpacity>
                        </LinearGradient>
                      )}
                      <TouchableOpacity
                        onPress={() => { setScannedPayment(null); setPaymentStatus('idle'); }}
                        style={styles.cancelButton}
                      >
                        <Text style={[styles.cancelText, { color: currentTheme.textLight }]}>Cancel</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </ScrollView>

      <Navigation
        activeTab="wallet"
        onTabPress={(tab) => {
          if (tab === 'wallet') navigation.navigate('Wallet');
          else if (tab === 'swap') navigation.navigate('Swap');
          else if (tab === 'activity') navigation.navigate('Activity');
          else if (tab === 'settings') navigation.navigate('Settings');
          else if (tab === 'bank') navigation.navigate('SpendEmail');
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 200, opacity: 0.25, zIndex: 0 },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20 },
  balanceSection: { marginTop: 4, marginBottom: 16, width: '100%' },
  balanceInfo: { alignItems: 'center', alignSelf: 'stretch', width: '100%' },
  balanceLabel: { fontSize: 16, color: colors.black, fontWeight: '500' },
  balanceAmount: { fontSize: 70, fontWeight: '700', color: colors.black, letterSpacing: -1, marginTop: 4, marginBottom: 0 },
  solBalanceText: { fontSize: 16, color: colors.gray, marginTop: 0, marginBottom: 4, fontWeight: '500' },
  skeletonContainer: { marginTop: 8 },
  quickActionsGrid: { gap: 12, marginTop: 24 },
  quickActionsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 },

  quickActionItem: { flex: 1, alignItems: 'center', gap: 6 },
  quickActionButton: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  scanIconImage: { width: 24, height: 24, resizeMode: 'contain' },
  quickActionIcon: { width: 22, height: 22, resizeMode: 'contain' },
  quickActionLabel: { fontSize: 11, fontWeight: '500' },
  customRefreshLoader: { position: 'absolute', top: 20, alignSelf: 'center', zIndex: 1000 },
  spacer: { flex: 1, minHeight: 40 },

  // Chain Selector
  chainSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
  },
  chainSelectorText: { fontSize: 15, fontWeight: '600', color: colors.black },
  tabContent: { marginTop: 16, width: '100%' },

  // Chain Picker Modal
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  pickerHandle: { width: 40, height: 4, borderRadius: 99, alignSelf: 'center', marginBottom: 20 },
  pickerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.black, marginBottom: 16 },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 4,
    gap: 12,
  },
  pickerOptionImage: { width: 32, height: 32, borderRadius: 16 },
  pickerOptionIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  pickerOptionText: { fontSize: 16, fontWeight: '500' },

  // Tokens - matching TokensScreen style
  tokenItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  tokenInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  tokenImage: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  tokenImageContainer: { position: 'relative', width: 40, height: 40 },
  tokenImagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  tokenImageText: { fontSize: 18, fontWeight: 'bold' },
  tokenDetails: { flex: 1 },
  tokenName: { fontSize: 17, fontWeight: '600', color: colors.black, marginBottom: 4 },
  tokenSymbol: { fontSize: 15, color: colors.gray },
  tokenBalance: { alignItems: 'flex-end' },
  tokenAmount: { fontSize: 18, fontWeight: 'bold', color: colors.black, marginBottom: 4 },
  tokenValue: { fontSize: 14, fontWeight: '500', color: colors.gray },

  // Chain logos row under stablecoin name
  chainLogosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  chainLogoSmall: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },

  // Transaction History
  txHistorySection: { marginTop: 32, marginBottom: 16 },
  txHistoryTitle: { fontSize: 16, fontWeight: '600', color: colors.black, marginBottom: 16 },
  txHistoryEmpty: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 24, justifyContent: 'center' },
  txHistoryEmptyText: { fontSize: 14, color: colors.gray },

  tokenNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  privyBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingTop: 50, paddingHorizontal: 20 },
  cameraCloseButton: { alignSelf: 'flex-end', padding: 8 },
  closeButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  overlay: { position: 'absolute', top: 120, left: 0, right: 0, alignItems: 'center' },
  scanTarget: { width: 200, height: 200, borderWidth: 2, borderColor: '#fff', borderRadius: 16 },
  scanText: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 16 },

  paymentOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  paymentSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingTop: 12, gap: 20 },
  paymentHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  paymentMerchantInfo: { flex: 1 },
  paymentMerchantName: { fontSize: 17, fontWeight: '700' },
  paymentMerchantDesc: { fontSize: 13, fontWeight: '400', marginTop: 2 },
  paymentDivider: { height: 1, marginVertical: 4 },
  paymentAmountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paymentAmountLabel: { fontSize: 14, fontWeight: '500' },
  paymentAmountValue: { fontSize: 16, fontWeight: '700' },
  slideOuter: { height: 52, borderRadius: 26, justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  slideFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 26 },
  slideText: { textAlign: 'center', fontSize: 15, fontWeight: '600', color: '#fff' },
  slideThumb: { position: 'absolute', left: 2, top: 2, bottom: 2, width: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center' },
  balanceCheckRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  balanceCheckText: { fontSize: 14, fontWeight: '500' },
  payStatusCard: { alignItems: 'center', padding: 24, borderRadius: 16, gap: 12 },
  payStatusText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  payButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 4,
  },
  payButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  payButtonText: {
    fontSize: 17,
    fontWeight: '700',
  },
  cancelButton: { alignItems: 'center', paddingVertical: 8 },
  cancelText: { fontSize: 15, fontWeight: '500', padding: 8 },
});

export default WalletScreen;
