// Jupiter API Service for token search and pricing
import Constants from 'expo-constants';

const JUPITER_API_KEY = Constants.expoConfig?.extra?.jupiterApiKey;
const JUPITER_BASE_URL = Constants.expoConfig?.extra?.jupiterBaseUrl || 'https://api.jup.ag';
const SOL_MINT = 'So11111111111111111111111111111111111111112';

const FETCH_TIMEOUT = 5000;

// CoinGecko API for pricing (free tier, no auth required)
const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';

// Price cache to reduce API calls
interface PriceCache {
  [mintAddress: string]: {
    price: number;
    timestamp: number;
  };
}

// Token metadata cache
interface TokenMetadata {
  symbol: string;
  name: string;
  logoURI?: string;
}

interface TokenMetadataCache {
  [mintAddress: string]: TokenMetadata & { timestamp: number };
}

const priceCache: PriceCache = {};
const tokenMetadataCache: TokenMetadataCache = {};
const CACHE_DURATION = 300000; // 5 minutes

// Well-known token mappings
const KNOWN_TOKENS: { [mint: string]: { symbol: string; name: string; logoURI: string } } = {
  'So11111111111111111111111111111111111111112': {
    symbol: 'SOL',
    name: 'Solana',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
  },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
    symbol: 'USDC',
    name: 'USD Coin',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png'
  },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
    symbol: 'USDT',
    name: 'Tether',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png'
  },
};

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

export interface TokenPrice {
  id: string;
  mintSymbol: string;
  vsToken: string;
  vsTokenSymbol: string;
  price: number;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Search for tokens using Jupiter API
 */
export async function searchTokens(query?: string): Promise<TokenInfo[]> {
  try {
    const url = query
      ? `${JUPITER_BASE_URL}/tokens/v2/search?query=${encodeURIComponent(query)}`
      : `${JUPITER_BASE_URL}/tokens/v2/search`;

    const response = await fetchWithTimeout(url, {
      headers: { 'x-api-key': JUPITER_API_KEY },
    });

    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error searching tokens:', error);
    return [];
  }
}

async function fetchTokenList(): Promise<any[]> {
  try {
    const res = await fetchWithTimeout(`${JUPITER_BASE_URL}/tokens/v2/search`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
      if (data.tokens) return data.tokens;
      if (typeof data === 'object') return Object.values(data);
    }
  } catch (_) {}
  return [];
}

async function searchToken(mintAddress: string): Promise<any | null> {
  try {
    const res = await fetchWithTimeout(`${JUPITER_BASE_URL}/tokens/v2/search?query=${mintAddress}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.find((t: any) => t.id === mintAddress || t.address === mintAddress) || null;
      }
    }
  } catch (_) {}
  return null;
}

let tokenListCache: any[] | null = null;

/**
 * Get token metadata from cache or fetch it
 */
async function getTokenMetadata(mintAddress: string): Promise<TokenMetadata> {
  // Check if it's a known token
  if (KNOWN_TOKENS[mintAddress]) {
    return KNOWN_TOKENS[mintAddress];
  }

  // Check cache
  const cached = tokenMetadataCache[mintAddress];
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached;
  }

  // Search Jupiter token list
  if (!tokenListCache) {
    tokenListCache = await fetchTokenList();
  }

  const found = tokenListCache?.find((t: any) =>
    t.address === mintAddress || t.mint === mintAddress || t.id === mintAddress
  );
  if (found) {
    const metadata: TokenMetadata = {
      symbol: found.symbol || 'UNKNOWN',
      name: found.name || 'Unknown Token',
      logoURI: found.logoURI || found.logo || found.icon,
    };
    tokenMetadataCache[mintAddress] = { ...metadata, timestamp: Date.now() };
    return metadata;
  }

  // Fallback: search by mint address
  const searchResult = await searchToken(mintAddress);
  if (searchResult) {
    const metadata: TokenMetadata = {
      symbol: searchResult.symbol || 'UNKNOWN',
      name: searchResult.name || 'Unknown Token',
      logoURI: searchResult.logoURI || searchResult.logo || searchResult.icon,
    };
    tokenMetadataCache[mintAddress] = { ...metadata, timestamp: Date.now() };
    return metadata;
  }

  // Default metadata if not found
  const defaultMetadata: TokenMetadata = {
    symbol: mintAddress.slice(0, 4) + '...',
    name: 'Unknown Token',
  };

  tokenMetadataCache[mintAddress] = { ...defaultMetadata, timestamp: Date.now() };
  return defaultMetadata;
}

/**
 * Get multiple token prices in a single call using Jupiter Price API
 */
export async function getMultipleTokenPrices(
  mintAddresses: string[]
): Promise<{ [mintAddress: string]: number }> {
  if (mintAddresses.length === 0) return {};

  const prices: { [key: string]: number } = {};
  const uncached: string[] = [];

  mintAddresses.forEach(addr => {
    const cached = priceCache[addr];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      prices[addr] = cached.price;
    } else {
      uncached.push(addr);
    }
  });

  if (uncached.length === 0) return prices;

  try {
    const ids = uncached.join(',');
    const headers: Record<string, string> = {};
    if (JUPITER_API_KEY) {
      headers['x-api-key'] = JUPITER_API_KEY;
    }
    const res = await fetchWithTimeout(
      `${JUPITER_BASE_URL}/price/v3?ids=${ids}`,
      { headers }
    );

    if (res.ok) {
      const data = await res.json();
      // Jupiter returns { data: { [mint]: { id, mintSymbol, vsToken, price } } }
      const jupData = data.data || data;
      uncached.forEach(mint => {
        const entry = jupData[mint];
        const p = entry?.price != null ? parseFloat(entry.price) : 0;
        prices[mint] = p;
        if (p > 0) priceCache[mint] = { price: p, timestamp: Date.now() };
      });
    } else {
      uncached.forEach(m => { prices[m] = 0; });
    }
  } catch (error) {
    console.error('Error fetching token prices:', error);
    uncached.forEach(m => { prices[m] = 0; });
  }

  return prices;
}

/**
 * Get SOL price (Solana native token)
 */
export async function getSolPrice(): Promise<number> {
  const prices = await getMultipleTokenPrices([SOL_MINT]);
  return prices[SOL_MINT] || 0;
}

/**
 * Clear price cache (useful for forcing refresh)
 */
export function clearPriceCache(): void {
  Object.keys(priceCache).forEach(key => delete priceCache[key]);
}

/**
 * Get token info including metadata (exported for use in other services)
 */
export async function getTokenInfo(mintAddress: string): Promise<TokenMetadata> {
  return getTokenMetadata(mintAddress);
}
