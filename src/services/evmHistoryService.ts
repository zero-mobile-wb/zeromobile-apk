import { HeliusTransaction } from './heliusApi';

const ALCHEMY_RPC_URLS: Record<string, string> = {
  ethereum: 'https://eth-mainnet.g.alchemy.com/v2/alch_cwScl8Y8G9o5IgE0nfwS2',
  base: 'https://base-mainnet.g.alchemy.com/v2/alch_cwScl8Y8G9o5IgE0nfwS2',
  polygon: 'https://polygon-mainnet.g.alchemy.com/v2/alch_cwScl8Y8G9o5IgE0nfwS2',
  arbitrum: 'https://arb-mainnet.g.alchemy.com/v2/alch_cwScl8Y8G9o5IgE0nfwS2',
  arc: 'https://rpc.mainnet.arc.io',
};

const CHAIN_SYMBOL: Record<string, string> = {
  ethereum: 'ETH',
  base: 'ETH',
  polygon: 'POL',
  arbitrum: 'ETH',
  arc: 'USDC',
};

interface AlchemyTransfer {
  blockNum: string;
  hash: string;
  from: string;
  to: string | null;
  value: number | null;
  erc20Value: string | null;
  asset: string;
  category: string;
  rawContract: { address: string | null; decimal: string | null; };
  metadata?: { blockTimestamp: string };
}

async function fetchTransfers(rpcUrl: string, params: any): Promise<AlchemyTransfer[]> {
  const resp = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'alchemy_getAssetTransfers', params: [params] }),
  });
  const json = await resp.json();
  return json?.result?.transfers || [];
}

function parseTransfer(tx: AlchemyTransfer, address: string, chain: string): HeliusTransaction & { chain: string } {
  const lowerAddress = address.toLowerCase();
  const isFrom = tx.from.toLowerCase() === lowerAddress;
  const isNative = tx.category === 'external';
  const decimals = tx.rawContract?.decimal ? parseInt(tx.rawContract.decimal) : 18;
  const rawAmount = tx.erc20Value
    ? parseFloat(tx.erc20Value) / Math.pow(10, decimals)
    : tx.value || 0;
  const symbol = isNative ? CHAIN_SYMBOL[chain] || 'ETH' : tx.asset;
  const timestamp = tx.metadata?.blockTimestamp
    ? Math.floor(new Date(tx.metadata.blockTimestamp).getTime() / 1000)
    : Math.floor(Date.now() / 1000);

  return {
    signature: tx.hash,
    type: isFrom ? 'send' : 'receive',
    amount: rawAmount,
    timestamp,
    status: 'confirmed',
    source: tx.from,
    destination: tx.to || undefined,
    token: symbol,
    tokenAddress: tx.rawContract?.address || undefined,
    chain,
  };
}

export async function getEvmTransactionHistory(
  address: string,
  limit: number = 5,
  chain: string = 'ethereum'
): Promise<(HeliusTransaction & { chain: string })[]> {
  const rpcUrl = ALCHEMY_RPC_URLS[chain];
  if (!rpcUrl) return [];

  const lowerAddress = address.toLowerCase();
  const halfLimit = Math.ceil(limit / 2);

  try {
    const [sent, received] = await Promise.all([
      fetchTransfers(rpcUrl, {
        fromAddress: lowerAddress,
        category: ['erc20', 'external'],
        maxCount: halfLimit,
        withMetadata: true,
      }),
      fetchTransfers(rpcUrl, {
        toAddress: lowerAddress,
        category: ['erc20', 'external'],
        maxCount: halfLimit,
        withMetadata: true,
      }),
    ]);

    // Merge and dedupe by hash
    const allTransfers = [...sent, ...received];
    const seen = new Set<string>();
    const unique = allTransfers.filter(tx => {
      if (seen.has(tx.hash)) return false;
      seen.add(tx.hash);
      return true;
    });

    return unique.map(tx => parseTransfer(tx, address, chain));
  } catch (e) {
    console.error(`[EVM History] Error fetching ${chain} transactions:`, e);
    return [];
  }
}

export async function getAllEvmTransactions(
  address: string,
  limitPerChain: number = 3
): Promise<(HeliusTransaction & { chain: string })[]> {
  const chains = ['ethereum', 'base', 'polygon', 'arc'];
  const results = await Promise.allSettled(
    chains.map(chain => getEvmTransactionHistory(address, limitPerChain, chain))
  );

  const allTxs = results
    .filter((r): r is PromiseFulfilledResult<(HeliusTransaction & { chain: string })[]> => r.status === 'fulfilled')
    .flatMap(r => r.value);

  allTxs.sort((a, b) => b.timestamp - a.timestamp);
  return allTxs.slice(0, limitPerChain * 2);
}
