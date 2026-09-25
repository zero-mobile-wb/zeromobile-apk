import { Connection, PublicKey, Transaction, Keypair, SystemProgram } from '@solana/web3.js';
import bs58 from 'bs58';

const KORA_RPC = 'https://precontinental-uninfected-monty.ngrok-free.dev';
const SOLANA_RPC = 'https://mainnet.helius-rpc.com/?api-key=f9a619f4-308f-41a8-935f-43d89b0d3c3e';
const SENDER_KEY = '2fJgwEUagqojMMVYrDZZu5FSFc3g6JUkt7P97S7yT6vYMXTxxKQtmuifmE4Ukcx3s8TB3cFsJGCwgDtoz6myyDU6';

async function koraRpc(method, params) {
  const res = await fetch(KORA_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  const data = JSON.parse(await res.text());
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.result;
}

async function main() {
  const connection = new Connection(SOLANA_RPC, 'confirmed');
  const keypair = Keypair.fromSecretKey(bs58.decode(SENDER_KEY));

  // Simplest possible tx: SOL transfer from user to itself, Kora as fee payer
  const { signer_address } = await koraRpc('getPayerSigner', {});
  const { blockhash } = await koraRpc('getBlockhash', {});

  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.feePayer = new PublicKey(signer_address);
  tx.add(SystemProgram.transfer({
    fromPubkey: keypair.publicKey,
    toPubkey: keypair.publicKey,
    lamports: 1,
  }));
  tx.partialSign(keypair);

  const base64 = tx.serialize({ requireAllSignatures: false }).toString('base64');

  // Try signTransaction
  console.log('--- signTransaction ---');
  try {
    const result = await koraRpc('signTransaction', { transaction: base64 });
    console.log('signTransaction OK:', result.signature);
  } catch (e) {
    console.log('signTransaction FAILED:', e.message);
  }

  // Try signAndSendTransaction
  console.log('--- signAndSendTransaction ---');
  try {
    const result = await koraRpc('signAndSendTransaction', { transaction: base64 });
    console.log('signAndSendTransaction OK:', result.signature);
  } catch (e) {
    console.log('signAndSendTransaction FAILED:', e.message);
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
