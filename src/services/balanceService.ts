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
const BALANCE_CACHE_DURATION = 300000; // 5 minutes

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
  
  // Check cache first (unless forced refresh)
  if (!forceRefresh) {
    const cached = balanceCache[walletAddress];
    if (cached && Date.now() - cached.timestamp < BALANCE_CACHE_DURATION) {
      console.log('Returning cached balance:', cached.balance.totalUSD);
      return cached.balance;
    }
  }

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

    // 4. Get all token prices (including SOL)
    const allMints = [SOL_MINT, ...tokens.map(t => t.mint)];
    const prices = await getMultipleTokenPrices(allMints);

    // 5. Calculate SOL value
    const solPriceUSD = prices[SOL_MINT] || 0;
    const solValueUSD = solBalance * solPriceUSD;
    console.log('SOL Price:', solPriceUSD, 'SOL Value USD:', solValueUSD);

    // 6. Fetch token metadata and calculate values
    const tokensWithValues: TokenBalance[] = await Promise.all(
      tokens.map(async (token) => {
        const priceUSD = prices[token.mint] || 0;
        const valueUSD = token.uiAmount * priceUSD;
        
        // Fetch token metadata (symbol, name, logo)
        const metadata = await getTokenInfo(token.mint);

        return {
          ...token,
          symbol: metadata.symbol,
          name: metadata.name,
          logoURI: metadata.logoURI,
          priceUSD,
          valueUSD,
        };
      })
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
        blockTime: tx.blockTime,
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
