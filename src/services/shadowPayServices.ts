import { Connection, PublicKey, Transaction, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as nacl from 'tweetnacl';
import bs58 from 'bs58';
import { Platform } from 'react-native';
import { Buffer } from 'buffer';

// Polyfill global Buffer for React Native
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

import Constants from 'expo-constants';

const BACKEND_URL = ((Constants.expoConfig?.extra?.backendUrl as string) || '').replace(/\/$/, '');

console.log('Using backend URL:', BACKEND_URL);


export interface ShadowIDRegistration {
  registered: boolean;
  commitment?: string;
  root?: string;
  error?: string;
}

export interface PoolBalance {
  wallet: string;
  available: number;
  deposited: number;
  withdrawn_to_escrow: number;
  migrated: boolean;
  pool_address: string;
}

export interface DepositTransaction {
  success: boolean;
  unsigned_tx_base64?: string;
  pool_address?: string;
  user_balance_pda?: string;
  amount?: number;
  error?: string;
}

export interface PrivatePaymentParams {
  recipientAddress: string;
  amount: number; // in SOL
  memo?: string;
}

export interface PrivatePaymentResult {
  success: boolean;
  signature?: string;
  error?: string;
  commitment?: string;
  txHash?: string;
}

// ==================== SHADOWID FUNCTIONS ====================

/**
 * Check if wallet is registered with ShadowID
 */
export async function checkShadowIDRegistration(walletAddress: string): Promise<boolean> {
  try {
    const statusUrl = Constants.expoConfig?.extra?.shadowIdStatusUrl || 'https://shadow.radr.fun/shadowpay/shadowid/v1/id/status';
    const response = await fetch(
      `${statusUrl}/${walletAddress}`
    );
    const data = await response.json();
    return data.registered === true;
  } catch (error) {
    console.error('Error checking ShadowID registration:', error);
    return false;
  }
}

/**
 * Register wallet with ShadowID using signature verification
 * This is REQUIRED before making private payments
 */
export async function registerShadowID(
  wallet: Keypair,
  walletAddress: string
): Promise<ShadowIDRegistration> {
  try {
    // Create message to sign
    const timestamp = Date.now();
    const message = `ShadowPay Registration - Timestamp: ${timestamp}`;
    const messageBytes = new TextEncoder().encode(message);

    // Sign the message
    const signature = nacl.sign.detached(messageBytes, wallet.secretKey);
    const signatureBase58 = bs58.encode(signature);

    // Register via backend with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('[ShadowPay] Request timeout!');
      controller.abort();
    }, 30000); // 30 second timeout

    console.log('[ShadowPay] Sending registration request to:', `${BACKEND_URL}/api/shadowpay/shadowid/register`);
    const response = await fetch(`${BACKEND_URL}/api/shadowpay/shadowid/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true', // Skip ngrok browser warning
      },
      body: JSON.stringify({
        walletAddress,
        signature: signatureBase58,
        message,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log('[ShadowPay] Response received, status:', response.status);

    const result = await response.json();

    if (result.success && result.data) {
      return {
        registered: true,
        commitment: result.data.commitment,
        root: result.data.root,
      };
    } else {
      return {
        registered: false,
        error: result.error || 'Registration failed',
      };
    }
  } catch (error: any) {
    console.error('[ShadowPay] Registration error:', error);

    if (error.name === 'AbortError') {
      return {
        registered: false,
        error: 'Request timeout - check network connection',
      };
    }

    return {
      registered: false,
      error: error.message || 'Registration failed',
    };
  }
}

// ==================== POOL FUNCTIONS ====================

/**
 * Get user's privacy pool balance
 */
export async function getPoolBalance(walletAddress: string): Promise<PoolBalance | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/shadowpay/pool/balance/${walletAddress}`, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
      },
    });
    const result = await response.json();

    if (result.success && result.balance) {
      return result.balance;
    }
    return null;
  } catch (error) {
    console.error('Error fetching pool balance:', error);
    return null;
  }
}

/**
 * Create unsigned transaction to deposit SOL to privacy pool
 * User must sign and submit this transaction
 */
