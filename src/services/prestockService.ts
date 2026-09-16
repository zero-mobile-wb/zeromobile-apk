import { Connection, PublicKey } from '@solana/web3.js';

const PRESTOCKS_API_URL = 'https://prestocks.com/api/prestocks';

let cachedPreStocks: PreStock[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60_000;

export interface PreStock {
  name: string;
  symbol: string;
  description: string;
  image: string;
  external_url: string;
  contract_address: string;
  markPrice: number;
  markValuation: number;
  tokenPrice: number;
  impliedValuation: number;
  supply: number;
}

export interface PreStockBalance {
  symbol: string;
  name: string;
  contract_address: string;
  balance: number;
  usdValue: number;
  priceUSD: number;
  image: string;
  description: string;
}

async function fetchPreStockBalance(
  connection: Connection,
  ownerPubkey: PublicKey,
  mintAddress: string
): Promise<number> {
  try {
    if (!mintAddress) return 0;
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(ownerPubkey, {
      mint: new PublicKey(mintAddress),
    });
    let total = 0;
    for (const acc of tokenAccounts.value) {
      const info = (acc.account.data as any).parsed?.info?.tokenAmount;
      if (info) total += info.uiAmount ?? 0;
    }
    return total;
  } catch (e) {
    console.error('[PreStock] Balance fetch failed:', e);
    return 0;
  }
}

export async function fetchPreStocks(): Promise<PreStock[]> {
  const now = Date.now();
  if (cachedPreStocks && now < cacheExpiry) {
    return cachedPreStocks;
  }

  const response = await fetch(PRESTOCKS_API_URL, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`PreStocks API error: ${response.status}`);
  }

  const data = await response.json();
  cachedPreStocks = data as PreStock[];
  cacheExpiry = now + CACHE_TTL_MS;
  return cachedPreStocks;
}

export async function fetchPreStockBalances(
  connection: Connection,
  ownerAddress: string
): Promise<PreStockBalance[]> {
  let prestocks: PreStock[];
  try {
    prestocks = await fetchPreStocks();
  } catch (e) {
    console.error('[PreStock] API fetch failed:', e);
    return [];
  }

  const ownerPubkey = new PublicKey(ownerAddress);

  const balances = await Promise.all(
    prestocks.map(async (ps) => {
      const balance = await fetchPreStockBalance(connection, ownerPubkey, ps.contract_address);
      return {
        symbol: ps.symbol,
        name: ps.name,
        contract_address: ps.contract_address,
        balance,
        usdValue: balance * ps.tokenPrice,
        priceUSD: ps.tokenPrice,
        image: ps.image,
        description: ps.description,
      };
    })
  );

  return balances;
}

export function getPreStockTotalValue(balances: PreStockBalance[]): number {
  return balances.reduce((sum, b) => sum + b.usdValue, 0);
}
