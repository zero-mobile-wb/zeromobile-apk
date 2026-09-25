import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';

const KORA_RPC = 'https://precontinental-uninfected-monty.ngrok-free.dev';
const SOLANA_RPC = 'https://mainnet.helius-rpc.com/?api-key=f9a619f4-308f-41a8-935f-43d89b0d3c3e';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const SENDER_KEY = '2fJgwEUagqojMMVYrDZZu5FSFc3g6JUkt7P97S7yT6vYMXTxxKQtmuifmE4Ukcx3s8TB3cFsJGCwgDtoz6myyDU6';
const TO_ADDRESS = '4fyAgodVUDWtSXfW7UK8XLS4XjJvQ77QrysppSPcFZPn';
const AMOUNT = 0.10; // 0.10 USDC

async function koraRpc(method, params) {
  const res = await fetch(KORA_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  const text = await res.text();
  console.log(`[Kora RPC] ${method} response:`, text.substring(0, 200));
  if (!text) throw new Error('Empty response');
  const data = JSON.parse(text);
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.result;
}

async function main() {
  const connection = new Connection(SOLANA_RPC, 'confirmed');
  const keypair = Keypair.fromSecretKey(bs58.decode(SENDER_KEY));
  const senderPubkey = keypair.publicKey;
  console.log('Sender:', senderPubkey.toBase58());
  console.log('Recipient:', TO_ADDRESS);

  const mintPubkey = new PublicKey(USDC_MINT);
  const toPubkey = new PublicKey(TO_ADDRESS);
  const amountSmallest = Math.floor(AMOUNT * 1e6);
  console.log('Amount (smallest):', amountSmallest);

  // Check sender balance
  const senderAta = await getAssociatedTokenAddress(mintPubkey, senderPubkey);
  console.log('Sender ATA:', senderAta.toBase58());

  // 1. Get payer + config
  const [payerResult, configResult] = await Promise.all([
    koraRpc('getPayerSigner', {}),
    koraRpc('getConfig', {}),
  ]);
  const feePayerAddress = payerResult.signer_address;
  const paymentAddress = payerResult.payment_address || feePayerAddress;
  const paymentToken = configResult.validation_config?.allowed_spl_paid_tokens?.[0] || USDC_MINT;
  console.log('Fee payer:', feePayerAddress);
  console.log('Payment token:', paymentToken);

  // 2. Build estimate tx
  const estimateTx = new Transaction();
  const { blockhash } = await koraRpc('getBlockhash', {});
  estimateTx.recentBlockhash = blockhash;
  estimateTx.feePayer = new PublicKey(feePayerAddress);

  // Check if recipient ATA exists
  const toAta = await getAssociatedTokenAddress(mintPubkey, toPubkey);
  const toAtaInfo = await connection.getAccountInfo(toAta);
  if (!toAtaInfo) {
    console.log('Creating recipient ATA...');
    estimateTx.add(createAssociatedTokenAccountInstruction(
      new PublicKey(feePayerAddress), toAta, toPubkey, mintPubkey
    ));
  }

  estimateTx.add(createTransferInstruction(senderAta, toAta, senderPubkey, amountSmallest));

  // 3. Estimate fee
  const estimateBase64 = estimateTx.serialize({ requireAllSignatures: false }).toString('base64');
  console.log('\n--- estimateTransactionFee ---');
  const feeEstimate = await koraRpc('estimateTransactionFee', {
    transaction: estimateBase64,
    fee_token: paymentToken,
  });
  console.log('Fee estimate:', JSON.stringify(feeEstimate));

  const paymentAmount = feeEstimate.fee_in_token;
  const paymentAddr = feeEstimate.payment_address || paymentAddress;
  console.log('Payment amount:', paymentAmount, 'Payment addr:', paymentAddr);

  // 4. Build final tx with payment instruction
  const finalTx = new Transaction();
  const { blockhash: bh2 } = await koraRpc('getBlockhash', {});
  finalTx.recentBlockhash = bh2;
  finalTx.feePayer = new PublicKey(feePayerAddress);

  if (!toAtaInfo) {
    finalTx.add(createAssociatedTokenAccountInstruction(
      new PublicKey(feePayerAddress), toAta, toPubkey, mintPubkey
    ));
  }
  finalTx.add(createTransferInstruction(senderAta, toAta, senderPubkey, amountSmallest));

  // Payment instruction: user pays Kora in USDC
  if (paymentAmount > 0) {
    const paymentMintPubkey = new PublicKey(paymentToken);
    const koraPaymentAta = await getAssociatedTokenAddress(paymentMintPubkey, new PublicKey(paymentAddr));
    const userPaymentAta = await getAssociatedTokenAddress(paymentMintPubkey, senderPubkey);

    // Create Kora's ATA if needed
    const koraAtaInfo = await connection.getAccountInfo(koraPaymentAta);
    if (!koraAtaInfo) {
      console.log('Creating Kora payment ATA...');
      finalTx.add(createAssociatedTokenAccountInstruction(
        new PublicKey(feePayerAddress), koraPaymentAta, new PublicKey(paymentAddr), paymentMintPubkey
      ));
    }

    console.log('Adding payment ix:', paymentAmount, 'from', userPaymentAta.toBase58(), 'to', koraPaymentAta.toBase58());
    finalTx.add(createTransferInstruction(userPaymentAta, koraPaymentAta, senderPubkey, paymentAmount));
  }

  console.log('\nFinal tx instructions:', finalTx.instructions.length);
  console.log('Fee payer:', finalTx.feePayer.toBase58());

  // 5. User partial sign
  finalTx.partialSign(keypair);
  console.log('User signed. Signatures:', finalTx.signatures.length);

  // 6. signTransaction with Kora
  const finalBase64 = finalTx.serialize({ requireAllSignatures: false }).toString('base64');
  console.log('\n--- signTransaction ---');
  const signResult = await koraRpc('signTransaction', { transaction: finalBase64 });
  console.log('Sign result keys:', Object.keys(signResult));
  console.log('signed_transaction length:', signResult.signed_transaction?.length);
  console.log('signature:', signResult.signature);
  console.log('signer_pubkey:', signResult.signer_pubkey);

  if (!signResult.signed_transaction) {
    throw new Error('No signed_transaction in result');
  }

  // 7. Send to Solana
  const signedBytes = Buffer.from(signResult.signed_transaction, 'base64');
  console.log('\n--- sendRawTransaction ---');
  console.log('Signed tx bytes length:', signedBytes.length);

  // Check if Heaqg signature is present
  const tx = Transaction.from(signedBytes);
  console.log('Parsed tx signatures:', tx.signatures.length);
  for (const sig of tx.signatures) {
    const hasSig = sig.signature !== null;
    console.log('  Signer:', sig.publicKey.toBase58(), 'hasSig:', hasSig);
  }

  const signature = await connection.sendRawTransaction(signedBytes, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });
  console.log('Signature:', signature);
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