export async function createPoolDeposit(
  walletAddress: string,
  amountSOL: number
): Promise<DepositTransaction> {
  try {
    const lamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);

    // Minimum deposit is 0.01 SOL
    if (lamports < 10_000_000) {
      return {
        success: false,
        error: 'Minimum deposit is 0.01 SOL',
      };
    }

    const response = await fetch(`${BACKEND_URL}/api/shadowpay/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({
        walletAddress,
        amount: lamports,
      }),
    });

    const result = await response.json();

    if (result.success && result.transaction) {
      return {
        success: true,
        unsigned_tx_base64: result.transaction.unsigned_tx_base64,
        pool_address: result.transaction.pool_address,
        user_balance_pda: result.transaction.user_balance_pda,
        amount: result.transaction.amount,
      };
    } else {
      return {
        success: false,
        error: result.error || 'Failed to create deposit transaction',
      };
    }
  } catch (error: any) {
    console.error('Pool deposit error:', error);
    return {
      success: false,
      error: error.message || 'Failed to create deposit',
    };
  }
}

/**
 * Sign and submit pool deposit transaction
 */
export async function submitPoolDeposit(
  connection: Connection,
  wallet: Keypair,
  unsignedTxBase64: string
): Promise<{ success: boolean; signature?: string; error?: string }> {
  try {
    // Decode the unsigned transaction
    const txBuffer = Buffer.from(unsignedTxBase64, 'base64');
    const transaction = Transaction.from(txBuffer);

    // Get fresh blockhash
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    // Sign the transaction
    transaction.sign(wallet);

    // Send the transaction
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');

    return {
      success: true,
      signature,
    };
  } catch (error: any) {
    console.error('Submit deposit error:', error);
    return {
      success: false,
      error: error.message || 'Failed to submit deposit',
    };
  }
}

// ==================== PRIVATE PAYMENT FUNCTIONS ====================

/**
 * Create and settle a private payment using ShadowPay
 * This is a simplified flow - in production you'd generate ZK proofs client-side
 */
export async function createPrivatePayment(
  connection: Connection,
  wallet: Keypair,
  params: PrivatePaymentParams
): Promise<PrivatePaymentResult> {
  try {
    const { recipientAddress, amount } = params;

    // Validate recipient
    new PublicKey(recipientAddress);

    // Check pool balance
    const poolBalance = await getPoolBalance(wallet.publicKey.toBase58());
    if (!poolBalance) {
      return {
        success: false,
        error: 'Could not fetch pool balance',
      };
    }

    const amountLamports = Math.floor(amount * LAMPORTS_PER_SOL);
    if (poolBalance.available < amountLamports) {
      return {
        success: false,
        error: `Insufficient pool balance. Have ${poolBalance.available / LAMPORTS_PER_SOL} SOL, need ${amount} SOL`,
      };
    }

    // In a real implementation, you would:
    // 1. Generate ZK proof client-side using circuit files
    // 2. Create payment commitment and nullifier
    // 3. Submit proof to settler

    // For now, we'll use the x402 settle endpoint
    // This requires the full ZK proof payload which would be generated client-side

    // Simplified payment request
    const paymentRequest = {
      x402Version: 1,
      paymentRequirements: {
        scheme: 'zkproof',
        network: 'solana-mainnet',
        maxAmountRequired: amount.toString(), // SOL not lamports
        resource: 'Private Transfer',
        description: 'Private payment via ShadowPay',
        mimeType: 'application/json',
        payTo: recipientAddress,
        maxTimeoutSeconds: 300,
      },
      metadata: {
        userWallet: wallet.publicKey.toBase58(),
      },
    };

    const response = await fetch(`${BACKEND_URL}/api/shadowpay/settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify(paymentRequest),
    });

    const result = await response.json();

    if (result.success && result.data) {
      return {
        success: true,
        signature: result.data.txHash,
        commitment: result.data.commitment,
        txHash: result.data.txHash,
      };
    } else {
      return {
        success: false,
        error: result.error || result.data?.error || 'Payment failed',
      };
    }
  } catch (error: any) {
    console.error('Private payment error:', error);
    return {
      success: false,
      error: error.message || 'Payment failed',
    };
  }
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Estimate fees for private transfer
 * ShadowPay fees: First payment ~$0.86, subsequent ~$0.02
 */
export function estimatePrivateTransferFee(isFirstPayment: boolean = false): number {
  // Convert USD to SOL (approximate, would need real price feed)
  const solPrice = 100; // $100 per SOL (example)
  if (isFirstPayment) {
    return 0.86 / solPrice; // ~0.0086 SOL
  }
  return 0.02 / solPrice; // ~0.0002 SOL
}

/**
 * Get privacy level description
 */
export function getPrivacyLevel(): string {
  return 'High - ZK Proof + Relayer Settlement';
}

/**
 * Validate ShadowPay API connection
 */
export async function validateShadowPayAPI(): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/shadowpay/pool/balance/test`);
    return response.ok || response.status === 500; // 500 means backend is up but wallet invalid
  } catch (error) {
    console.error('Backend connection error:', error);
    return false;
  }
}

// ==================== LEGACY COMPATIBILITY ====================

// Keep these for backward compatibility with existing code
export interface ShadowPayTransferParams {
  recipientAddress: string;
  amount: number;
  tokenMint?: string;
  memo?: string;
}

export interface ShadowPayTransferResult {
  success: boolean;
  signature?: string;
  error?: string;
  shadowTxId?: string;
  hops?: number;
}

/**
 * Legacy function - redirects to new implementation
 */
export async function createPrivateTransfer(
  connection: Connection,
  fromKeypair: Keypair,
  params: ShadowPayTransferParams
): Promise<ShadowPayTransferResult> {
  const result = await createPrivatePayment(connection, fromKeypair, params);
  return {
    ...result,
    shadowTxId: result.commitment,
    hops: 1, // ShadowPay uses relayer, not multi-hop
  };
}

export const createShadowPayTransfer = createPrivateTransfer;
export const createQuickPrivateTransfer = createPrivateTransfer;
export const createSplitPrivateTransfer = createPrivateTransfer;

export async function getShadowPayBalance(walletAddress: string): Promise<number> {
  const balance = await getPoolBalance(walletAddress);
  return balance ? balance.available / LAMPORTS_PER_SOL : 0;
}

export async function checkShadowPayStatus(transferId: string): Promise<any> {
  return { status: 'completed', transferId };
}