import React, { useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useTheme } from '../context/ThemeContext';
import colors from '../constants/colors';
import { HeliusTransaction } from '../services/heliusApi';

export interface Transaction extends HeliusTransaction {
  chain?: string;
}

const TOKEN_LOGOS: Record<string, string> = {
  'ETH': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
  'POL': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
  'MATIC': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
  'BNB': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png',
  'ARB': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png',
  // Generic USDC/USDT fallback (Solana/generic)
  'USDC': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  'USDT': 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
};

const CHAIN_LOGOS: Record<string, string> = {
  'ethereum': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
  'base': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png',
  'polygon': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
  'arbitrum': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png',
  'bsc': 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png',
  'arc': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
};

// For USDC/USDT we show the chain logo so the user can immediately see which network.
// For other EVM tokens (ETH, MATIC, etc.) we show the token logo directly.
const STABLECOIN_SYMBOLS = new Set(['USDC', 'USDT', 'USDS', 'EURC']);

const SOL_LOGO = 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png';

function getLogo(item: Transaction): string | undefined {
  if (!item.chain || item.chain === 'solana') {
    if (!item.tokenAddress || item.tokenAddress === 'So11111111111111111111111111111111111111112') return SOL_LOGO;
    return `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${item.tokenAddress}/logo.png`;
  }

  const token = (item.token || '').toUpperCase();
  const chain = (item.chain || '').toLowerCase();

  // For stablecoins — show the chain logo so it's clear which network this is
  if (STABLECOIN_SYMBOLS.has(token)) {
    return CHAIN_LOGOS[chain] ?? TOKEN_LOGOS[token];
  }

  // For native gas tokens — show the chain logo
  if (token === 'ETH' || token === 'POL' || token === 'MATIC' || token === 'BNB') {
    return CHAIN_LOGOS[chain] ?? TOKEN_LOGOS[token];
  }

  return TOKEN_LOGOS[token] ?? CHAIN_LOGOS[chain];
}

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

  const logoUrl = getLogo(item);
  const tokenSymbol = item.token || 'SOL';
  const chainName = item.chain && item.chain !== 'solana'
    ? item.chain.charAt(0).toUpperCase() + item.chain.slice(1)
    : null;

  return (
    <View style={styles.activityItem}>
      <View style={styles.activityIconContainer}>
        <View style={[styles.tokenLogoContainer, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
          {!imageError && logoUrl ? (
            <Image
              source={{ uri: logoUrl }}
              style={styles.tokenLogo}
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={[styles.tokenLogoFallback, { backgroundColor: currentTheme.border }]}>
              <Text style={[styles.tokenLogoFallbackText, { color: currentTheme.text }]}>
                {tokenSymbol[0]}
              </Text>
            </View>
          )}
        </View>
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
        <Text style={[styles.activityTitle, { color: currentTheme.text }]}>
          {item.type === 'receive' ? 'Received' : 'Sent'} {tokenSymbol}
        </Text>
        <Text style={[styles.activityTime, { color: currentTheme.textLight }]}>
          {formatTransactionTime(item.timestamp)}{chainName ? ` · ${chainName}` : ''}
        </Text>
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
    backgroundColor: '#10B981',
  },
  sendBadge: {
    backgroundColor: '#EF4444',
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
