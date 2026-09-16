// Helius API Service for transaction history
import Constants from 'expo-constants';

const HELIUS_API_KEY = Constants.expoConfig?.extra?.heliusApiKey || '3200c64d-9d5b-4975-9c12-d1ac26112a7b';
const HELIUS_BASE_URL = Constants.expoConfig?.extra?.heliusBaseUrl || 'https://api-mainnet.helius-rpc.com/v0';
const RPC_BACKUP_URLS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-rpc.publicnode.com',
  'https://rpc.ankr.com/solana',
];

export interface HeliusTransaction {
  signature: string;
  type: 'send' | 'receive';
  amount: number;
  timestamp: number;
  status: string;
  source?: string;
  destination?: string;
  token?: string; // Token symbol (SOL, USDC, etc.)
  tokenAddress?: string; // Token mint address
}

/**
 * Get transaction history for a wallet address using Helius API.
 * Falls back to the Solana RPC when Helius is unavailable/rate-limited.
 */
export async function getTransactionHistory(
  walletAddress: string,
  limit: number = 10,
  network: string = 'mainnet-beta'
): Promise<HeliusTransaction[]> {
  try {
    const baseUrl = network === 'devnet'
      ? 'https://api-devnet.helius-rpc.com/v0'
      : HELIUS_BASE_URL;

    const url = `${baseUrl}/addresses/${walletAddress}/transactions?api-key=${HELIUS_API_KEY}&limit=${limit}`;

    const response = await fetch(url);

    if (!response.ok) {
      console.log('[Helius] API error:', response.status, '- falling back to RPC');
      return fetchFromRpc(walletAddress, limit, network);
    }

    const data = await response.json();

    const transactions = parseHeliusData(data, walletAddress);

    if (transactions.length === 0) {
      console.log('[Helius] No transactions parsed - falling back to RPC');
      return fetchFromRpc(walletAddress, limit, network);
    }

    return transactions;
  } catch (error) {
    console.log('[Helius] Fetch failed:', error, '- falling back to RPC');
    return fetchFromRpc(walletAddress, limit, network);
  }
}

function parseHeliusData(data: any[], walletAddress: string): HeliusTransaction[] {
  const transactions: HeliusTransaction[] = [];

  for (const tx of data) {
    try {
      const signature = tx.signature;
      const timestamp = tx.timestamp || Date.now() / 1000;

      let type: 'send' | 'receive' = 'receive';
      let amount = 0;
      let source = '';
      let destination = '';
      let token = 'SOL';
      let tokenAddress = 'So11111111111111111111111111111111111111112';

      if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
        for (const transfer of tx.nativeTransfers) {
          const fromAddress = transfer.fromUserAccount || '';
          const toAddress = transfer.toUserAccount || '';
          const transferAmount = (transfer.amount || 0) / 1e9;

          if (fromAddress.toLowerCase() === walletAddress.toLowerCase()) {
            type = 'send';
            amount = transferAmount;
            source = fromAddress;
            destination = toAddress;
            token = 'SOL';
            break;
          } else if (toAddress.toLowerCase() === walletAddress.toLowerCase()) {
            type = 'receive';
            amount = transferAmount;
            source = fromAddress;
            destination = toAddress;
            token = 'SOL';
            break;
          }
        }
      }

      if (amount === 0 && tx.tokenTransfers && tx.tokenTransfers.length > 0) {
        for (const transfer of tx.tokenTransfers) {
          const fromAddress = transfer.fromUserAccount || '';
          const toAddress = transfer.toUserAccount || '';
          const transferAmount = transfer.tokenAmount || 0;
          const tokenSymbol = transfer.tokenSymbol || transfer.mint?.substring(0, 4) + '...';
          const mintAddress = transfer.mint || '';

          if (fromAddress.toLowerCase() === walletAddress.toLowerCase()) {
            type = 'send';
            amount = transferAmount;
            source = fromAddress;
            destination = toAddress;
            token = tokenSymbol;
            tokenAddress = mintAddress;
            break;
          } else if (toAddress.toLowerCase() === walletAddress.toLowerCase()) {
            type = 'receive';
            amount = transferAmount;
            source = fromAddress;
            destination = toAddress;
            token = tokenSymbol;
            tokenAddress = mintAddress;
            break;
          }
        }
      }

      if (amount === 0) {
        continue;
      }

      transactions.push({
        signature,
        type,
        amount,
        timestamp,
        status: 'confirmed',
        source,
        destination,
        token,
        tokenAddress,
      });
    } catch (error) {
      continue;
    }
  }

  return transactions;
}

/**
 * Fallback: fetch recent signatures + parsed transactions directly from the Solana RPC.
 */
