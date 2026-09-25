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
import Constants from 'expo-constants';

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

    // Check if user has SOL for gas — if not, use Kora gasless fallback
    const hasSol = await hasEnoughSolForGas(connection, senderPubkey.toBase58());
    if (!hasSol) {
      console.log('[Zeroo] No SOL for gas, using Kora gasless relay');
      return sendSPLTokenViaKora(connection, sender, toAddress, tokenMint, amount, decimals, reference);
    }

    // Get source token account (sender's actual token account with balance)
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      senderPubkey,
      { programId: TOKEN_PROGRAM_ID }
    );
    let fromTokenAccount: PublicKey | null = null;
    let fromAccountBalance = 0;
    for (const acc of tokenAccounts.value) {
      const parsed = acc.account.data as any;
      if (parsed.parsed.info.mint === tokenMint && parsed.parsed.info.tokenAmount.uiAmount > 0) {
        fromTokenAccount = new PublicKey(acc.pubkey);
        fromAccountBalance = parsed.parsed.info.tokenAmount.uiAmount;
        break;
      }
    }
    if (!fromTokenAccount) {
      // Fallback to ATA if no account with balance found
      fromTokenAccount = await getAssociatedTokenAddress(mintPublicKey, senderPubkey);
    }
    console.log('[SPL] Sending', amount, 'tokens (decimals:', decimals, ') =', amountInSmallestUnit, 'smallest units');
    console.log('[SPL] From account:', fromTokenAccount.toBase58(), 'balance:', fromAccountBalance);
    if (amount > fromAccountBalance) {
      console.error('[SPL] INSUFFICIENT FUNDS: trying to send', amount, 'but account has', fromAccountBalance);
    }

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

// ============================================================
// KORA GASLESS FALLBACK
// When user has no SOL, pay gas via Kora relayer in USDC
// ============================================================

const extra = Constants.expoConfig?.extra ?? {};
const KORA_RPC_URL = extra.kora?.rpcUrl || 'https://precontinental-uninfected-monty.ngrok-free.dev';
const KORA_FEE_PAYER = extra.kora?.feePayerAddress || 'HeaqgYh7oC4n7VWEmgkxSVmHM4NL8B6qBowBpRSE8itW';
const USDC_MINT = extra.kora?.usdcMint || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

interface KoraRpcResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: { code: number; message: string };
}

async function koraRpcCall(method: string, params: any, retries = 3): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(KORA_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      }),
    });
    const text = await response.text();
    if (!text) throw new Error('Empty response from Kora');
    try {
      const data: KoraRpcResponse = JSON.parse(text);
      if (data.error) throw new Error(data.error.message);
      return data.result;
    } catch (parseErr: any) {
      if (parseErr.message && !parseErr.message.includes('Unexpected') && !parseErr.message.includes('JSON')) throw parseErr;
      if (attempt < retries) {
        console.log(`[Kora] ${method} attempt ${attempt + 1} got non-JSON (starts with "${text.slice(0, 5)}"), retrying in 3s...`);
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      throw new Error(`Kora ${method} failed after ${retries + 1} attempts`);
    }
  }
}

/**
 * Send SPL Token via Kora gasless relay (Kora v2 flow).
 * User pays gas in USDC instead of SOL.
 * Kora's wallet pays the SOL gas.
 *
 * Flow:
 * 1. Build estimate tx with Kora as noop fee payer
 * 2. Call estimateTransactionFee RPC to get fee info
 * 3. Create USDC payment instruction (user → Kora payment_address)
 * 4. Build final tx with user instructions + payment instruction
 * 5. User partial signs
 * 6. signTransaction RPC → Kora co-signs
 * 7. Send fully signed tx to Solana
 */
