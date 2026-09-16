import { Connection, PublicKey, LAMPORTS_PER_SOL, ParsedAccountData } from '@solana/web3.js';
import { getMultipleTokenPrices, getSolPrice, getTokenInfo } from './jupiterApi';

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const SOL_MINT = 'So11111111111111111111111111111111111111112';

// Balance cache to avoid refetching on page navigation
interface BalanceCache {
  [walletAddress: string]: {
    balance: WalletBalance;
    timestamp: number;
  };
}

const balanceCache: BalanceCache = {};
const BALANCE_CACHE_DURATION = 10000; // 10 seconds

// Pending request dedup: don't fire concurrent fetches for the same wallet
const pendingRequests: { [walletAddress: string]: Promise<WalletBalance> } = {};

export interface TokenBalance {
  mint: string;
  symbol: string;
  name: string;
  logoURI?: string;
  balance: number;
  decimals: number;
  uiAmount: number;
  priceUSD: number;
  valueUSD: number;
}

export interface WalletBalance {
  totalUSD: number;
  solBalance: number;
  solValueUSD: number;
  tokens: TokenBalance[];
  lastUpdated: number;
}

export interface TransactionInfo {
  signature: string;
  blockTime: number | null;
  type: 'send' | 'receive' | 'swap' | 'unknown';
  amount: number;
  status: 'success' | 'failed';
  fee: number;
}

/**
 * Get comprehensive wallet balance including SOL and all SPL tokens
 */
export async function getWalletBalance(
  walletPublicKey: PublicKey,
  connection: Connection,
  forceRefresh: boolean = false
): Promise<WalletBalance> {
  const walletAddress = walletPublicKey.toBase58();

  console.log('Fetching balance for:', walletAddress, 'Force refresh:', forceRefresh);

  // Dedup concurrent requests for the same wallet
  if (!forceRefresh && walletAddress in pendingRequests) {
    console.log('Reusing pending request for:', walletAddress);
    return pendingRequests[walletAddress];
  }

  // Check cache first (unless forced refresh)
  if (!forceRefresh) {
    const cached = balanceCache[walletAddress];
    if (cached && Date.now() - cached.timestamp < BALANCE_CACHE_DURATION) {
      console.log('Returning cached balance:', cached.balance.totalUSD);
      return cached.balance;
    }
  }

  const promise = (async (): Promise<WalletBalance> => {
    try {
      // 1. Get SOL balance
      const solLamports = await connection.getBalance(walletPublicKey);
      const solBalance = solLamports / LAMPORTS_PER_SOL;
      console.log('SOL Balance (lamports):', solLamports, 'SOL Balance:', solBalance);

      // 2. Get all SPL token accounts
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        walletPublicKey,
        { programId: TOKEN_PROGRAM_ID }
      );
      console.log('Token accounts found:', tokenAccounts.value.length);

      // 3. Extract token data
      const tokens: Array<{
        mint: string;
        balance: number;
        decimals: number;
        uiAmount: number;
      }> = [];

      tokenAccounts.value.forEach(accountInfo => {
        const parsedData = accountInfo.account.data as ParsedAccountData;
        const tokenAmount = parsedData.parsed.info.tokenAmount;

        // Only include tokens with non-zero balance
        if (tokenAmount.uiAmount > 0) {
          tokens.push({
            mint: parsedData.parsed.info.mint,
            balance: tokenAmount.amount,
            decimals: tokenAmount.decimals,
            uiAmount: tokenAmount.uiAmount,
          });
        }
      });
      console.log('Non-zero token balances:', tokens.length);

      // 4. Get all token prices (including SOL)
      const allMints = [SOL_MINT, ...tokens.map(t => t.mint)];
      const prices = await getMultipleTokenPrices(allMints);

      // 5. Calculate SOL value
      let solPriceUSD = prices[SOL_MINT] || 0;
      if (solPriceUSD === 0) solPriceUSD = 150.0; // Devnet fallback SOL price
      const solValueUSD = solBalance * solPriceUSD;
      console.log('SOL Price:', solPriceUSD, 'SOL Value USD:', solValueUSD);

      // 6. Fetch token metadata and calculate values
      const metadataResults = await Promise.all(
        tokens.map(token => getTokenInfo(token.mint))
      );

      const tokensWithValues: TokenBalance[] = tokens.map((token, i) => {
          let priceUSD = prices[token.mint] || 0;

          // Mock Devnet prices so the Send UI doesn't compute $0 value
          if (priceUSD === 0) {
            if (token.mint === '4zMMC9srt5Ri5X14YGWA8x9Ww7C1L1iKVp1PZov2D34x') priceUSD = 1.0; // Devnet USDC
            if (token.mint === 'EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS') priceUSD = 1.0; // Devnet USDT
            if (token.mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') priceUSD = 1.0; // Mainnet USDC
            if (token.mint === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB') priceUSD = 1.0; // Mainnet USDT
            if (token.mint === 'So11111111111111111111111111111111111111112') priceUSD = 150.0; // Devnet SOL
          }

          const valueUSD = token.uiAmount * priceUSD;
          const metadata = metadataResults[i];

          return {
            ...token,
            symbol: metadata.symbol || (token.mint === '4zMMC9srt5Ri5X14YGWA8x9Ww7C1L1iKVp1PZov2D34x' ? 'USDC' : token.mint === 'EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS' ? 'USDT' : 'Unknown'),
            name: metadata.name || 'Devnet Token',
            logoURI: metadata.logoURI || (token.mint === '4zMMC9srt5Ri5X14YGWA8x9Ww7C1L1iKVp1PZov2D34x' ? 'https://assets.coingecko.com/coins/images/6319/large/usdc.png' : token.mint === 'EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS' ? 'https://assets.coingecko.com/coins/images/325/large/Tether.png' : undefined),
            priceUSD,
            valueUSD,
          };
        }
      );

      // 7. Calculate total portfolio value
      const totalTokenValue = tokensWithValues.reduce(
        (sum, token) => sum + token.valueUSD,
        0
      );
      const totalUSD = solValueUSD + totalTokenValue;

      console.log('Total Token Value:', totalTokenValue);
      console.log('Total USD:', totalUSD);

      const walletBalance: WalletBalance = {
        totalUSD,
        solBalance: solBalance,
        solValueUSD,
        tokens: tokensWithValues,
        lastUpdated: Date.now(),
      };

      // Cache the balance
      balanceCache[walletAddress] = {
        balance: walletBalance,
        timestamp: Date.now(),
      };

      console.log('Returning wallet balance:', walletBalance);

      return walletBalance;
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      throw error;
    }
  })();

  pendingRequests[walletAddress] = promise;
  promise.finally(() => { delete pendingRequests[walletAddress]; });

  return promise;
}

/**
 * Get latest transactions for a wallet
 */
export async function getLatestTransactions(
  walletPublicKey: PublicKey,
  connection: Connection,
  limit: number = 10
): Promise<TransactionInfo[]> {
  try {
    // 1. Get transaction signatures
    const signatures = await connection.getSignaturesForAddress(
      walletPublicKey,
      { limit }
    );

    if (signatures.length === 0) {
      return [];
    }

    // 2. Get transaction details
    const transactions = await Promise.all(
      signatures.map(sig =>
        connection.getParsedTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0,
        })
      )
    );

    // 3. Parse transactions
    const parsedTransactions: TransactionInfo[] = [];

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      const sig = signatures[i];

      if (!tx) continue;

      // Determine transaction type and amount
      const type = determineTransactionType(tx, walletPublicKey);
      const amount = extractTransactionAmount(tx, walletPublicKey);
      const fee = tx.meta?.fee ? tx.meta.fee / LAMPORTS_PER_SOL : 0;

      parsedTransactions.push({
        signature: sig.signature,
        blockTime: tx.blockTime ?? null,
        type,
        amount,
        status: tx.meta?.err ? 'failed' : 'success',
        fee,
      });
    }

    return parsedTransactions;
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
}

