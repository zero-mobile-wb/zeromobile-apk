import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import { RootStackParamList } from '../types/navigation';
import { getStablecoin } from '../constants/stablecoins';
import {
  getCoinGeckoChartData,
  getTokenPriceUSD,
  getTokenMarketData,
  ChartDataPoint,
  TokenMarketData,
  getStablecoinBalances,
  StablecoinBalance,
} from '../services/stablecoinService';
import { LineChart } from 'react-native-wagmi-charts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TokenDetailRouteProp = RouteProp<RootStackParamList, 'TokenDetail'>;
type TokenDetailNavProp = NativeStackNavigationProp<RootStackParamList, 'TokenDetail'>;

interface Props {
  navigation: TokenDetailNavProp;
  route: TokenDetailRouteProp;
}

const TIME_RANGES = [
  { label: '1D', days: 1 },
  { label: '7D', days: 7 },
  { label: '1M', days: 30 },
  { label: '1Y', days: 365 },
  { label: 'ALL', days: 0 },
] as const;

function formatCompact(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(2);
}

const MarketRow = ({ label, value, color, theme }: { label: string; value: string; color?: string; theme: any }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
    <Text style={{ color: theme.textLight, fontSize: 13 }}>{label}</Text>
    <Text style={{ color: color || theme.text, fontSize: 13, fontWeight: '600' }}>{value}</Text>
  </View>
);

const TokenDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { tokenSymbol, tokenName, tokenLogo, tokenMint, priceUSD: paramPrice } = route.params;
  const { currentTheme, themeId } = useTheme();
  const isDark = themeId === 'dark';
  const { activeSolanaAddress, evmWallets, connection, isPrivyUser } = useWallet();
  const privyEthWallet = useEmbeddedEthereumWallet();
  const privyEvmAddress = (privyEthWallet.wallets?.[0] as any)?.address ?? null;
  const insets = useSafeAreaInsets();

  const stablecoin = getStablecoin(tokenSymbol as 'USDC' | 'USDT');
  const isStablecoin = !!stablecoin;

  const coingeckoId = stablecoin?.coingeckoId || route.params.coingeckoId;
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [selectedRange, setSelectedRange] = useState<number>(30);
  const [loadingChart, setLoadingChart] = useState(true);
  const [priceUSD, setPriceUSD] = useState(paramPrice ?? 1.0);
  const [balanceData, setBalanceData] = useState<StablecoinBalance | null>(null);
  const [marketData, setMarketData] = useState<TokenMarketData | null>(null);

  // Display info - use params for regular tokens, stablecoin data for stablecoins
  const displayName = stablecoin?.name || tokenName || tokenSymbol;
  const displaySymbol = stablecoin?.symbol || tokenSymbol;
  const displayLogo = stablecoin?.logo || tokenLogo || '';

  // Fetch chart + market data
  useEffect(() => {
    if (!coingeckoId) {
      setLoadingChart(false);
      return;
    }
    const fetchData = async () => {
      setLoadingChart(true);
      const [price, chart, mkt] = await Promise.all([
        getTokenPriceUSD(coingeckoId),
        getCoinGeckoChartData(coingeckoId, selectedRange === 0 ? 365 : selectedRange),
        getTokenMarketData(coingeckoId),
      ]);
      setPriceUSD(price);
      setChartData(chart);
      setMarketData(mkt);
      setLoadingChart(false);
    };
    fetchData();
  }, [coingeckoId, selectedRange]);

  // Fetch stablecoin balances
  useEffect(() => {
    if (!isStablecoin || !activeSolanaAddress) return;
    const fetchBalances = async () => {
      const evmList = evmWallets.map(w => ({ address: w.address as `0x${string}`, chainId: w.chainId }));
      if (privyEvmAddress) {
        evmList.push({ address: privyEvmAddress, chainId: 'ethereum' as any });
        evmList.push({ address: privyEvmAddress, chainId: 'base' as any });
        evmList.push({ address: privyEvmAddress, chainId: 'polygon' as any });
      }
      const balances = await getStablecoinBalances(
        activeSolanaAddress,
        evmList,
        priceUSD,
        connection
      );
      const match = balances.find(b => b.symbol === tokenSymbol);
      if (match) setBalanceData(match);
    };
    fetchBalances();
  }, [isStablecoin, activeSolanaAddress, evmWallets, privyEvmAddress, priceUSD, tokenSymbol, connection]);

  const chartLineColor = useMemo(() => {
    if (chartData.length < 2) return currentTheme.accent;
    const first = chartData[0].price;
    const last = chartData[chartData.length - 1].price;
    return last >= first ? '#10B981' : '#EF4444';
  }, [chartData]);

  const formatBalance = (b: number) => {
    if (b === 0) return '0.00';
    return b.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  const totalBalance = balanceData?.totalBalance ?? 0;
  const totalUSD = balanceData?.totalUSD ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.primary }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
          >
            <Ionicons name="chevron-back" size={20} color={currentTheme.text} />
          </TouchableOpacity>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          {displayLogo ? (
            <Image source={{ uri: displayLogo }} style={styles.heroLogo} />
          ) : (
            <View style={[styles.heroLogo, styles.heroLogoPlaceholder, { backgroundColor: currentTheme.border }]}>
              <Text style={{ color: currentTheme.text, fontSize: 24, fontWeight: '700' }}>{displaySymbol[0]}</Text>
            </View>
          )}
          <Text style={[styles.heroName, { color: currentTheme.text }]}>{displayName}</Text>
          <Text style={[styles.heroSymbol, { color: currentTheme.textLight }]}>{displaySymbol}</Text>
        </View>

        {/* Price */}
        <View style={styles.priceRow}>
          <Text style={[styles.priceText, { color: currentTheme.text }]}>${priceUSD.toFixed(4)}</Text>
        </View>

        {/* Chart */}
        <View style={styles.chartWrap}>
          {loadingChart ? (
            <View style={styles.chartLoading}>
              <ActivityIndicator size="small" color={currentTheme.accent} />
            </View>
          ) : chartData.length > 0 ? (
            <LineChart.Provider data={chartData.map(d => ({ timestamp: d.timestamp, value: d.price }))}>
              <LineChart width={SCREEN_WIDTH - 40} height={180}>
                <LineChart.Path color={chartLineColor} width={2} />
              </LineChart>
            </LineChart.Provider>
          ) : (
            <Text style={{ color: currentTheme.textLight, fontSize: 13 }}>No chart data</Text>
          )}
        </View>

        {/* Time Range */}
        {chartData.length > 0 && (
          <View style={styles.rangeRow}>
            {TIME_RANGES.map(r => {
              const active = selectedRange === r.days;
              return (
                <TouchableOpacity
                  key={r.label}
                  onPress={() => setSelectedRange(r.days)}
                  style={[
                    styles.rangeBtn,
                    {
                      backgroundColor: active ? currentTheme.accent : 'transparent',
                      borderWidth: active ? 0 : 1,
                      borderColor: currentTheme.border,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.rangeBtnText, { color: active ? '#FFFFFF' : currentTheme.textLight }]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Market Data */}
        {marketData && (
          <View style={[styles.marketSection, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
            <Text style={[styles.sectionTitle, { color: currentTheme.textLight }]}>MARKET DATA</Text>
            <View style={styles.marketGrid}>
              <MarketRow label="Market Cap" value={`$${formatCompact(marketData.marketCap)}`} theme={currentTheme} />
              <MarketRow label="24h Volume" value={`$${formatCompact(marketData.volume24h)}`} theme={currentTheme} />
              <MarketRow label="24h High" value={`$${marketData.high24h.toFixed(2)}`} theme={currentTheme} />
              <MarketRow label="24h Low" value={`$${marketData.low24h.toFixed(2)}`} theme={currentTheme} />
              <MarketRow label="24h Change" value={`${marketData.change24h >= 0 ? '+' : ''}${marketData.change24h.toFixed(2)}%`} color={marketData.change24h >= 0 ? '#4ADE80' : '#EF4444'} theme={currentTheme} />
              <MarketRow label="7d Change" value={`${marketData.change7d >= 0 ? '+' : ''}${marketData.change7d.toFixed(2)}%`} color={marketData.change7d >= 0 ? '#4ADE80' : '#EF4444'} theme={currentTheme} />
              <MarketRow label="All-Time High" value={`$${marketData.ath.toFixed(2)}`} theme={currentTheme} />
              <MarketRow label="From ATH" value={`${marketData.athChange.toFixed(1)}%`} color={marketData.athChange >= 0 ? '#4ADE80' : '#EF4444'} theme={currentTheme} />
              <MarketRow label="Total Supply" value={formatCompact(marketData.totalSupply)} theme={currentTheme} />
              <MarketRow label="Circulating" value={formatCompact(marketData.circulatingSupply)} theme={currentTheme} />
            </View>
          </View>
        )}

        {/* Your Balance - only for stablecoins */}
        {isStablecoin && totalBalance > 0 && (
          <View style={styles.totalSection}>
            <Text style={[styles.totalLabel, { color: currentTheme.textLight }]}>YOUR BALANCE</Text>
            <Text style={[styles.totalValue, { color: currentTheme.text }]}>
              ${formatBalance(totalUSD)}
            </Text>
          </View>
        )}

        {/* Chain Cards - only for stablecoins */}
        {isStablecoin && (
          <View style={styles.chainsSection}>
            <Text style={[styles.sectionLabel, { color: currentTheme.textLight }]}>ON EACH NETWORK</Text>
            {stablecoin.chains.map((chain) => {
              const chainBalance = balanceData?.chains.find(c => c.chain.id === chain.id);
              const bal = chainBalance?.balance ?? 0;
              const hasBalance = bal > 0;

              return (
                <View
                  key={chain.id}
                  style={[
                    styles.chainCard,
                    {
                      backgroundColor: hasBalance
                        ? (isDark ? 'rgba(95,150,156,0.12)' : 'rgba(95,150,156,0.06)')
                        : currentTheme.card,
                      borderColor: hasBalance
                        ? (isDark ? 'rgba(95,150,156,0.25)' : 'rgba(95,150,156,0.15)')
                        : currentTheme.border,
                    },
                  ]}
                >
                  <Image source={{ uri: chain.logo }} style={styles.chainLogo} />
                  <View style={styles.chainInfo}>
                    <Text style={[styles.chainName, { color: currentTheme.text }]}>
                      {displaySymbol} on {chain.name}
                    </Text>
                    {!hasBalance && (
                      <Text style={[styles.chainEmpty, { color: currentTheme.textLight }]}>No balance</Text>
                    )}
                  </View>
                  {hasBalance && (
                    <View style={styles.chainBalWrap}>
                      <Text style={[styles.chainBalUsd, { color: currentTheme.text }]}>
                        ${formatBalance(bal)}
                      </Text>
                      <Text style={[styles.chainBalToken, { color: currentTheme.textLight }]}>
                        {formatBalance(bal)} {displaySymbol}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Token Info - for non-stablecoins */}
        {!isStablecoin && tokenMint && (
          <View style={styles.tokenInfoSection}>
            <Text style={[styles.sectionLabel, { color: currentTheme.textLight }]}>TOKEN INFO</Text>
            <View style={[styles.infoCard, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: currentTheme.textLight }]}>Contract</Text>
                <Text style={[styles.infoValue, { color: currentTheme.text }]} numberOfLines={1}>
                  {tokenMint.slice(0, 8)}...{tokenMint.slice(-6)}
                </Text>
              </View>
              <View style={[styles.infoSep, { backgroundColor: currentTheme.border }]} />
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: currentTheme.textLight }]}>Network</Text>
                <Text style={[styles.infoValue, { color: currentTheme.text }]}>Solana</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  hero: { alignItems: 'center', marginTop: 20 },
  heroLogo: { width: 64, height: 64, borderRadius: 32 },
  heroLogoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  heroName: { fontSize: 24, fontWeight: '700', marginTop: 12 },
  heroSymbol: { fontSize: 14, marginTop: 2 },

  priceRow: { alignItems: 'center', marginTop: 6 },
  priceText: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },

  chartWrap: {
    marginTop: 20,
    marginHorizontal: 20,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  rangeBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18 },
  rangeBtnText: { fontSize: 13, fontWeight: '600' },

  totalSection: { marginTop: 28, alignItems: 'center' },
  totalLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  totalValue: { fontSize: 28, fontWeight: '800', marginTop: 4 },

  chainsSection: { marginTop: 28, marginHorizontal: 20 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  chainCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  chainLogo: { width: 36, height: 36, borderRadius: 18 },
  chainInfo: { flex: 1, marginLeft: 12 },
  chainName: { fontSize: 14, fontWeight: '600' },
  chainEmpty: { fontSize: 12, marginTop: 2 },
  chainBalWrap: { alignItems: 'flex-end' },
  chainBalUsd: { fontSize: 16, fontWeight: '700' },
  chainBalToken: { fontSize: 12, marginTop: 2 },

  tokenInfoSection: { marginTop: 28, marginHorizontal: 20 },
  marketSection: {
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  marketGrid: {},
  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: '600', maxWidth: '60%' },
  infoSep: { height: StyleSheet.hairlineWidth },
});

export default TokenDetailScreen;
