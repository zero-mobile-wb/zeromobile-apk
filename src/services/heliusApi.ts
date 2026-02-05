// Helius API Service for transaction history
import Constants from 'expo-constants';

const HELIUS_API_KEY = Constants.expoConfig?.extra?.heliusApiKey;
const HELIUS_BASE_URL = Constants.expoConfig?.extra?.heliusBaseUrl;

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
 * Get transaction history for a wallet address using Helius API
 */
export async function getTransactionHistory(
  walletAddress: string,
  limit: number = 10
): Promise<HeliusTransaction[]> {
  try {
    const url = `${HELIUS_BASE_URL}/addresses/${walletAddress}/transactions?api-key=${HELIUS_API_KEY}&limit=${limit}`;

    const response = await fetch(url);

    if (!response.ok) {
      console.error('Helius API error:', response.status);
      return [];
    }

    const data = await response.json();

    // Parse Helius transaction data
    const transactions: HeliusTransaction[] = [];

    for (const tx of data) {
      try {
        // Get transaction signature
        const signature = tx.signature;

        // Get timestamp
        const timestamp = tx.timestamp || Date.now() / 1000;

        // Determine transaction type and amount
        let type: 'send' | 'receive' = 'receive';
        let amount = 0;
        let source = '';
        let destination = '';
        let token = 'SOL';
        let tokenAddress = 'So11111111111111111111111111111111111111112';

        // Check native transfers (SOL)
        if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
          for (const transfer of tx.nativeTransfers) {
            const fromAddress = transfer.fromUserAccount || '';
            const toAddress = transfer.toUserAccount || '';
            const transferAmount = (transfer.amount || 0) / 1e9; // Convert lamports to SOL

            // Check if this wallet sent or received
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

        // Check token transfers (SPL tokens)
        if (amount === 0 && tx.tokenTransfers && tx.tokenTransfers.length > 0) {
          for (const transfer of tx.tokenTransfers) {
            const fromAddress = transfer.fromUserAccount || '';
            const toAddress = transfer.toUserAccount || '';
            const transferAmount = transfer.tokenAmount || 0;
            const tokenSymbol = transfer.tokenSymbol || transfer.mint?.substring(0, 4) + '...';
            const mintAddress = transfer.mint || '';

            // Check if this wallet sent or received
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

        // Skip if no amount
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
        // Skip transactions that can't be parsed
        continue;
      }
    }

    return transactions;
  } catch (error) {
    console.error('Error fetching transaction history from Helius:', error);
    return [];
  }
}

/**
 * Get a single transaction details
 */
export async function getTransactionDetails(signature: string): Promise<any> {
  try {
    const url = `${HELIUS_BASE_URL}/transactions?api-key=${HELIUS_API_KEY}`;

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
