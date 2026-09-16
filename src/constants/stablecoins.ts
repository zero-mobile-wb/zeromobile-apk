export interface StablecoinChain {
  id: string;
  name: string;
  logo: string;
  contractAddress: string;
  decimals: number;
  evmChainId?: number;
}

export interface Stablecoin {
  symbol: 'USDC' | 'USDT';
  name: string;
  logo: string;
  coingeckoId: string;
  chains: StablecoinChain[];
}

const USDC_LOGO =
  'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png';
const USDT_LOGO =
  'https://assets.coingecko.com/coins/images/325/small/Tether.png';

export const STABLECOINS: Stablecoin[] = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    logo: USDC_LOGO,
    coingeckoId: 'usd-coin',
    chains: [
      {
        id: 'solana',
        name: 'Solana',
        logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
        contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        decimals: 6,
      },
      {
        id: 'base',
        name: 'Base',
        logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png',
        contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        decimals: 6,
        evmChainId: 8453,
      },
      {
        id: 'bsc',
        name: 'BNB Chain',
        logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png',
        contractAddress: '0x8AC76a08595D2C9e6eF7Bb52FdA756eC9c6c771',
        decimals: 18,
        evmChainId: 56,
      },
      {
        id: 'arbitrum',
        name: 'Arbitrum',
        logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png',
        contractAddress: '0xaf88d065E77c8cC2239327C5EDb3A432268e5831',
        decimals: 6,
        evmChainId: 42161,
      },
      {
        id: 'polygon',
        name: 'Polygon',
        logo: 'https://assets.coingecko.com/coins/images/4713/small/polygon.png',
        contractAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        decimals: 6,
        evmChainId: 137,
      },
      {
        id: 'monad',
        name: 'Monad',
        logo: 'https://coin-images.coingecko.com/coins/images/38927/large/mon.png',
        contractAddress: '0x...',
        decimals: 6,
        evmChainId: 143,
      },
    ],
  },
  {
    symbol: 'USDT',
    name: 'Tether',
    logo: USDT_LOGO,
    coingeckoId: 'tether',
    chains: [
      {
        id: 'solana',
        name: 'Solana',
        logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
        contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        decimals: 6,
      },
      {
        id: 'bsc',
        name: 'BNB Chain',
        logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png',
        contractAddress: '0x55d398326f99059fF775485246999027B3197955',
        decimals: 18,
        evmChainId: 56,
      },
      {
        id: 'arbitrum',
        name: 'Arbitrum',
        logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png',
        contractAddress: '0xFd086bC7D6060cB9a4Eb1A1C1BEbc0BF5AA3142',
        decimals: 6,
        evmChainId: 42161,
      },
      {
        id: 'polygon',
        name: 'Polygon',
        logo: 'https://assets.coingecko.com/coins/images/4713/small/polygon.png',
        contractAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        decimals: 6,
        evmChainId: 137,
      },
      {
        id: 'monad',
        name: 'Monad',
        logo: 'https://coin-images.coingecko.com/coins/images/38927/large/mon.png',
        contractAddress: '0x...',
        decimals: 6,
        evmChainId: 143,
      },
    ],
  },
];

export function getStablecoin(symbol: 'USDC' | 'USDT'): Stablecoin | undefined {
  return STABLECOINS.find(s => s.symbol === symbol);
}

export const VISIBLE_CHAIN_COUNT = 3;

export function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