export async function sendSPLTokenViaKora(
  connection: Connection,
  sender: Sender,
  toAddress: string,
  tokenMint: string,
  amount: number,
  decimals: number,
  reference?: string
): Promise<TransactionResult> {
  try {
    let toPublicKey: PublicKey;
    let mintPublicKey: PublicKey;
    try {
      toPublicKey = new PublicKey(toAddress);
      mintPublicKey = new PublicKey(tokenMint);
    } catch {
      return { success: false, error: 'Invalid address or token mint' };
    }

    if (amount <= 0) {
      return { success: false, error: 'Amount must be greater than 0' };
    }

    const { Buffer } = await import('buffer');
    const senderPubkey = sender.type === 'keypair' ? sender.keypair.publicKey : sender.publicKey;
    const amountInSmallestUnit = Math.floor(amount * Math.pow(10, decimals));

    // 1. Get Kora config + blockhash in parallel (2 calls instead of 3)
    const [payerResult, configResult, blockhashResult] = await Promise.all([
      koraRpcCall('getPayerSigner', {}),
      koraRpcCall('getConfig', {}),
      koraRpcCall('getBlockhash', {}),
    ]);
    const feePayerAddress = payerResult.signer_address;
    const feePayerPubkey = new PublicKey(feePayerAddress);
    const paymentAddress = payerResult.payment_address || feePayerAddress;
    const paymentToken = configResult.validation_config?.allowed_spl_paid_tokens?.[0] || USDC_MINT;
    const blockhash = blockhashResult.blockhash;
    console.log('[Kora] Fee payer:', feePayerAddress, 'Payment token:', paymentToken);

    // 2. Build estimate transaction (user instructions only, Kora as noop fee payer)
    const estimateTx = new Transaction();
    estimateTx.recentBlockhash = blockhash;
    estimateTx.feePayer = feePayerPubkey;

    // Add user's transfer instruction
    const toTokenAccount = await getAssociatedTokenAddress(mintPublicKey, toPublicKey);
    const toTokenAccountInfo = await connection.getAccountInfo(toTokenAccount);
    if (!toTokenAccountInfo) {
      estimateTx.add(
        createAssociatedTokenAccountInstruction(
          feePayerPubkey,
          toTokenAccount,
          toPublicKey,
          mintPublicKey
        )
      );
    }
    const fromTokenAccount = await getAssociatedTokenAddress(mintPublicKey, senderPubkey);
    const transferIx = createTransferInstruction(
      fromTokenAccount,
      toTokenAccount,
      senderPubkey,
      amountInSmallestUnit
    );
    if (reference) {
      try {
        transferIx.keys.push({
          pubkey: new PublicKey(reference),
          isSigner: false,
          isWritable: false,
        });
      } catch {}
    }
    estimateTx.add(transferIx);

    // 3. Partially sign estimate tx and estimate fee
    const estimateSigned = estimateTx.serialize({ requireAllSignatures: false }).toString('base64');
    const feeEstimate = await koraRpcCall('estimateTransactionFee', {
      transaction: estimateSigned,
      fee_token: paymentToken,
    });
    console.log('[Kora] Fee estimate:', feeEstimate);

    const paymentAmount = feeEstimate.fee_in_token || 0;
    const paymentAddressFromEstimate = feeEstimate.payment_address || paymentAddress;
    console.log('[Kora] Payment amount:', paymentAmount, 'to:', paymentAddressFromEstimate);

    // 4. Build final transaction with payment instruction
    const finalTx = new Transaction();
    finalTx.recentBlockhash = blockhash;
    finalTx.feePayer = feePayerPubkey;

    // Add user's transfer instructions
    if (!toTokenAccountInfo) {
      finalTx.add(
        createAssociatedTokenAccountInstruction(
          feePayerPubkey,
          toTokenAccount,
          toPublicKey,
          mintPublicKey
        )
      );
    }
    const finalTransferIx = createTransferInstruction(
      fromTokenAccount,
      toTokenAccount,
      senderPubkey,
      amountInSmallestUnit
    );
    if (reference) {
      try {
        finalTransferIx.keys.push({
          pubkey: new PublicKey(reference),
          isSigner: false,
          isWritable: false,
        });
      } catch {}
    }
    finalTx.add(finalTransferIx);

    // Add payment instruction: user pays Kora in USDC for gas
    if (paymentAmount > 0) {
      const paymentMintPubkey = new PublicKey(paymentToken);
      const koraPaymentAta = await getAssociatedTokenAddress(paymentMintPubkey, new PublicKey(paymentAddressFromEstimate));
      const userPaymentAta = await getAssociatedTokenAddress(paymentMintPubkey, senderPubkey);

      // Check if Kora has an ATA for this token, create if needed
      const koraAtaInfo = await connection.getAccountInfo(koraPaymentAta);
      if (!koraAtaInfo) {
        finalTx.add(
          createAssociatedTokenAccountInstruction(
            feePayerPubkey,
            koraPaymentAta,
            new PublicKey(paymentAddressFromEstimate),
            paymentMintPubkey
          )
        );
      }

      // USDC transfer: user pays Kora the estimated fee
      finalTx.add(
        createTransferInstruction(
          userPaymentAta,
          koraPaymentAta,
          senderPubkey,
          paymentAmount
        )
      );
    }

    // 5. User partially signs
    if (sender.type === 'keypair') {
      finalTx.partialSign(sender.keypair);
    } else {
      // Privy: sign the tx, extract bytes, then send to Kora for co-sign + broadcast
      const { Buffer: RNBuffer } = await import('buffer');
      let userSignedBase64: string | null = null;

      // Try signTransaction to get signed bytes
      try {
        const res = await sender.provider.request({ method: 'signTransaction', params: { transaction: finalTx, connection } });
        const st = res?.signedTransaction;
        if (typeof st === 'string') {
          userSignedBase64 = st;
        } else if (st && typeof st.serialize === 'function') {
          userSignedBase64 = RNBuffer.from(st.serialize({ requireAllSignatures: false })).toString('base64');
        } else {
          const signedTx = res?.transaction || res;
          if (typeof signedTx?.serialize === 'function') {
            userSignedBase64 = RNBuffer.from(signedTx.serialize({ requireAllSignatures: false })).toString('base64');
          } else if (signedTx?.type === 'Buffer' && Array.isArray(signedTx.data)) {
            userSignedBase64 = RNBuffer.from(signedTx.data).toString('base64');
          }
        }
      } catch (e: any) {
        console.log('[Kora] Privy signTransaction error:', e.message);
      }

      // If signTransaction didn't work, try signAndSendTransaction and extract bytes
      if (!userSignedBase64) {
        try {
          console.log('[Kora] Trying signAndSendTransaction via Privy...');
          const sendRes = await sender.provider.request({ method: 'signAndSendTransaction', params: { transaction: finalTx, connection } });
          // This sends directly to Solana — Kora not involved, so it will fail
          // But we need to catch this and handle differently
          const sig = sendRes?.signature || sendRes;
          if (typeof sig === 'string') {
            console.log('[Kora] Privy sent directly (no Kora co-sign):', sig);
            // Transaction already broadcast — just confirm it
            return { success: true, signature: sig };
          }
        } catch (e: any) {
          console.log('[Kora] Privy signAndSendTransaction also failed:', e.message);
        }
      }

      if (!userSignedBase64) {
        throw new Error('Privy wallet could not sign transaction. Please try again.');
      }

      console.log('[Kora] Privy signed, sending to Kora for co-sign...');
      console.log('[Kora] signTransaction URL:', KORA_RPC_URL);
      // Kora co-signs
      const signResult = await koraRpcCall('signTransaction', {
        transaction: userSignedBase64,
      });
      const signedTxBase64 = signResult.signed_transaction;
      if (!signedTxBase64) throw new Error('No signed_transaction from Kora');

      // Send via Solana RPC (base64)
      console.log('[Kora] Sending to Solana RPC:', connection.rpcEndpoint);
      const rpcRes = await fetch(connection.rpcEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'sendTransaction',
          params: [signedTxBase64, { encoding: 'base64', skipPreflight: false, preflightCommitment: 'confirmed' }],
        }),
      });
      const rpcText = await rpcRes.text();
      console.log('[Kora] Solana RPC response:', rpcText.slice(0, 200));
      const rpcData = JSON.parse(rpcText);
      if (rpcData.error) throw new Error(rpcData.error.message || JSON.stringify(rpcData.error));
      const privySignature = rpcData.result;
      console.log('[Kora] Privy tx co-signed and sent:', privySignature);

      try {
        const { blockhash: bh, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
        await connection.confirmTransaction({ signature: privySignature, blockhash: bh, lastValidBlockHeight }, 'confirmed');
      } catch {}
      return { success: true, signature: privySignature };
    }

    // 6. Get Kora's co-signature
    const finalSignedBase64 = finalTx.serialize({ requireAllSignatures: false }).toString('base64');
    console.log('[Kora] Calling signTransaction...');

    // Try signTransaction first, fallback to signAndSendTransaction
    let signature: string;
    try {
      const signResult = await koraRpcCall('signTransaction', {
        transaction: finalSignedBase64,
      });
      const signedTxBase64 = signResult.signed_transaction;
      if (!signedTxBase64) throw new Error('No signed_transaction returned from Kora');
      console.log('[Kora] Transaction co-signed');

      // 7. Send via Solana RPC directly (base64, avoids RN Buffer issues)
      const rpcRes = await fetch(connection.rpcEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'sendTransaction',
          params: [signedTxBase64, { encoding: 'base64', skipPreflight: false, preflightCommitment: 'confirmed' }],
        }),
      });
      const rpcData = await rpcRes.json();
      if (rpcData.error) throw new Error(rpcData.error.message || JSON.stringify(rpcData.error));
      signature = rpcData.result;
    } catch (signErr: any) {
      console.log('[Kora] signTransaction+send failed, trying signAndSendTransaction:', signErr.message);
      // Fallback: Kora signs AND broadcasts in one step
      const sendResult = await koraRpcCall('signAndSendTransaction', {
        transaction: finalSignedBase64,
      });
      signature = sendResult.signature;
      if (!signature) throw new Error('No signature returned from signAndSendTransaction');
    }
    console.log('[Kora] Transaction sent:', signature);

    // 8. Confirm
    try {
      const { blockhash: bh, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash: bh,
        lastValidBlockHeight,
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new Error('Transaction failed to confirm');
      }
    } catch {
      console.log('[Kora] Confirmation timeout, checking status...');
      try {
        const status = await connection.getSignatureStatus(signature);
        if (status?.value?.confirmationStatus === 'confirmed' || status?.value?.confirmationStatus === 'finalized') {
          return { success: true, signature };
        }
      } catch {}
    }

    return { success: true, signature };
  } catch (error: any) {
    console.error('[Kora] Gasless transaction failed:', error);
    return {
      success: false,
      error: error.message || 'Kora gasless transaction failed',
    };
  }
}

/**
 * Check if user has enough SOL to pay for a transaction.
 * Returns true if they can pay gas normally, false if they need Kora.
 */
export async function hasEnoughSolForGas(connection: Connection, walletAddress: string): Promise<boolean> {
  try {
    const balance = await connection.getBalance(new PublicKey(walletAddress));
    // Need ~5000 lamports (0.000005 SOL) for a standard transaction
    return balance >= 5000;
  } catch {
    return false;
  }
}
