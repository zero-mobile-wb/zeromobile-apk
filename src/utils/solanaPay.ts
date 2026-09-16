export interface SolanaPayParams {
  recipient: string;
  amount: number;
  splToken: string;
  reference: string;
  label?: string;
  message?: string;
}

const KNOWN_TOKENS = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC mainnet
  '4zMMC9srt5Ri5X14YGWA8x9Ww7C1L1iKVp1PZov2D34x', // USDC devnet
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT mainnet
]);

export function parseSolanaPayUrl(url: string): SolanaPayParams | null {
  if (!url.startsWith('solana:')) return null;

  const withoutScheme = url.slice('solana:'.length);
  const qIndex = withoutScheme.indexOf('?');
  if (qIndex === -1) return null;

  const recipient = withoutScheme.slice(0, qIndex);
  if (!recipient || recipient.length < 32) return null;

  const qs = withoutScheme.slice(qIndex + 1);
  const params = new URLSearchParams(qs);

  const amountStr = params.get('amount');
  const splToken = params.get('spl-token');
  const reference = params.get('reference');
  const label = params.get('label') || undefined;
  const message = params.get('message') || undefined;

  if (!amountStr || !splToken || !reference) return null;

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) return null;

  if (!KNOWN_TOKENS.has(splToken)) return null;

  if (reference.length < 32) return null;

  return { recipient, amount, splToken, reference, label, message };
}
