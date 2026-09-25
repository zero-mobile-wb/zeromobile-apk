import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import bs58 from 'bs58';

// Use ngrok like the app does
const KORA_RPC = 'https://precontinental-uninfected-monty.ngrok-free.dev';
const SOLANA_RPC = 'https://mainnet.helius-rpc.com/?api-key=f9a619f4-308f-41a8-935f-43d89b0d3c3e';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SENDER_KEY = '2fJgwEUagqojMMVYrDZZu5FSFc3g6JUkt7P97S7yT6vYMXTxxKQtmuifmE4Ukcx3s8TB3cFsJGCwgDtoz6myyDU6';
const TO_ADDRESS = '4fyAgodVUDWtSXfW7UK8XLS4XjJvQ77QrysppSPcFZPn';

async function koraRpc(method, params) {
  const res = await fetch(KORA_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  const text = await res.text();
  if (!text) throw new Error('Empty response');
  try {
    const data = JSON.parse(text);
    if (data.error) throw new Error(JSON.stringify(data.error));
    return data.result;
  } catch (e) {
    if (e.message.includes('JSON')) throw new Error('Non-JSON response (ngrok blocking?): ' + text.slice(0, 100));
    throw e;
  }
}

async function main() {
  const connection = new Connection(SOLANA_RPC, 'confirmed');
  const keypair = Keypair.fromSecretKey(bs58.decode(SENDER_KEY));
  const senderPubkey = keypair.publicKey;
  const mintPubkey = new PublicKey(USDC_MINT);
  const toPubkey = new PublicKey(TO_ADDRESS);
  const amountSmallest = 100000;

  console.log('Sender:', senderPubkey.toBase58());

  const senderAta = await getAssociatedTokenAddress(mintPubkey, senderPubkey);
  const bal = await connection.getTokenAccountBalance(senderAta);
  console.log('USDC balance:', bal.value.uiAmount);

  const [payerResult, configResult] = await Promise.all([
    koraRpc('getPayerSigner', {}),
    koraRpc('getConfig', {}),
  ]);
  const feePayerAddress = payerResult.signer_address;
  const feePayerPubkey = new PublicKey(feePayerAddress);
  const paymentAddress = payerResult.payment_address || feePayerAddress;
  const paymentToken = configResult.validation_config?.allowed_spl_paid_tokens?.[0] || USDC_MINT;

  // Build estimate tx
  const { blockhash } = await koraRpc('getBlockhash', {});
  const estimateTx = new Transaction();
  estimateTx.recentBlockhash = blockhash;
  estimateTx.feePayer = feePayerPubkey;

  const toAta = await getAssociatedTokenAddress(mintPubkey, toPubkey);
  const toAtaInfo = await connection.getAccountInfo(toAta);
  if (!toAtaInfo) estimateTx.add(createAssociatedTokenAccountInstruction(feePayerPubkey, toAta, toPubkey, mintPubkey));
  estimateTx.add(createTransferInstruction(senderAta, toAta, senderPubkey, amountSmallest));

  const estBase64 = estimateTx.serialize({ requireAllSignatures: false }).toString('base64');
  const feeEst = await koraRpc('estimateTransactionFee', { transaction: estBase64, fee_token: paymentToken });
  console.log('Fee:', feeEst.fee_in_token);

  // Build final tx
  const { blockhash: bh2 } = await koraRpc('getBlockhash', {});
  const finalTx = new Transaction();
  finalTx.recentBlockhash = bh2;
  finalTx.feePayer = feePayerPubkey;

  if (!toAtaInfo) finalTx.add(createAssociatedTokenAccountInstruction(feePayerPubkey, toAta, toPubkey, mintPubkey));
  finalTx.add(createTransferInstruction(senderAta, toAta, senderPubkey, amountSmallest));

  // Payment
  const paymentAmount = feeEst.fee_in_token;
  if (paymentAmount > 0) {
    const paymentMint = new PublicKey(paymentToken);
    const koraPayAta = await getAssociatedTokenAddress(paymentMint, new PublicKey(feeEst.payment_address));
    const userPayAta = await getAssociatedTokenAddress(paymentMint, senderPubkey);
    const koraAtaInfo = await connection.getAccountInfo(koraPayAta);
    if (!koraAtaInfo) finalTx.add(createAssociatedTokenAccountInstruction(feePayerPubkey, koraPayAta, new PublicKey(feeEst.payment_address), paymentMint));
    finalTx.add(createTransferInstruction(userPayAta, koraPayAta, senderPubkey, paymentAmount));
  }

  finalTx.partialSign(keypair);

  // signTransaction via ngrok
  const finalBase64 = finalTx.serialize({ requireAllSignatures: false }).toString('base64');
  console.log('Calling signTransaction via ngrok...');
  const signResult = await koraRpc('signTransaction', { transaction: finalBase64 });
  console.log('Signed tx length:', signResult.signed_transaction?.length);
  console.log('Signer:', signResult.signer_pubkey);

  // Verify signatures
  const { Buffer } = await import('buffer');
  const signedBytes = Buffer.from(signResult.signed_transaction, 'base64');
  const parsed = Transaction.from(signedBytes);
  console.log('Signatures:', parsed.signatures.length);
  for (const s of parsed.signatures) {
    console.log('  ', s.publicKey.toBase58().slice(0, 8) + '...', 'signed:', s.signature !== null);
  }

  const sig = await connection.sendRawTransaction(signedBytes, { skipPreflight: false });
  console.log('SENT! Signature:', sig);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
