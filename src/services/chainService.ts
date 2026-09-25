import { mnemonicToAccount } from 'viem/accounts';
import { http, createPublicClient, formatEther, formatUnits } from 'viem';

export type ChainId = 'solana' | 'ethereum' | 'monad' | 'polygon' | 'base' | 'arc';

export interface ChainConfig {
  id: ChainId;
  name: string;
  symbol: string;
  shortName: string;
  logo: string;
  derivationIndex: number;
  rpcUrl: string;
  rpcUrls: string[];
  explorerUrl: string;
  decimals: number;
  isEvm: boolean;
  nativeCurrency: { name: string; symbol: string; decimals: number };
}

export const CHAINS: Record<ChainId, ChainConfig> = {
  solana: {
    id: 'solana',
    name: 'Solana',
    symbol: 'SOL',
    shortName: 'SOL',
    logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    derivationIndex: 0,
    rpcUrl: '',
    rpcUrls: [],
    explorerUrl: 'https://solscan.io',
    decimals: 9,
    isEvm: false,
    nativeCurrency: { name: 'Solana', symbol: 'SOL', decimals: 9 },
  },
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    symbol: 'ETH',
    shortName: 'ETH',
    logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    derivationIndex: 0,
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/alch_cwScl8Y8G9o5IgE0nfwS2',
    rpcUrls: [
      'https://eth-mainnet.g.alchemy.com/v2/alch_cwScl8Y8G9o5IgE0nfwS2',
      'https://ethereum.publicnode.com',
      'https://rpc.ankr.com/eth',
    ],
    explorerUrl: 'https://etherscan.io',
    decimals: 18,
    isEvm: true,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon',
    symbol: 'POL',
    shortName: 'POL',
    logo: 'https://assets.coingecko.com/coins/images/4713/small/polygon.png',
    derivationIndex: 0,
    rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/alch_cwScl8Y8G9o5IgE0nfwS2',
    rpcUrls: [
      'https://polygon-mainnet.g.alchemy.com/v2/alch_cwScl8Y8G9o5IgE0nfwS2',
      'https://polygon-rpc.com',
      'https://polygon.publicnode.com',
    ],
    explorerUrl: 'https://polygonscan.com',
    decimals: 18,
    isEvm: true,
    nativeCurrency: { name: 'Polygon', symbol: 'POL', decimals: 18 },
  },
  monad: {
    id: 'monad',
    name: 'Monad',
    symbol: 'MON',
    shortName: 'MON',
    logo: 'https://coin-images.coingecko.com/coins/images/38927/large/mon.png',
    derivationIndex: 1,
    rpcUrl: 'https://testnet-rpc.monad.xyz',
    rpcUrls: ['https://testnet-rpc.monad.xyz'],
    explorerUrl: 'https://monadvision.com',
    decimals: 18,
    isEvm: true,
    nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  },
  base: {
    id: 'base',
    name: 'Base',
    symbol: 'ETH',
    shortName: 'ETH',
    logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png',
    derivationIndex: 0,
    rpcUrl: 'https://base-mainnet.g.alchemy.com/v2/alch_cwScl8Y8G9o5IgE0nfwS2',
    rpcUrls: [
      'https://base-mainnet.g.alchemy.com/v2/alch_cwScl8Y8G9o5IgE0nfwS2',
      'https://mainnet.base.org',
      'https://base.publicnode.com',
    ],
    explorerUrl: 'https://basescan.org',
    decimals: 18,
    isEvm: true,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  arc: {
    id: 'arc',
    name: 'Arc',
    symbol: 'USDC',
    shortName: 'USDC',
    logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    derivationIndex: 0,
    rpcUrl: 'https://rpc.mainnet.arc.io',
    rpcUrls: [
      'https://rpc.mainnet.arc.io',
    ],
    explorerUrl: 'https://explorer.arc.io',
    decimals: 6,
    isEvm: true,
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  },
};

export const EVM_CHAINS: ChainConfig[] = [CHAINS.ethereum, CHAINS.base, CHAINS.polygon, CHAINS.arc, CHAINS.monad];

export interface EvmWallet {
  address: `0x${string}`;
  chainId: ChainId;
}

const evmClients: Record<string, ReturnType<typeof createPublicClient>> = {};

function getEvmClient(chain: ChainConfig) {
  if (!evmClients[chain.id]) {
    evmClients[chain.id] = createPublicClient({
      transport: http(chain.rpcUrl, { timeout: 10000 }),
    });
  }
  return evmClients[chain.id];
}

function getEvmClientForUrl(url: string) {
  return createPublicClient({
    transport: http(url, { timeout: 10000 }),
  });
}

export function deriveEvmAccount(mnemonic: string, index: number): `0x${string}` {
  const account = mnemonicToAccount(mnemonic, {
    path: `m/44'/60'/${index}'/0/0`,
  });
  return account.address;
}

export function deriveEvmPrivateKey(mnemonic: string, index: number): `0x${string}` {
  const account = mnemonicToAccount(mnemonic, {
    path: `m/44'/60'/${index}'/0/0`,
  });
  // @ts-ignore - getHdKey exists at runtime on the LocalAccount
  const privateKeyMap = account.getHdKey().privateKey;
  if (!privateKeyMap) throw new Error("Could not derive private key");
  return `0x${Buffer.from(privateKeyMap).toString('hex')}`;
}

export async function getEvmBalance(
  address: `0x${string}`,
  chain: ChainConfig
): Promise<number> {
  const urls = chain.rpcUrls.length > 0 ? chain.rpcUrls : [chain.rpcUrl];
  for (let i = 0; i < urls.length; i++) {
    try {
      const client = getEvmClientForUrl(urls[i]);
      const balance = await client.getBalance({ address });
      return parseFloat(formatUnits(balance, chain.decimals));
    } catch (error) {
      if (i === urls.length - 1) {
        console.error(`[ChainService] Failed to fetch ${chain.name} balance:`, error);
        return 0;
      }
    }
  }
  return 0;
}

export async function getEvmTransactions(
  address: `0x${string}`,
  chain: ChainConfig,
  limit: number = 10
): Promise<any[]> {
  try {
    const client = getEvmClient(chain);
    const blockNumber = await client.getBlockNumber();
    const txs: any[] = [];

    let scanned = 0;
    for (let i = Number(blockNumber); i > 0 && txs.length < limit; i--) {
      const block = await client.getBlock({ blockNumber: BigInt(i), includeTransactions: true });
      for (const tx of block.transactions) {
        if (typeof tx === 'object') {
          if (
            (tx.from as string).toLowerCase() === address.toLowerCase() ||
            (tx.to as string)?.toLowerCase() === address.toLowerCase()
          ) {
            txs.push({
              hash: tx.hash,
              from: tx.from,
              to: tx.to,
              value: formatEther(tx.value),
              blockNumber: Number(tx.blockNumber),
              timestamp: Number(block.timestamp),
              chainId: chain.id,
            });
            if (txs.length >= limit) break;
          }
        }
      }
      scanned++;
      if (scanned > 100) break;
    }

    return txs;
  } catch (error) {
    console.error(`[ChainService] Failed to fetch ${chain.name} txs:`, error);
    return [];
  }
}
