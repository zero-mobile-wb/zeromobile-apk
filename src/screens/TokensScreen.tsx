import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Image,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Header from '../components/Header';
import SkeletonLoader from '../components/SkeletonLoader';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { RootStackParamList } from '../types/navigation';
import { getWalletBalance, WalletBalance } from '../services/balanceService';
import Constants from 'expo-constants';

interface TokensScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Tokens'>;
}

interface Token {
  mint: string;
  name: string;
  symbol: string;
  amount: number;
  decimals: number;
  uiAmount: number;
  priceUSD: number;
  valueUSD: number;
  image?: string;
}

const TokensScreen: React.FC<TokensScreenProps> = ({ navigation }) => {
  const { currentTheme } = useTheme();
  const { wallet, connection } = useWallet();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalValue, setTotalValue] = useState(0);

  useEffect(() => {
    const fetchTokens = async () => {
      if (!wallet) {
        setLoading(false);
        return;
      }

      try {
        // Use the improved balance service which includes prices and metadata
        const walletBalance = await getWalletBalance(wallet.publicKey, connection);

        // Build SOL token
        const solToken: Token = {
          mint: 'So11111111111111111111111111111111111111112',
          name: 'Solana',
          symbol: 'SOL',
          amount: walletBalance.solBalance * 1e9,
          decimals: 9,
          uiAmount: walletBalance.solBalance,
          priceUSD: walletBalance.solValueUSD / walletBalance.solBalance || 0,
          valueUSD: walletBalance.solValueUSD,
          image: Constants.expoConfig?.extra?.solLogoUrl || 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
        };

        // Build SPL tokens from balance service
        const splTokens: Token[] = walletBalance.tokens.map((token) => ({
          mint: token.mint,
          name: token.name,
          symbol: token.symbol,
          amount: token.balance,
          decimals: token.decimals,
          uiAmount: token.uiAmount,
          priceUSD: token.priceUSD,
          valueUSD: token.valueUSD,
          image: token.logoURI,
        }));

        setTokens([solToken, ...splTokens]);
        setTotalValue(walletBalance.totalUSD);
      } catch (error) {
        console.error('Error fetching tokens:', error);
        // Set SOL token with 0 balance on error
        setTokens([{
          mint: 'So11111111111111111111111111111111111111112',
          name: 'Solana',
          symbol: 'SOL',
          amount: 0,
          decimals: 9,
          uiAmount: 0,
          priceUSD: 0,
          valueUSD: 0,
          image: Constants.expoConfig?.extra?.solLogoUrl || 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
        }]);
        setTotalValue(0);
      } finally {
        setLoading(false);
      }
    };

    fetchTokens();
  }, [wallet, connection]);

  const TokenItem = ({ item }: { item: Token }) => {
    const [imageError, setImageError] = React.useState(false);

    return (
      <View style={styles.tokenItem}>
        <View style={styles.tokenInfo}>
          {item.image && !imageError ? (
            <Image
              source={{ uri: item.image }}
              style={styles.tokenImage}
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={[styles.tokenImage, styles.tokenImagePlaceholder]}>
              <Text style={styles.tokenImageText}>{item.symbol[0]}</Text>
            </View>
          )}
          <View style={styles.tokenDetails}>
            <Text style={styles.tokenName}>{item.name}</Text>
            <Text style={styles.tokenSymbol}>{item.symbol}</Text>
            {item.priceUSD > 0 && (
              <Text style={styles.tokenPrice}>${item.priceUSD.toFixed(4)}</Text>
            )}
          </View>
        </View>
        <View style={styles.tokenBalance}>
          <Text style={styles.tokenAmount}>{item.uiAmount.toFixed(4)}</Text>
          <Text style={styles.tokenSymbolSmall}>{item.symbol}</Text>
          {item.valueUSD > 0 && (
            <Text style={styles.tokenValue}>${item.valueUSD.toFixed(2)}</Text>
          )}
        </View>
      </View>
    );
  };

  const renderToken = ({ item }: { item: Token }) => <TokenItem item={item} />;

  const renderSkeletonItem = () => (
    <View style={styles.tokenItem}>
      <View style={styles.tokenInfo}>
        <SkeletonLoader width={40} height={40} borderRadius={20} />
        <View style={styles.tokenDetails}>
          <SkeletonLoader width={120} height={16} borderRadius={8} style={{ marginBottom: 8 }} />
          <SkeletonLoader width={60} height={14} borderRadius={6} style={{ marginBottom: 4 }} />
          <SkeletonLoader width={80} height={12} borderRadius={6} />
        </View>
      </View>
      <View style={styles.tokenBalance}>
        <SkeletonLoader width={100} height={16} borderRadius={8} style={{ marginBottom: 8 }} />
        <SkeletonLoader width={50} height={12} borderRadius={6} style={{ marginBottom: 4 }} />
        <SkeletonLoader width={70} height={12} borderRadius={6} />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.primary }]}>
      <Header
        title="Tokens"
        showBack={true}
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.content}>
        {loading ? (
          <View style={styles.listContent}>
            {[1, 2, 3, 4, 5].map((key) => (
              <View key={key}>{renderSkeletonItem()}</View>
            ))}
          </View>
        ) : (
          <FlatList
            data={tokens}
            renderItem={renderToken}
            keyExtractor={(item) => item.mint}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
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
    paddingTop: 16,
  },
  listContent: {
    paddingBottom: 20,
  },
  tokenItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tokenImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  tokenImagePlaceholder: {
    backgroundColor: colors.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenImageText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  tokenDetails: {
    flex: 1,
  },
  tokenName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.black,
    marginBottom: 4,
  },
  tokenSymbol: {
    fontSize: 14,
    color: colors.gray,
    marginBottom: 2,
  },
  tokenPrice: {
    fontSize: 12,
    color: colors.gray,
  },
  tokenBalance: {
    alignItems: 'flex-end',
  },
  tokenAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.black,
    marginBottom: 4,
  },
  tokenSymbolSmall: {
    fontSize: 12,
    color: colors.gray,
    marginBottom: 2,
  },
  tokenValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.black,
  },
});

export default TokensScreen;
