// Jupiter API Service for token search
import Constants from 'expo-constants';

const JUPITER_API_KEY = Constants.expoConfig?.extra?.jupiterApiKey;
const JUPITER_BASE_URL = Constants.expoConfig?.extra?.jupiterBaseUrl;

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
  coingeckoId?: string;
}

interface TokenMetadataCache {
  [mintAddress: string]: TokenMetadata & { timestamp: number };
}

const priceCache: PriceCache = {};
const tokenMetadataCache: TokenMetadataCache = {};
const CACHE_DURATION = 30000; // 5 minutes (300 seconds)

// Well-known token mappings for better price fetching and logos
const KNOWN_TOKENS: { [mint: string]: { coingeckoId: string; symbol: string; name: string; logoURI: string } } = {
  'So11111111111111111111111111111111111111112': {
    coingeckoId: 'solana',
    symbol: 'SOL',
    name: 'Solana',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
  },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
    coingeckoId: 'usd-coin',
    symbol: 'USDC',
    name: 'USD Coin',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png'
  },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
    coingeckoId: 'tether',
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

/**
 * Search for tokens using Jupiter API
 */
export async function searchTokens(query?: string): Promise<TokenInfo[]> {
  try {
    const url = query
      ? `${JUPITER_BASE_URL}/tokens/v2/search?query=${encodeURIComponent(query)}`
      : `${JUPITER_BASE_URL}/tokens/v2/search`;

    const response = await fetch(url, {
      headers: {
        'x-api-key': JUPITER_API_KEY,
      },
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

  // Try to fetch from CoinGecko by contract address first (more reliable)
  try {
    const response = await fetch(
      `${COINGECKO_BASE_URL}/coins/solana/contract/${mintAddress}`
    );

    if (response.ok) {
      const data = await response.json();
      const metadata: TokenMetadata = {
        symbol: data.symbol?.toUpperCase() || 'UNKNOWN',
        name: data.name || 'Unknown Token',
        logoURI: data.image?.large || data.image?.small || data.image?.thumb,
        coingeckoId: data.id,
      };

      // Cache the metadata
      tokenMetadataCache[mintAddress] = { ...metadata, timestamp: Date.now() };
      return metadata;
    }
  } catch (error) {
    console.log(`Could not fetch metadata from CoinGecko for ${mintAddress}`);
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
 * Get token price in USD using CoinGecko API
 */
export async function getTokenPrice(mintAddress: string): Promise<number> {
  // Check cache first
  const cached = priceCache[mintAddress];
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.price;
  }

  try {
    // Check if it's a known token with CoinGecko ID
    let coingeckoId: string | undefined;

    if (KNOWN_TOKENS[mintAddress]) {
      coingeckoId = KNOWN_TOKENS[mintAddress].coingeckoId;
    } else {
      // Try to get CoinGecko ID from metadata
      const metadata = await getTokenMetadata(mintAddress);
      coingeckoId = metadata.coingeckoId;
    }

    let price = 0;

    if (coingeckoId) {
      // Fetch price using CoinGecko ID
      const response = await fetch(
        `${COINGECKO_BASE_URL}/simple/price?ids=${coingeckoId}&vs_currencies=usd`
      );

      if (response.ok) {
        const data = await response.json();
        price = data[coingeckoId]?.usd || 0;
      }
    } else {
      // Try to fetch by contract address
      const response = await fetch(
        `${COINGECKO_BASE_URL}/coins/solana/contract/${mintAddress}`
      );

      if (response.ok) {
        const data = await response.json();
        price = data.market_data?.current_price?.usd || 0;
      }
    }

    // Cache the price
    if (price > 0) {
      priceCache[mintAddress] = {
        price,
        timestamp: Date.now(),
      };
    }

    return price;
  } catch (error) {
    console.error(`Error fetching token price for ${mintAddress}:`, error);
    return 0;
  }
}

/**
 * Get multiple token prices in a single call using CoinGecko
 */
export async function getMultipleTokenPrices(
  mintAddresses: string[]
): Promise<{ [mintAddress: string]: number }> {
  if (mintAddresses.length === 0) {
    return {};
  }

  // Check cache for all addresses
  const prices: { [key: string]: number } = {};
  const uncachedAddresses: string[] = [];

  mintAddresses.forEach(address => {
    const cached = priceCache[address];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      prices[address] = cached.price;
    } else {
      uncachedAddresses.push(address);
    }
  });

  // If all prices are cached, return immediately
  if (uncachedAddresses.length === 0) {
    return prices;
  }

  try {
    // Separate known tokens from unknown tokens
    const knownTokenIds: string[] = [];
    const knownTokenMints: string[] = [];
    const unknownTokens: string[] = [];

    for (const address of uncachedAddresses) {
      if (KNOWN_TOKENS[address]) {
        knownTokenIds.push(KNOWN_TOKENS[address].coingeckoId);
        knownTokenMints.push(address);
      } else {
        unknownTokens.push(address);
      }
    }

    // Fetch prices for known tokens in batch
    if (knownTokenIds.length > 0) {
      const idsParam = knownTokenIds.join(',');
      const response = await fetch(
        `${COINGECKO_BASE_URL}/simple/price?ids=${idsParam}&vs_currencies=usd`
      );

      if (response.ok) {
        const data = await response.json();
        knownTokenMints.forEach((mint, index) => {
          const coingeckoId = knownTokenIds[index];
          const price = data[coingeckoId]?.usd || 0;
          prices[mint] = price;

          // Cache the price
          if (price > 0) {
            priceCache[mint] = {
              price,
              timestamp: Date.now(),
            };
          }
        });
      } else {
        // Set 0 for failed fetches
        knownTokenMints.forEach(mint => {
          prices[mint] = 0;
        });
      }
    }

    // Fetch prices for unknown tokens individually (CoinGecko requires separate calls for contract addresses)
    for (const mint of unknownTokens) {
      const price = await getTokenPrice(mint);
      prices[mint] = price;
    }

    return prices;
  } catch (error) {
    console.error('Error fetching multiple token prices:', error);
    // Return cached prices with 0 for uncached
    uncachedAddresses.forEach(address => {
      if (prices[address] === undefined) {
        prices[address] = 0;
      }
    });
    return prices;
  }
}

/**
 * Get SOL price (Solana native token)
 */
export async function getSolPrice(): Promise<number> {
  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  return getTokenPrice(SOL_MINT);
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
