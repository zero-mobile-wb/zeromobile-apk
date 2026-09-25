import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import bs58 from 'bs58';

const KORA_RPC = 'http://127.0.0.1:8080';
const SOLANA_RPC = 'https://mainnet.helius-rpc.com/?api-key=f9a619f4-308f-41a8-935f-43d89b0d3c3e';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SENDER_KEY = '2fJgwEUagqojMMVYrDZZu5FSFc3g6JUkt7P97S7yT6vYMXTxxKQtmuifmE4Ukcx3s8TB3cFsJGCwgDtoz6myyDU6';
const TO_ADDRESS = '4fyAgodVUDWtSXfW7UK8XLS4XjJvQ77QrysppSPcFZPn';

async function koraRpc(method, params) {
  const res = await fetch(KORA_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true', 'Accept': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  const text = await res.text();
  const data = JSON.parse(text);
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.result;
}

async function main() {
  const connection = new Connection(SOLANA_RPC, 'confirmed');
  const keypair = Keypair.fromSecretKey(bs58.decode(SENDER_KEY));
  const senderPubkey = keypair.publicKey;
  const mintPubkey = new PublicKey(USDC_MINT);
  const toPubkey = new PublicKey(TO_ADDRESS);
  const amountSmallest = 100000; // 0.10 USDC

  console.log('Sender:', senderPubkey.toBase58());

  // Check USDC balance
  const senderAta = await getAssociatedTokenAddress(mintPubkey, senderPubkey);
  const ataInfo = await connection.getTokenAccountBalance(senderAta);
  console.log('USDC balance:', ataInfo.value.uiAmount, '(', ataInfo.value.amount, ')');

  const { signer_address } = await koraRpc('getPayerSigner', {});
  const feePayerPubkey = new PublicKey(signer_address);

  // Build estimate tx (same as app does)
  const { blockhash } = await koraRpc('getBlockhash', {});
  const estimateTx = new Transaction();
  estimateTx.recentBlockhash = blockhash;
  estimateTx.feePayer = feePayerPubkey;

  const toAta = await getAssociatedTokenAddress(mintPubkey, toPubkey);
  const toAtaInfo = await connection.getAccountInfo(toAta);
  if (!toAtaInfo) {
    estimateTx.add(createAssociatedTokenAccountInstruction(feePayerPubkey, toAta, toPubkey, mintPubkey));
  }
  estimateTx.add(createTransferInstruction(senderAta, toAta, senderPubkey, amountSmallest));

  // Step 1: estimate fee
  const estBase64 = estimateTx.serialize({ requireAllSignatures: false }).toString('base64');
  const feeEst = await koraRpc('estimateTransactionFee', {
    transaction: estBase64,
    fee_token: USDC_MINT,
  });
  console.log('\nFee estimate:', JSON.stringify(feeEst));
  const paymentAmount = feeEst.fee_in_token;
  const paymentAddr = feeEst.payment_address;

  // Step 2: Build final tx with payment
  const { blockhash: bh2 } = await koraRpc('getBlockhash', {});
  const finalTx = new Transaction();
  finalTx.recentBlockhash = bh2;
  finalTx.feePayer = feePayerPubkey;

  if (!toAtaInfo) {
    finalTx.add(createAssociatedTokenAccountInstruction(feePayerPubkey, toAta, toPubkey, mintPubkey));
  }
  finalTx.add(createTransferInstruction(senderAta, toAta, senderPubkey, amountSmallest));

  // Payment: user pays Kora USDC
  const paymentMintPubkey = new PublicKey(USDC_MINT);
  const koraPaymentAta = await getAssociatedTokenAddress(paymentMintPubkey, new PublicKey(paymentAddr));
  const userPaymentAta = await getAssociatedTokenAddress(paymentMintPubkey, senderPubkey);

  const koraAtaInfo = await connection.getAccountInfo(koraPaymentAta);
  if (!koraAtaInfo) {
    finalTx.add(createAssociatedTokenAccountInstruction(feePayerPubkey, koraPaymentAta, new PublicKey(paymentAddr), paymentMintPubkey));
  }
  finalTx.add(createTransferInstruction(userPaymentAta, koraPaymentAta, senderPubkey, paymentAmount));

  console.log('\nFinal tx instructions:', finalTx.instructions.length);

  // Step 3: User signs
  finalTx.partialSign(keypair);
  console.log('User signed');

  // Step 4: signTransaction
  const finalBase64 = finalTx.serialize({ requireAllSignatures: false }).toString('base64');
  console.log('\nCalling signTransaction...');
  try {
    const signResult = await koraRpc('signTransaction', { transaction: finalBase64 });
    console.log('signTransaction SUCCESS');
    console.log('  signature:', signResult.signature);
    console.log('  signer:', signResult.signer_pubkey);
    console.log('  signed_tx length:', signResult.signed_transaction?.length);

    // Step 5: send
    const signedBytes = Buffer.from(signResult.signed_transaction, 'base64');
    const parsed = Transaction.from(signedBytes);
    console.log('\nParsed signatures:', parsed.signatures.length);
    for (const s of parsed.signatures) {
      console.log('  ', s.publicKey.toBase58().slice(0, 8) + '...', 'hasSig:', s.signature !== null);
    }

    const sig = await connection.sendRawTransaction(signedBytes, { skipPreflight: false });
    console.log('\nSent! Signature:', sig);
  } catch (e) {
    console.log('signTransaction FAILED:', e.message);

    // Try signAndSendTransaction as fallback
    console.log('\nTrying signAndSendTransaction...');
    try {
      const result = await koraRpc('signAndSendTransaction', { transaction: finalBase64 });
      console.log('signAndSendTransaction SUCCESS:', result.signature);
    } catch (e2) {
      console.log('signAndSendTransaction FAILED:', e2.message);
    }
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
