import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  FlatList,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Header from '../components/Header';
import Navigation from '../components/Navigation';
import EqualizerLoader from '../components/EqualizerLoader';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { useNetwork } from '../context/NetworkContext';
import { RootStackParamList } from '../types/navigation';
import { getTransactionHistory } from '../services/heliusApi';
import { usePrivy, useEmbeddedEthereumWallet } from '@privy-io/expo';
import TransactionItem, { Transaction } from '../components/TransactionItem';

const MAX_TRANSACTIONS = 10; // Only show 10 most recent transactions
const REFRESH_INTERVAL = 30000; // Check for new transactions every 30 seconds

interface ActivityScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Activity'>;
}

const ActivityScreen: React.FC<ActivityScreenProps> = ({ navigation }) => {
  const { currentTheme, themeId } = useTheme();
  const safeTheme = currentTheme as { primary: string; background: string };
  const isDark = themeId === 'dark';
  const { wallet, connection, activeSolanaAddress, isPrivyUser } = useWallet();
  const { network } = useNetwork();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSignatureRef = useRef<string | null>(null);

  const { isReady: privyReady } = usePrivy();
  const privyEthWallet = useEmbeddedEthereumWallet();
  const privyEvmAddress = (privyEthWallet.wallets?.[0] as any)?.address ?? null;
  // Privy wallets are always mainnet — override network for tx history
  const effectiveTxNetwork = isPrivyUser ? 'mainnet-beta' : network;

  console.log('[Activity] privyReady:', privyReady, 'user:', activeSolanaAddress ? 'connected' : 'none', 'active:', activeSolanaAddress);

  const fetchTransactions = async (address: string, showLoading: boolean = true) => {
    if (!address) {
      setLoading(false);
      return;
    }

    if (showLoading) {
      setLoading(true);
    }

    try {
      const effectiveNetwork = isPrivyUser ? 'mainnet-beta' : network;
      const solanaTxs = await getTransactionHistory(address, MAX_TRANSACTIONS, effectiveNetwork);

      // Fetch EVM transactions for Privy users
      let evmTxs: any[] = [];
      if (isPrivyUser && privyEvmAddress) {
        const { getAllEvmTransactions } = await import('../services/evmHistoryService');
        evmTxs = await getAllEvmTransactions(privyEvmAddress, 3);
        console.log('[Activity] EVM txs:', evmTxs.length, 'for', privyEvmAddress);
      }

      // Merge and sort by timestamp
      const allTxs = [...solanaTxs, ...evmTxs].sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_TRANSACTIONS);

      if (allTxs.length > 0) {
        lastSignatureRef.current = allTxs[0].signature;
      }

      setTransactions(allTxs);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setTransactions([]);
    } finally {
      if (showLoading) {
        setTimeout(() => setLoading(false), 800);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const addr = activeSolanaAddress;
    if (!addr) {
      console.log('[Activity] No address resolved yet; waiting for privy/wallet');
      setLoading(false);
      return;
    }

    // Initial fetch
    fetchTransactions(addr);

    // Set up auto-refresh to check for new transactions
    intervalRef.current = setInterval(() => {
      fetchTransactions(addr, false); // Don't show loading spinner on auto-refresh
    }, REFRESH_INTERVAL);

    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [wallet, connection, activeSolanaAddress, network, privyEvmAddress]);

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <TransactionItem item={item} />
  );  return (
      <SafeAreaView style={[styles.container, { backgroundColor: safeTheme.background || safeTheme.primary }]}>
      <Header
        title="Activity"
        showBack={false}
        showAddress={true}
        onTokensPress={() => navigation.navigate('Tokens')}
      />

      <EqualizerLoader visible={loading} />

      {loading ? (
        <View style={styles.content} />
      ) : transactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: currentTheme.primary }]}>No transactions yet</Text>
          <Text style={[styles.emptySubtext, { color: currentTheme.textLight }]}>Your recent activity will appear here</Text>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.transactionHeader}>
            <Text style={[styles.transactionCount, { color: currentTheme.textLight }]}>
              Showing {transactions.length} most recent transaction{transactions.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <FlatList
            data={transactions}
            renderItem={renderTransaction}
            keyExtractor={(item) => item.signature}
            contentContainerStyle={styles.listContent}
          />
        </View>
      )}

      <Navigation
        activeTab="activity"
        onTabPress={(tab) => {
          if (tab === 'wallet') {
            navigation.navigate('Wallet');
          } else if (tab === 'activity') {
            navigation.navigate('Activity');
          } else if (tab === 'swap') {
            navigation.navigate('Swap');
          } else if (tab === 'settings') {
            navigation.navigate('Settings');
          } else if (tab === 'bank') {
            navigation.navigate('SpendEmail');
          }
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listContent: {
    paddingTop: 20,
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: colors.white,
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
  },
  transactionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  transactionCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  activityIconContainer: {
    width: 40,
    height: 40,
    marginRight: 12,
    position: 'relative',
  },
  tokenLogoContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  tokenLogo: {
    width: '100%',
    height: '100%',
  },
  tokenLogoFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenLogoFallbackText: {
    color: '#000000',
    fontSize: 20,
    fontWeight: 'bold',
  },
  directionBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e9e9e9',
  },
  receiveBadge: {
    backgroundColor: '#4CAF50',
  },
  sendBadge: {
    backgroundColor: '#F44336',
  },
  activityIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityDetails: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.black,
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 14,
    color: colors.gray,
  },
  activityAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
});export default ActivityScreen;


