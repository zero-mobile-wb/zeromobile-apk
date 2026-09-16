import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Image,
  TouchableOpacity,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import Header from '../components/Header';
import SkeletonLoader from '../components/SkeletonLoader';
import LiquidGlassButton from '../components/LiquidGlassButton';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { RootStackParamList } from '../types/navigation';
import { getWalletBalance, WalletBalance } from '../services/balanceService';
import { usePrivy, useEmbeddedSolanaWallet, useEmbeddedEthereumWallet } from '@privy-io/expo';
import { PublicKey } from '@solana/web3.js';
import { getEvmBalance, EVM_CHAINS } from '../services/chainService';
import { STABLECOINS, Stablecoin } from '../constants/stablecoins';
import { getStablecoinBalances, StablecoinBalance } from '../services/stablecoinService';
import { fetchPreStockBalances, PreStockBalance } from '../services/prestockService';
const COINGECKO_IDS: Record<string, string> = {
  SOL: 'solana',
  ETH: 'ethereum',
  MATIC: 'matic-network',
  MON: 'monad',
};

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
  isStablecoin?: boolean;
  stablecoinData?: Stablecoin;
}

const TokensScreen: React.FC<TokensScreenProps> = ({ navigation }) => {
  const { currentTheme } = useTheme();
  const { wallet, connection, activeSolanaAddress, evmWallets } = useWallet();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalValue, setTotalValue] = useState(0);
  const [stablecoinBalances, setStablecoinBalances] = useState<StablecoinBalance[]>([]);
  const [viewMode, setViewMode] = useState<'tokens' | 'prestocks'>('tokens');
  const [preStocks, setPreStocks] = useState<PreStockBalance[]>([]);
  const [loadingPreStocks, setLoadingPreStocks] = useState(false);

  const { user } = usePrivy();
  const privySolanaWallet = useEmbeddedSolanaWallet();
  const privyEthWallet = useEmbeddedEthereumWallet();
  const privySolanaAddress = (privySolanaWallet.wallets?.[0] as any)?.address ?? null;
  const privyEvmAddress = (privyEthWallet.wallets?.[0] as any)?.address ?? null;
  const isPrivyUser = !!user && !!privySolanaAddress;

  useEffect(() => {
    const fetchTokens = async () => {
      if (!activeSolanaAddress) {
        setLoading(false);
        return;
      }

      try {
        const pubkey = new PublicKey(activeSolanaAddress);
        const walletBalance = await getWalletBalance(pubkey, connection);

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

        const splTokens: Token[] = walletBalance.tokens
          .filter((token: any) => !['USDC', 'USDT'].includes(token.symbol))
          .map((token) => ({
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

        const evmTokens: Token[] = [];
        if (isPrivyUser && privyEvmAddress) {
          await Promise.all(
            EVM_CHAINS.map(async (chain) => {
              const ethBalance = await getEvmBalance(privyEvmAddress, chain);
              evmTokens.push({
                mint: chain.id,
                name: chain.name,
                symbol: chain.symbol,
                amount: ethBalance * Math.pow(10, chain.decimals),
                decimals: chain.decimals,
                uiAmount: ethBalance,
                priceUSD: 0,
                valueUSD: 0,
                image: chain.logo,
              });
            })
          );
        }

        // Build stablecoin tokens for the unified list
        const scTokens: Token[] = STABLECOINS.map(sc => ({
          mint: `stablecoin_${sc.symbol}`,
          name: sc.name,
          symbol: sc.symbol,
          amount: 0,
          decimals: 6,
          uiAmount: 0,
          priceUSD: 1.0,
          valueUSD: 0,
          image: sc.logo,
          isStablecoin: true,
          stablecoinData: sc,
        }));

        // Fetch stablecoin balances
        let scBalances: StablecoinBalance[] = [];
        const evmWalletList = evmWallets.map(w => ({ address: w.address as `0x${string}`, chainId: w.chainId }));
        if (privyEvmAddress) {
          evmWalletList.push({ address: privyEvmAddress, chainId: 'ethereum' });
        }
        scBalances = await getStablecoinBalances(activeSolanaAddress, evmWalletList, 1.0, connection);
        setStablecoinBalances(scBalances);

        // Update stablecoin tokens with real balances
        const enrichedScTokens = scTokens.map(st => {
          const bal = scBalances.find(b => b.symbol === st.symbol);
          return {
            ...st,
            uiAmount: bal?.totalBalance ?? 0,
            valueUSD: bal?.totalUSD ?? 0,
          };
        });

        // Unified list: SOL first, then stablecoins, then other tokens, then EVM
        setTokens([solToken, ...enrichedScTokens, ...splTokens, ...evmTokens]);
        setTotalValue(walletBalance.totalUSD);
      } catch (error) {
        console.error('Error fetching tokens:', error);
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

  useEffect(() => {
    const fetchPreStocksData = async () => {
      if (!activeSolanaAddress || !connection) return;
      setLoadingPreStocks(true);
      try {
        const balances = await fetchPreStockBalances(connection, activeSolanaAddress);
        setPreStocks(balances);
      } catch (e) {
        console.error('PreStocks fetch error:', e);
      } finally {
        setLoadingPreStocks(false);
      }
    };
    fetchPreStocksData();
  }, [activeSolanaAddress, connection]);

  const TokenItem = ({ item }: { item: Token }) => {
    const [imageError, setImageError] = useState(false);

    // Stablecoin row with chain logos
    if (item.isStablecoin && item.stablecoinData) {
      const sc = item.stablecoinData;
      return (
        <TouchableOpacity
          style={[styles.tokenItem, { backgroundColor: currentTheme.card }]}
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
              {item.uiAmount > 0 ? item.uiAmount.toFixed(2) : '0.00'}
            </Text>
            <Text style={[styles.tokenValue, { color: currentTheme.text }]}>
              ${item.valueUSD.toFixed(2)}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    // Regular token row
    return (
      <TouchableOpacity
        style={[styles.tokenItem, { backgroundColor: currentTheme.card }]}
        onPress={() => navigation.navigate('TokenDetail', {
          tokenSymbol: item.symbol,
          tokenName: item.name,
          tokenLogo: item.image,
          tokenMint: item.mint,
          priceUSD: item.priceUSD,
          coingeckoId: COINGECKO_IDS[item.symbol],
        })}
        activeOpacity={0.7}
      >
        <View style={styles.tokenInfo}>
          {item.image && !imageError ? (
            <Image
              source={{ uri: item.image }}
              style={styles.tokenImage}
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={[styles.tokenImage, styles.tokenImagePlaceholder, { backgroundColor: currentTheme.secondary }]}>
              <Text style={[styles.tokenImageText, { color: currentTheme.primary }]}>{item.symbol[0]}</Text>
            </View>
          )}
          <View style={styles.tokenDetails}>
            <View style={styles.tokenNameRow}>
              <Text style={[styles.tokenName, { color: currentTheme.text }]}>{item.name}</Text>
              {isPrivyUser && ['ethereum', 'polygon', 'monad'].includes(item.mint) && (
                <Ionicons name="lock-closed" size={10} color={currentTheme.textLight} style={{ marginLeft: 4 }} />
              )}
            </View>
            <Text style={[styles.tokenSymbol, { color: currentTheme.textLight }]}>{item.symbol}</Text>
            {item.priceUSD > 0 && (
              <Text style={[styles.tokenPrice, { color: currentTheme.textLight }]}>${item.priceUSD.toFixed(4)}</Text>
            )}
          </View>
        </View>
        <View style={styles.tokenBalance}>
          <Text style={[styles.tokenAmount, { color: currentTheme.text }]}>{item.uiAmount.toFixed(4)}</Text>
          <Text style={[styles.tokenSymbolSmall, { color: currentTheme.textLight }]}>{item.symbol}</Text>
          {item.valueUSD > 0 && (
            <Text style={[styles.tokenValue, { color: currentTheme.text }]}>${item.valueUSD.toFixed(2)}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderToken = ({ item }: { item: Token }) => <TokenItem item={item} />;

  const handleBuyPreStock = useCallback((stock: PreStockBalance) => {
    (navigation.navigate as any)('Swap', {
      outputToken: stock.contract_address,
      outputSymbol: stock.symbol,
      inputToken: 'USDC',
    });
  }, [navigation]);

  const handleSellPreStock = useCallback((stock: PreStockBalance) => {
    (navigation.navigate as any)('Swap', {
      inputToken: stock.contract_address,
      inputSymbol: stock.symbol,
      outputToken: 'USDC',
    });
  }, [navigation]);

  const PreStockItem = ({ item }: { item: PreStockBalance }) => {
    const [imageError, setImageError] = useState(false);
    const [expanded, setExpanded] = useState(false);

    return (
      <TouchableOpacity
        style={[styles.prestockCard, { backgroundColor: currentTheme.card }]}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.prestockHeader}>
          <View style={styles.tokenInfo}>
            {item.image && !imageError ? (
              <Image source={{ uri: item.image }} style={styles.tokenImage} onError={() => setImageError(true)} />
            ) : (
              <View style={[styles.tokenImage, styles.tokenImagePlaceholder, { backgroundColor: currentTheme.secondary }]}>
                <Text style={[styles.tokenImageText, { color: currentTheme.primary }]}>{item.symbol[0]}</Text>
              </View>
            )}
            <View style={styles.tokenDetails}>
              <View style={styles.tokenNameRow}>
                <Text style={[styles.tokenName, { color: currentTheme.text }]}>{item.name}</Text>
                <Ionicons name="logo-slack" size={10} color={currentTheme.textLight} style={{ marginLeft: 4 }} />
              </View>
              <Text style={[styles.tokenSymbol, { color: currentTheme.textLight }]}>{item.symbol}</Text>
            </View>
          </View>
          <View style={styles.tokenBalance}>
            <Text style={[styles.tokenAmount, { color: currentTheme.text }]}>{item.balance > 0 ? item.balance.toFixed(4) : '0.0000'}</Text>
            <Text style={[styles.tokenSymbolSmall, { color: currentTheme.textLight }]}>{item.symbol}</Text>
            {item.usdValue > 0 && (
              <Text style={[styles.tokenValue, { color: currentTheme.text }]}>${item.usdValue.toFixed(2)}</Text>
            )}
          </View>
        </View>

        {expanded && (
          <View style={styles.prestockExpand}>
            <View style={styles.prestockStatsRow}>
              <View style={[styles.prestockStatCard, { backgroundColor: currentTheme.background }]}>
                <Text style={[styles.prestockStatLabel, { color: currentTheme.textLight }]}>Price</Text>
                <Text style={[styles.prestockStatValue, { color: currentTheme.text }]}>${item.priceUSD.toFixed(2)}</Text>
              </View>
              <View style={[styles.prestockStatCard, { backgroundColor: currentTheme.background }]}>
                <Text style={[styles.prestockStatLabel, { color: currentTheme.textLight }]}>Balance</Text>
                <Text style={[styles.prestockStatValue, { color: currentTheme.text }]}>{item.balance.toFixed(4)}</Text>
              </View>
              <View style={[styles.prestockStatCard, { backgroundColor: currentTheme.background }]}>
                <Text style={[styles.prestockStatLabel, { color: currentTheme.textLight }]}>Value</Text>
                <Text style={[styles.prestockStatValue, { color: currentTheme.text }]}>${item.usdValue.toFixed(2)}</Text>
              </View>
            </View>
            {item.description ? (
              <Text style={[styles.prestockDescription, { color: currentTheme.textLight }]} numberOfLines={3}>{item.description}</Text>
            ) : null}
            <View style={styles.prestockActions}>
              <TouchableOpacity
                style={[styles.prestockBtn, { backgroundColor: currentTheme.gradientStart }]}
                onPress={() => handleBuyPreStock(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="card" size={16} color={currentTheme.btnText} />
                <Text style={[styles.prestockBtnText, { color: currentTheme.btnText }]}>Buy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.prestockBtn, styles.prestockBtnSell, { borderColor: currentTheme.border }]}
                onPress={() => handleSellPreStock(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="cash" size={16} color={currentTheme.text} />
                <Text style={[styles.prestockBtnText, { color: currentTheme.text }]}>Sell</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderSkeletonItem = () => (
    <View style={[styles.tokenItem, { backgroundColor: currentTheme.card }]}>
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
        showBack={true}
        onBackPress={() => navigation.goBack()}
        showTokenToggle
        activeTokenView={viewMode}
        onTokenToggle={setViewMode}
      />

      <View style={styles.content}>
        {viewMode === 'tokens' ? (
          loading ? (
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
          )
        ) : (
          loadingPreStocks ? (
            <View style={styles.listContent}>
              {[1, 2, 3, 4, 5].map((key) => (
                <View key={key}>{renderSkeletonItem()}</View>
              ))}
            </View>
          ) : (
            <FlatList
              data={preStocks}
              renderItem={({ item }) => <PreStockItem item={item} />}
              keyExtractor={(item) => item.contract_address}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="trending-up-outline" size={48} color={currentTheme.textLight} />
                  <Text style={[styles.emptyText, { color: currentTheme.textLight }]}>No PreStock tokens found</Text>
                </View>
              }
            />
          )
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
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  viewToggle: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  prestockExpand: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  prestockStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  prestockStatCard: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  prestockStatLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  prestockStatValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  prestockDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  prestockActions: {
    flexDirection: 'row',
    gap: 10,
  },
  prestockBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  prestockBtnSell: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  prestockBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 24,
    gap: 8,
  },
  tokenItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
  },
  prestockCard: {
    padding: 16,
    borderRadius: 16,
  },
  prestockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenImageText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  tokenDetails: {
    flex: 1,
  },
  tokenNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  tokenSymbol: {
    fontSize: 14,
    marginBottom: 2,
  },
  tokenPrice: {
    fontSize: 12,
  },
  tokenBalance: {
    alignItems: 'flex-end',
  },
  tokenAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  tokenSymbolSmall: {
    fontSize: 12,
    marginBottom: 2,
  },
  tokenValue: {
    fontSize: 12,
    fontWeight: '600',
  },
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
});

export default TokensScreen;
