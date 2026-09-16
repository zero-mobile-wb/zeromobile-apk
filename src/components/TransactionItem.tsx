import React, { useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useTheme } from '../context/ThemeContext';
import colors from '../constants/colors';
import { HeliusTransaction } from '../services/heliusApi';

export interface Transaction extends HeliusTransaction {
  // Can extend if needed
}

export const getTokenLogoUrl = (tokenAddress: string | undefined): string => {
  const solLogoUrl = Constants.expoConfig?.extra?.solLogoUrl || 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png';
  if (!tokenAddress || tokenAddress === 'So11111111111111111111111111111111111111112') {
    return solLogoUrl;
  }
  return `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${tokenAddress}/logo.png`;
};

export const formatTransactionTime = (timestamp: number) => {
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

interface TransactionItemProps {
  item: Transaction;
}

const TransactionItem: React.FC<TransactionItemProps> = ({ item }) => {
  const [imageError, setImageError] = useState(false);
  const { currentTheme } = useTheme();

  return (
    <View style={styles.activityItem}>
      <View style={styles.activityIconContainer}>
        {/* Token Logo */}
        <View style={[styles.tokenLogoContainer, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
          {!imageError ? (
            <Image
              source={{ uri: getTokenLogoUrl(item.tokenAddress) }}
              style={styles.tokenLogo}
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={[styles.tokenLogoFallback, { backgroundColor: currentTheme.border }]}>
              <Text style={[styles.tokenLogoFallbackText, { color: currentTheme.text }]}>
                {(item.token || 'SOL')[0]}
              </Text>
            </View>
          )}
        </View>
        {/* Direction indicator badge */}
        <View style={[
          styles.directionBadge,
          { borderColor: currentTheme.primary },
          item.type === 'receive' ? styles.receiveBadge : styles.sendBadge
        ]}>
          <Ionicons
            name={item.type === 'receive' ? 'arrow-down' : 'arrow-up'}
            size={10}
            color={currentTheme.text}
          />
        </View>
      </View>
      <View style={styles.activityDetails}>
        <Text style={[styles.activityTitle, { color: currentTheme.text }]}>{item.type === 'receive' ? 'Received' : 'Sent'}</Text>
        <Text style={[styles.activityTime, { color: currentTheme.textLight }]}>{formatTransactionTime(item.timestamp)}</Text>
      </View>
      <View style={styles.activityAmount}>
        <Text style={[styles.amountText, { color: currentTheme.text }]}>
          {item.type === 'receive' ? '+' : '-'}{item.amount.toFixed(4)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 0,
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
    borderWidth: 2,
  },
  tokenLogo: {
    width: '100%',
    height: '100%',
  },
  tokenLogoFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenLogoFallbackText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  directionBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  receiveBadge: {
    backgroundColor: '#10B981', // Green
  },
  sendBadge: {
    backgroundColor: '#EF4444', // Red
  },
  activityDetails: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 13,
  },
  activityAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TransactionItem;
