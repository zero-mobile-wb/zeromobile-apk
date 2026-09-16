import { 
  Connection, 
  PublicKey, 
  SystemProgram, 
  Transaction, 
  Keypair, 
  LAMPORTS_PER_SOL, 
  sendAndConfirmTransaction 
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
} from '@solana/spl-token';

export interface TransactionResult {
  success: boolean;
  signature?: string;
  error?: string;
}

export type Sender = 
  | { type: 'keypair'; keypair: Keypair }
  | { type: 'privy'; publicKey: PublicKey; provider: any };

/**
 * Standardized method to sign and send transactions using a Privy embedded wallet provider.
 * This abstracts the complex varying interfaces provided by the Privy SDK.
 */
export async function signAndSendWithPrivy(
  connection: Connection,
  transaction: Transaction,
  provider: any
): Promise<string> {
  let signature: string;
  if (typeof provider.request === 'function') {
    try {
      const res = await provider.request({ method: 'signTransaction', params: { transaction, connection } });
      
      let serialized: Buffer | Uint8Array;
      if (res && res.signedTransaction && typeof res.signedTransaction === 'string') {
        const { Buffer } = await import('buffer');
        serialized = Buffer.from(res.signedTransaction, 'base64');
      } else {
        const signedTx = res.transaction || res;
        if (typeof signedTx.serialize === 'function') {
          serialized = signedTx.serialize();
        } else if (signedTx && signedTx.type === 'Buffer' && Array.isArray(signedTx.data)) {
          const { Buffer } = await import('buffer');
          serialized = Buffer.from(signedTx.data);
        } else {
          throw new Error("Unable to parse signed transaction format: " + JSON.stringify(signedTx));
        }
      }
      signature = await connection.sendRawTransaction(serialized, { skipPreflight: false });
    } catch (e: any) {
      if (e.message && (e.message.includes('Method not supported') || e.message.includes('Unable to parse'))) {
        const res = await provider.request({ method: 'signAndSendTransaction', params: { transaction, connection } });
        signature = res.signature || res;
      } else {
        throw e;
      }
    }
  } else if (typeof provider.signAndSendTransaction === 'function') {
    const result = await provider.signAndSendTransaction({ transaction, connection });
    signature = result.signature || result;
  } else if (typeof provider.sendTransaction === 'function') {
    const result = await provider.sendTransaction({ transaction, connection });
    signature = result.signature || result;
  } else if (typeof provider.signTransaction === 'function') {
    const res = await provider.signTransaction({ transaction });
    const signedTx = res.signedTransaction ? (await import('buffer')).Buffer.from(res.signedTransaction, 'base64') : (res.transaction || res);
    const serialized = typeof signedTx.serialize === 'function' ? signedTx.serialize() : signedTx;
    signature = await connection.sendRawTransaction(serialized, { skipPreflight: false });
  } else {
    throw new Error("Provider does not support any known transaction signing methods.");
  }
  return signature;
}

/**
 * Send SOL from one wallet to another
 */
export async function sendSOL(
  connection: Connection,
  sender: Sender,
  toAddress: string,
  amountSOL: number
): Promise<TransactionResult> {
  try {
    // Validate the recipient address
    let toPublicKey: PublicKey;
    try {
      toPublicKey = new PublicKey(toAddress);
    } catch (error) {
      return {
        success: false,
        error: 'Invalid recipient address',
      };
    }

    // Check if amount is valid
    if (amountSOL <= 0) {
      return {
        success: false,
        error: 'Amount must be greater than 0',
      };
    }

    // Convert SOL to lamports
    const lamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);

    // Get sender public key
    const senderPubkey = sender.type === 'keypair' ? sender.keypair.publicKey : sender.publicKey;

    // Check sender's balance
    const balance = await connection.getBalance(senderPubkey);
    
    // Estimate transaction fee (0.000005 SOL = 5000 lamports)
    const estimatedFee = 5000;
    
    console.log('Balance check:', {
      walletBalance: balance / LAMPORTS_PER_SOL,
      amountToSend: amountSOL,
      fee: estimatedFee / LAMPORTS_PER_SOL,
      required: (lamports + estimatedFee) / LAMPORTS_PER_SOL,
    });
    
    if (balance < lamports + estimatedFee) {
      return {
        success: false,
        error: `Insufficient balance. You need ${((lamports + estimatedFee) / LAMPORTS_PER_SOL).toFixed(6)} SOL but have ${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL`,
      };
    }

    // Create transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: senderPubkey,
        toPubkey: toPublicKey,
        lamports,
      })
    );

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = senderPubkey;

    // Sign and send transaction
    let signature: string;
    if (sender.type === 'keypair') {
      transaction.sign(sender.keypair);
      signature = await connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
    } else {
      signature = await signAndSendWithPrivy(connection, transaction, sender.provider);
    }

    console.log('SOL transaction sent:', signature);

    // Confirm transaction using polling (better for React Native)
    try {
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      if (confirmation.value.err) {
        console.error('Transaction confirmation error:', confirmation.value.err);
        throw new Error('Transaction failed to confirm');
      }

      console.log('SOL transaction confirmed successfully:', signature);
    } catch (confirmError: any) {
      console.error('Error confirming transaction:', confirmError);
      // If confirmation times out but transaction was sent, still return success
      // The transaction might still be processing
      console.log('Transaction sent but confirmation timed out, checking status...');
      
      // Try to get transaction status
      try {
        const status = await connection.getSignatureStatus(signature);
        if (status?.value?.confirmationStatus === 'confirmed' || status?.value?.confirmationStatus === 'finalized') {
          console.log('Transaction is confirmed via status check');
          return {
            success: true,
            signature,
          };
        }
      } catch (statusError) {
        console.error('Could not check transaction status:', statusError);
      }
      
      // If we can't confirm, but transaction was sent, still return success with signature
      // User can check on explorer
      console.log('Returning success with signature despite confirmation timeout');
    }

    return {
      success: true,
      signature,
    };
  } catch (error: any) {
    console.error('Transaction error:', error);
    return {
      success: false,
      error: error.message || 'Transaction failed',
    };
  }
}