/**
 * Determine transaction type based on instructions
 */
function determineTransactionType(
  transaction: any,
  walletPublicKey: PublicKey
): 'send' | 'receive' | 'swap' | 'unknown' {
  try {
    const instructions = transaction.transaction.message.instructions;

    // Check for common program interactions
    for (const instruction of instructions) {
      const programId = instruction.programId?.toBase58();

      // Jupiter/Swap programs
      if (
        programId === 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB' ||
        programId === 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'
      ) {
        return 'swap';
      }
    }

    // Check if wallet is sender or receiver
    const preBalances = transaction.meta?.preBalances || [];
    const postBalances = transaction.meta?.postBalances || [];
    const accountKeys = transaction.transaction.message.accountKeys;

    const walletIndex = accountKeys.findIndex(
      (key: any) => key.pubkey.toBase58() === walletPublicKey.toBase58()
    );

    if (walletIndex !== -1) {
      const preBalance = preBalances[walletIndex];
      const postBalance = postBalances[walletIndex];

      if (postBalance > preBalance) {
        return 'receive';
      } else if (postBalance < preBalance) {
        return 'send';
      }
    }

    return 'unknown';
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Extract transaction amount
 */
function extractTransactionAmount(
  transaction: any,
  walletPublicKey: PublicKey
): number {
  try {
    const preBalances = transaction.meta?.preBalances || [];
    const postBalances = transaction.meta?.postBalances || [];
    const accountKeys = transaction.transaction.message.accountKeys;

    const walletIndex = accountKeys.findIndex(
      (key: any) => key.pubkey.toBase58() === walletPublicKey.toBase58()
    );

    if (walletIndex !== -1) {
      const preBalance = preBalances[walletIndex];
      const postBalance = postBalances[walletIndex];
      const difference = Math.abs(postBalance - preBalance);

      return difference / LAMPORTS_PER_SOL;
    }

    return 0;
  } catch (error) {
    return 0;
  }
}
