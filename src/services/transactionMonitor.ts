import { Connection, PublicKey } from '@solana/web3.js';
import { notifyIncomingTransaction } from './notificationService';
import { getTransactionHistory } from './heliusApi';

// Store last known transaction signature to detect new ones
let lastKnownSignature: string | null = null;
let monitoringInterval: NodeJS.Timeout | null = null;

/**
 * Start monitoring for incoming transactions
 */
export function startTransactionMonitoring(
  walletAddress: string,
  checkIntervalMs: number = 30000 // Check every 30 seconds
): void {
  // Clear any existing monitoring
  stopTransactionMonitoring();

  console.log('Starting transaction monitoring for:', walletAddress);

  // Initial check to set the baseline
  checkForNewTransactions(walletAddress);

  // Set up periodic checking
  monitoringInterval = setInterval(() => {
    checkForNewTransactions(walletAddress);
  }, checkIntervalMs);
}

/**
 * Stop monitoring for transactions
 */
export function stopTransactionMonitoring(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('Stopped transaction monitoring');
  }
  lastKnownSignature = null;
}

/**
 * Check for new transactions and notify if any incoming
 */
async function checkForNewTransactions(walletAddress: string): Promise<void> {
  try {
    // Get recent transactions
    const transactions = await getTransactionHistory(walletAddress, 5);

    if (transactions.length === 0) {
      return;
    }

    const latestTransaction = transactions[0];

    // If this is the first check, just store the signature
    if (!lastKnownSignature) {
      lastKnownSignature = latestTransaction.signature;
      return;
    }

    // Check if there's a new transaction
    if (latestTransaction.signature !== lastKnownSignature) {
      console.log('New transaction detected:', latestTransaction.signature);

      // Check if it's an incoming transaction (received)
      if (latestTransaction.type === 'receive') {
        console.log('Incoming transaction! Notifying user...');
        
        // Calculate USD value if we have token price info
        // For now, we'll use the transaction history data
        const usdValue = latestTransaction.amount * (latestTransaction.token === 'SOL' ? 200 : 1); // Rough estimate, you can improve this
        
        await notifyIncomingTransaction(
          latestTransaction.amount,
          latestTransaction.token || 'SOL',
          latestTransaction.signature,
          usdValue,
          latestTransaction.source
        );
      }

      // Update last known signature
      lastKnownSignature = latestTransaction.signature;
    }
  } catch (error) {
    console.error('Error checking for new transactions:', error);
  }
}

/**
 * Manually trigger a check for new transactions
 */
export async function checkNow(walletAddress: string): Promise<void> {
  await checkForNewTransactions(walletAddress);
}