/**
 * Send SPL Token from one wallet to another
 */
export async function sendSPLToken(
  connection: Connection,
  sender: Sender,
  toAddress: string,
  tokenMint: string,
  amount: number,
  decimals: number,
  reference?: string
): Promise<TransactionResult> {
  try {
    // Validate addresses
    let toPublicKey: PublicKey;
    let mintPublicKey: PublicKey;
    
    try {
      toPublicKey = new PublicKey(toAddress);
      mintPublicKey = new PublicKey(tokenMint);
    } catch (error) {
      return {
        success: false,
        error: 'Invalid address or token mint',
      };
    }

    // Check if amount is valid
    if (amount <= 0) {
      return {
        success: false,
        error: 'Amount must be greater than 0',
      };
    }

    // Convert amount to smallest unit (based on decimals)
    const amountInSmallestUnit = Math.floor(amount * Math.pow(10, decimals));

    // Get sender public key
    const senderPubkey = sender.type === 'keypair' ? sender.keypair.publicKey : sender.publicKey;

    // Get source token account (sender's token account)
    const fromTokenAccount = await getAssociatedTokenAddress(
      mintPublicKey,
      senderPubkey
    );

    // Get destination token account (recipient's token account)
    const toTokenAccount = await getAssociatedTokenAddress(
      mintPublicKey,
      toPublicKey
    );

    console.log('SPL Token Transfer:', {
      from: senderPubkey.toBase58(),
      to: toPublicKey.toBase58(),
      amount,
      decimals,
      amountInSmallestUnit,
      fromTokenAccount: fromTokenAccount.toBase58(),
      toTokenAccount: toTokenAccount.toBase58(),
    });

    // Create transaction
    const transaction = new Transaction();

    // Check if recipient's token account exists
    const toTokenAccountInfo = await connection.getAccountInfo(toTokenAccount);
    
    if (!toTokenAccountInfo) {
      // Create associated token account for recipient if it doesn't exist
      console.log('Creating associated token account for recipient');
      transaction.add(
        createAssociatedTokenAccountInstruction(
          senderPubkey, // payer
          toTokenAccount, // associated token account
          toPublicKey, // owner
          mintPublicKey // mint
        )
      );
    }

    // Add transfer instruction
    const transferIx = createTransferInstruction(
      fromTokenAccount, // source
      toTokenAccount, // destination
      senderPubkey, // owner
      amountInSmallestUnit // amount
    );
    
    if (reference) {
      try {
        transferIx.keys.push({
          pubkey: new PublicKey(reference),
          isSigner: false,
          isWritable: false,
        });
      } catch (e) {
        console.warn('Invalid reference public key:', reference);
      }
    }
    
    transaction.add(transferIx);

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = senderPubkey;

    // Sign and send transaction
    let signature: string;
    if (sender.type === 'keypair') {
      transaction.sign(sender.keypair);
      signature = await connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
    } else {
      signature = await signAndSendWithPrivy(connection, transaction, sender.provider);
    }

    console.log('SPL Token transaction sent:', signature);

    // Confirm transaction using polling (better for React Native)
    try {
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      if (confirmation.value.err) {
        console.error('SPL Token confirmation error:', confirmation.value.err);
        throw new Error('Transaction failed to confirm');
      }

      console.log('SPL Token transfer confirmed successfully:', signature);
    } catch (confirmError: any) {
      console.error('Error confirming SPL token transaction:', confirmError);
      // If confirmation times out but transaction was sent, still return success
      console.log('SPL transaction sent but confirmation timed out, checking status...');
      
      // Try to get transaction status
      try {
        const status = await connection.getSignatureStatus(signature);
        if (status?.value?.confirmationStatus === 'confirmed' || status?.value?.confirmationStatus === 'finalized') {
          console.log('SPL transaction is confirmed via status check');
          return {
            success: true,
            signature,
          };
        }
      } catch (statusError) {
        console.error('Could not check SPL transaction status:', statusError);
      }
      
      // If we can't confirm, but transaction was sent, still return success with signature
      console.log('Returning success with signature despite confirmation timeout');
    }

    return {
      success: true,
      signature,
    };
  } catch (error: any) {
    console.error('SPL Token transfer error:', error);
    return {
      success: false,
      error: error.message || 'SPL Token transfer failed',
    };
  }
}

/**
 * Validate Solana address
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get estimated transaction fee
 */
export async function getEstimatedFee(connection: Connection): Promise<number> {
  try {
    const { feeCalculator } = await connection.getRecentBlockhash();
    return feeCalculator.lamportsPerSignature / LAMPORTS_PER_SOL;
  } catch {
    // Return default fee estimate
    return 0.000005; // 5000 lamports
  }
}