async function fetchFromRpc(
  walletAddress: string,
  limit: number = 10,
  network: string = 'mainnet-beta'
): Promise<HeliusTransaction[]> {
  const { Connection, PublicKey } = await import('@solana/web3.js');

  // Disable the built-in 429 retry loop (it logs "Retrying after Xms..." repeatedly);
  // we handle fallback + retry ourselves across multiple public RPCs.
  const connConfig: any = {
    commitment: 'confirmed',
    disableRetryOnRateLimit: true,
    wsEndpoint: undefined,
  };

  const rpcUrls = network === 'devnet'
    ? ['https://api.devnet.solana.com']
    : [...RPC_BACKUP_URLS];

  let lastError: any = null;
  for (const rpcUrl of rpcUrls) {
    try {
      const conn = new Connection(rpcUrl, connConfig);
      const sigs = await conn.getSignaturesForAddress(
        new PublicKey(walletAddress),
        { limit }
      );

      const transactions: HeliusTransaction[] = [];
      for (const sigInfo of sigs) {
        try {
          const parsed = await conn.getParsedTransaction(sigInfo.signature, {
            maxSupportedTransactionVersion: 0,
          });
          if (!parsed) continue;
          transactions.push(...parseParsedTransaction(parsed, sigInfo.blockTime ?? null, walletAddress));
        } catch (error) {
          continue;
        }
      }
      if (transactions.length > 0 || sigs.length === 0) return transactions;
    } catch (error: any) {
      lastError = error;
      console.log(`[RPC] endpoint failed (${rpcUrl}):`, error?.message ?? error, '- trying next');
    }
  }
  throw lastError ?? new Error('All RPC endpoints failed');
}

function parseParsedTransaction(
  parsed: any,
  blockTime: number | null,
  walletAddress: string
): HeliusTransaction[] {
  const transactions: HeliusTransaction[] = [];
  try {
    const meta = parsed.meta;
    const timestamp = blockTime ?? Date.now() / 1000;

    const accountIndex = parsed.transaction.message.accountKeys.findIndex(
      (key: any) =>
        (typeof key === 'string' ? key : key.pubkey?.toBase58?.() ?? key.pubkey)
          .toLowerCase() === walletAddress.toLowerCase()
    );
    if (accountIndex === -1) return transactions;

    // SOL balance delta for this wallet (lamports -> SOL)
    const preBal = meta?.preBalances?.[accountIndex] ?? 0;
    const postBal = meta?.postBalances?.[accountIndex] ?? 0;
    const solDelta = (postBal - preBal) / 1e9;

    // Determine whether a token transfer occurred (takes priority over SOL fee-only changes)
    let type: 'send' | 'receive' = solDelta >= 0 ? 'receive' : 'send';
    let amount = Math.abs(solDelta);
    let token = 'SOL';
    let tokenAddress = 'So11111111111111111111111111111111111111112';

    const preToken = meta?.preTokenBalances?.find(
      (b: any) =>
        (b.owner?.toBase58?.() ?? b.owner).toLowerCase() === walletAddress.toLowerCase()
    );
    const postToken = meta?.postTokenBalances?.find(
      (b: any) =>
        (b.owner?.toBase58?.() ?? b.owner).toLowerCase() === walletAddress.toLowerCase() &&
        (!preToken || (b.mint ?? '').toLowerCase() === (preToken.mint ?? '').toLowerCase())
    );

    if (preToken && postToken) {
      const decimals = 10 ** (postToken.uiTokenAmount?.decimals ?? 0);
      const preAmount = parseFloat(preToken.uiTokenAmount?.amount ?? '0') / decimals;
      const postAmount = parseFloat(postToken.uiTokenAmount?.amount ?? '0') / decimals;
      const tokenDelta = postAmount - preAmount;
      if (tokenDelta !== 0) {
        type = tokenDelta > 0 ? 'receive' : 'send';
        amount = Math.abs(tokenDelta);
        tokenAddress = postToken.mint;
        token = postToken.mint === 'So11111111111111111111111111111111111111112'
          ? 'SOL'
          : postToken.mint.substring(0, 4) + '...';
      }
    } else if (amount < 1e-8) {
      return transactions;
    }

    if (amount < 1e-8) return transactions;

    transactions.push({
      signature: parsed.transaction.signatures?.[0] ?? '',
      type,
      amount,
      timestamp,
      status: 'confirmed',
      token,
      tokenAddress,
    });
  } catch (e) {
    // return empty
  }
  return transactions;
}

/**
 * Get a single transaction details
 */
export async function getTransactionDetails(signature: string, network: string = 'mainnet-beta'): Promise<any> {
  try {
    const baseUrl = network === 'devnet' 
      ? 'https://api-devnet.helius-rpc.com/v0' 
      : HELIUS_BASE_URL;

    const url = `${baseUrl}/transactions?api-key=${HELIUS_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactions: [signature],
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data[0] || null;
  } catch (error) {
    console.error('Error fetching transaction details:', error);
    return null;
  }
}
