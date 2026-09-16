import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createPublicClient, http, formatUnits, erc20Abi } from 'viem';
import { STABLECOINS, Stablecoin, StablecoinChain } from '../constants/stablecoins';

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

const ERC20_ABI = erc20Abi;

const EVM_RPC_URLS: Record<string, string[]> = {
  base: ['https://mainnet.base.org', 'https://base.publicnode.com'],
  bsc: ['https://bsc-dataseed.binance.org', 'https://bsc.publicnode.com'],
  arbitrum: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.publicnode.com'],
  polygon: ['https://polygon-rpc.com', 'https://polygon.publicnode.com'],
  monad: ['https://testnet-rpc.monad.xyz'],
};

export interface ChainBalance {
  chain: StablecoinChain;
  balance: number;
  usdValue: number;
  priceUSD: number;
}

export interface StablecoinBalance {
  symbol: 'USDC' | 'USDT';
  name: string;
  logo: string;
  totalBalance: number;
  totalUSD: number;
  priceUSD: number;
  chains: ChainBalance[];
}

export interface ChartDataPoint {
  timestamp: number;
  price: number;
}

async function fetchSolanaTokenBalance(
  connection: Connection,
  ownerPubkey: PublicKey,
  mintAddress: string
): Promise<number> {
  try {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      ownerPubkey,
      { mint: new PublicKey(mintAddress) }
    );
    let total = 0;
    for (const acc of tokenAccounts.value) {
      const info = (acc.account.data as any).parsed?.info?.tokenAmount;
      if (info) total += info.uiAmount ?? 0;
    }
    return total;
  } catch {
    return 0;
  }
}

async function fetchEvmTokenBalance(
  walletAddress: `0x${string}`,
  contractAddress: string,
  chainId: string,
  decimals: number
): Promise<number> {
  if (contractAddress === '0x...') return 0;
  const rpcUrls = EVM_RPC_URLS[chainId];
  if (!rpcUrls || rpcUrls.length === 0) return 0;

  for (const url of rpcUrls) {
    try {
      const client = createPublicClient({ transport: http(url, { timeout: 8000 }) });
      const balance = await client.readContract({
        address: contractAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [walletAddress],
      });
      return parseFloat(formatUnits(balance, decimals));
    } catch {
      continue;
    }
  }
  return 0;
}

export async function getStablecoinBalances(
  solanaAddress: string | null,
  evmWallets: { address: `0x${string}`; chainId: string }[],
  priceUSD: number,
  solanaConnection?: Connection
): Promise<StablecoinBalance[]> {
  const results: StablecoinBalance[] = [];
  const connection = solanaConnection || new Connection('https://api.mainnet-beta.solana.com');

  for (const stablecoin of STABLECOINS) {
    const chainBalances: ChainBalance[] = [];

    for (const chain of stablecoin.chains) {
      let balance = 0;

      if (chain.id === 'solana' && solanaAddress) {
        const pubkey = new PublicKey(solanaAddress);
        balance = await fetchSolanaTokenBalance(connection, pubkey, chain.contractAddress);
      } else if (chain.evmChainId && evmWallets.length > 0) {
        const matchingWallet = evmWallets[0];
        if (matchingWallet) {
          balance = await fetchEvmTokenBalance(
            matchingWallet.address,
            chain.contractAddress,
            chain.id,
            chain.decimals
          );
        }
      }

      chainBalances.push({
        chain,
        balance,
        usdValue: balance * priceUSD,
        priceUSD,
      });
    }

    const totalBalance = chainBalances.reduce((sum, cb) => sum + cb.balance, 0);

    results.push({
      symbol: stablecoin.symbol,
      name: stablecoin.name,
      logo: stablecoin.logo,
      totalBalance,
      totalUSD: totalBalance * priceUSD,
      priceUSD,
      chains: chainBalances,
    });
  }

  return results;
}

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function coingeckoFetch(url: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url);
    if (response.status === 429) {
      await sleep(2000 * (i + 1));
      continue;
    }
    if (!response.ok) throw new Error(`CoinGecko error: ${response.status}`);
    return response.json();
  }
  throw new Error('CoinGecko rate limited');
}

export async function getCoinGeckoChartData(
  coingeckoId: string,
  days: number = 30
): Promise<ChartDataPoint[]> {
  try {
    const interval = days <= 1 ? 'hourly' : 'daily';
    const url = `${COINGECKO_BASE}/coins/${coingeckoId}/market_chart?vs_currency=usd&days=${days}&interval=${interval}`;
    const data = await coingeckoFetch(url);
    return (data.prices || []).map((p: [number, number]) => ({
      timestamp: p[0],
      price: p[1],
    }));
  } catch (error) {
    console.error('[StablecoinService] Chart data error:', error);
    return [];
  }
}

export interface TokenMarketData {
  marketCap: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  change24h: number;
  change7d: number;
  ath: number;
  athChange: number;
  totalSupply: number;
  circulatingSupply: number;
}

export async function getTokenMarketData(coingeckoId: string): Promise<TokenMarketData | null> {
  try {
    await sleep(300);
    const url = `${COINGECKO_BASE}/coins/${coingeckoId}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`;
    const data = await coingeckoFetch(url);
    const md = data.market_data;
    if (!md) return null;
    return {
      marketCap: md.market_cap?.usd ?? 0,
      volume24h: md.total_volume?.usd ?? 0,
      high24h: md.high_24h?.usd ?? 0,
      low24h: md.low_24h?.usd ?? 0,
      change24h: md.price_change_percentage_24h ?? 0,
      change7d: md.price_change_percentage_7d ?? 0,
      ath: md.ath?.usd ?? 0,
      athChange: md.ath_change_percentage?.usd ?? 0,
      totalSupply: md.total_supply ?? 0,
      circulatingSupply: md.circulating_supply ?? 0,
    };
  } catch (error) {
    console.error('[StablecoinService] Market data error:', error);
    return null;
  }
}

export async function getTokenPriceUSD(coingeckoId: string): Promise<number> {
  try {
    const url = `${COINGECKO_BASE}/simple/price?ids=${coingeckoId}&vs_currencies=usd`;
    const data = await coingeckoFetch(url);
    return data[coingeckoId]?.usd ?? 1.0;
  } catch {
    return 1.0;
  }
}
