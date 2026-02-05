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
import SkeletonLoader from '../components/SkeletonLoader';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { RootStackParamList } from '../types/navigation';
import { getTransactionHistory } from '../services/heliusApi';
import Constants from 'expo-constants';

const MAX_TRANSACTIONS = 10; // Only show 10 most recent transactions
const REFRESH_INTERVAL = 30000; // Check for new transactions every 30 seconds

interface ActivityScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Activity'>;
}

interface Transaction {
  signature: string;
  type: 'send' | 'receive';
  amount: number;
  timestamp: number;
  status: string;
  token?: string;
  tokenAddress?: string;
}

const getTokenLogoUrl = (tokenAddress: string | undefined): string => {
  const solLogoUrl = Constants.expoConfig?.extra?.solLogoUrl || 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png';
  if (!tokenAddress || tokenAddress === 'So11111111111111111111111111111111111111112') {
    // SOL logo
    return solLogoUrl;
  }
  // Try to get token logo from Solana token list
  return `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${tokenAddress}/logo.png`;
};

// Separate component for transaction items to properly use hooks
const TransactionItem: React.FC<{ item: Transaction; formatTime: (timestamp: number) => string }> = ({ item, formatTime }) => {
  const [imageError, setImageError] = useState(false);

  return (
    <View style={styles.activityItem}>
      <View style={styles.activityIconContainer}>
        {/* Token Logo */}
        <View style={styles.tokenLogoContainer}>
          {!imageError ? (
            <Image
              source={{ uri: getTokenLogoUrl(item.tokenAddress) }}
              style={styles.tokenLogo}
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={styles.tokenLogoFallback}>
              <Text style={styles.tokenLogoFallbackText}>
                {(item.token || 'SOL')[0]}
              </Text>
            </View>
          )}
        </View>
        {/* Direction indicator badge */}
        <View style={[
          styles.directionBadge,
          item.type === 'receive' ? styles.receiveBadge : styles.sendBadge
        ]}>
          <Ionicons
            name={item.type === 'receive' ? 'arrow-down' : 'arrow-up'}
            size={10}
            color={colors.white}
          />
        </View>
      </View>
      <View style={styles.activityDetails}>
        <Text style={styles.activityTitle}>{item.type === 'receive' ? 'Received' : 'Sent'}</Text>
        <Text style={styles.activityTime}>{formatTime(item.timestamp)}</Text>
      </View>
      <View style={styles.activityAmount}>
        <Text style={[styles.amountText, { color: item.type === 'receive' ? colors.black : colors.black }]}>
          {item.type === 'receive' ? '+' : '-'}{item.amount.toFixed(4)}
        </Text>
      </View>
    </View>
  );
};

const ActivityScreen: React.FC<ActivityScreenProps> = ({ navigation }) => {
  const { currentTheme } = useTheme();
  const { wallet, connection } = useWallet();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSignatureRef = useRef<string | null>(null);

  const fetchTransactions = async (showLoading: boolean = true) => {
    if (!wallet) {
      setLoading(false);
      return;
    }

    if (showLoading) {
      setLoading(true);
    }

    try {
      const walletAddress = wallet.publicKey.toBase58();

      // Use Helius API to fetch transaction history
      const txs = await getTransactionHistory(walletAddress, MAX_TRANSACTIONS);

      // Update last signature for comparison
      if (txs.length > 0) {
        lastSignatureRef.current = txs[0].signature;
      }

      setTransactions(txs);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchTransactions();

    // Set up auto-refresh to check for new transactions
    intervalRef.current = setInterval(() => {
      fetchTransactions(false); // Don't show loading spinner on auto-refresh
    }, REFRESH_INTERVAL);

    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [wallet, connection]);

  const formatTime = (timestamp: number) => {
    const now = Date.now() / 1000;
    const diff = now - timestamp;
    const days = Math.floor(diff / 86400);
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor(diff / 60);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <TransactionItem item={item} formatTime={formatTime} />
  );

  const renderSkeletonItem = () => (
    <View style={styles.activityItem}>
      <SkeletonLoader width={40} height={40} borderRadius={20} />
      <View style={styles.activityDetails}>
        <SkeletonLoader width={100} height={16} borderRadius={8} style={{ marginBottom: 8 }} />
        <SkeletonLoader width={80} height={14} borderRadius={6} />
      </View>
      <View style={styles.activityAmount}>
        <SkeletonLoader width={80} height={16} borderRadius={8} />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.primary }]}>
      <Header
        title="ACTIVITY"
        showBack={false}
        showAddress={true}
        onTokensPress={() => navigation.navigate('Tokens')}
      />

      {loading ? (
        <View style={styles.content}>
          <View style={styles.listContent}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((key) => (
              <View key={key}>{renderSkeletonItem()}</View>
            ))}
          </View>
        </View>
      ) : transactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={64} color={colors.gray} />
          <Text style={styles.emptyText}>No transactions yet</Text>
          <Text style={styles.emptySubtext}>Your recent activity will appear here</Text>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.transactionHeader}>
            <Text style={styles.transactionCount}>
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
          } else if (tab === 'settings') {
            navigation.navigate('Settings');
          }
        }}
      />
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
    color: colors.black,
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
    color: colors.gray,
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
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.lightGray,
  },
  tokenLogo: {
    width: '100%',
    height: '100%',
  },
  tokenLogoFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenLogoFallbackText: {
    color: colors.white,
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
    borderColor: colors.primary,
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
    color: colors.black,
  },
});

export default ActivityScreen;