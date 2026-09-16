import Constants from 'expo-constants';

const API_BASE = 'https://api.delora.build/v1';
const API_KEY = Constants.expoConfig?.extra?.deloraApiKey as string || '';

const headers: Record<string, string> = {
  'Content-Type': 'application/json',
};
if (API_KEY) headers['x-api-key'] = API_KEY;

export interface DeloraChain {
  key: string;
  name: string;
  chainType: 'EVM' | 'SVM';
  id: number;
  logoURI?: string;
  nativeToken: {
    address: string;
    symbol: string;
    decimals: number;
    name: string;
    logoURI?: string;
  };
}

export interface DeloraToken {
  address: string;
  symbol: string;
  decimals: number;
  chainId: number;
  name: string;
  coinKey: string;
  priceUSD?: string;
  logoURI?: string;
}

export interface DeloraQuote {
  inputAmount: string;
  outputAmount: string;
  minOutputAmount: string;
  adapter: string;
  calldata: {
    to: string;
    value: string;
    data: string;
  };
  fees: {
    total: { amount: string; currencySymbol: string; decimals: number };
    totalUsd: string;
  };
  warnings?: { code: string; message: string }[];
}

const SOLANA_CHAIN_ID = 1000000001;

export async function getChains(chainTypes?: 'evm' | 'svm'): Promise<DeloraChain[]> {
  const params = chainTypes ? `?chainTypes=${chainTypes}` : '';
  const res = await fetch(`${API_BASE}/chains${params}`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch chains: ${res.status}`);
  const data = await res.json();
  return data.chains;
}

export async function getTokens(chainIds: number[]): Promise<Record<string, DeloraToken[]>> {
  const params = `?chains=${chainIds.join(',')}`;
  const res = await fetch(`${API_BASE}/tokens${params}`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch tokens: ${res.status}`);
  return res.json();
}

export interface DeloraQuoteParams {
  originChainId: number;
  destinationChainId: number;
  amount: string;
  originCurrency: string;
  destinationCurrency: string;
  senderAddress: string;
  receiverAddress?: string;
  slippage?: number;
  integrator?: string;
  fee?: number;
}

export async function getQuote(params: DeloraQuoteParams): Promise<DeloraQuote> {
  const query = new URLSearchParams();
  query.append('originChainId', params.originChainId.toString());
  query.append('destinationChainId', params.destinationChainId.toString());
  query.append('amount', params.amount);
  query.append('originCurrency', params.originCurrency);
  query.append('destinationCurrency', params.destinationCurrency);
  query.append('senderAddress', params.senderAddress);
  if (params.receiverAddress) query.append('receiverAddress', params.receiverAddress);
  if (params.slippage !== undefined) query.append('slippage', params.slippage.toString());
  if (params.integrator) query.append('integrator', params.integrator);
  if (params.fee !== undefined) query.append('fee', params.fee.toString());

  const res = await fetch(`${API_BASE}/quotes?${query.toString()}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || `Quote failed: ${res.status}`);
  }
  return res.json();
}

export { SOLANA_CHAIN_ID };
