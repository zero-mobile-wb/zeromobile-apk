import { createPublicClient, createWalletClient, http, encodeFunctionData, parseUnits, formatUnits, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { TransactionResult } from './transactionService';

const ERC20_ABI = [
    {
        type: 'function',
        name: 'transfer',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }],
        outputs: [{ name: '', type: 'bool' }],
    },
    {
        type: 'function',
        name: 'balanceOf',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        type: 'function',
        name: 'decimals',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint8' }],
    },
] as const;

export type EvmSender =
    | { type: 'keypair'; privateKey: `0x${string}` }
    | { type: 'privy'; provider: any; address: `0x${string}` };

function publicClientFor(rpcUrls: string[], evmChainId: number) {
    return createPublicClient({
        transport: http(rpcUrls[0], { timeout: 15000 }),
    });
}

/** ERC-20 balance (human units) with RPC fallback. */
export async function getErc20Balance(
    rpcUrls: string[],
    token: `0x${string}`,
    owner: `0x${string}`,
    decimals: number
): Promise<number | null> {
    for (const url of rpcUrls) {
        try {
            const client = createPublicClient({ transport: http(url, { timeout: 10000 }) });
            const raw = await client.readContract({
                address: token,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [owner],
            });
            return Number(formatUnits(raw as bigint, decimals));
        } catch {
            continue;
        }
    }
    return null;
}

/** Native gas balance (human units) with RPC fallback. */
export async function getEvmGasBalance(rpcUrls: string[], owner: `0x${string}`): Promise<number | null> {
    for (const url of rpcUrls) {
        try {
            const client = createPublicClient({ transport: http(url, { timeout: 10000 }) });
            const raw = await client.getBalance({ address: owner });
            return Number(formatUnits(raw, 18));
        } catch {
            continue;
        }
    }
    return null;
}

/**
 * Native token balance with configurable decimals.
 * Use this for Arc where USDC is native (6 decimals) instead of 18-decimal ETH.
 */
export async function getNativeBalance(
    rpcUrls: string[],
    owner: `0x${string}`,
    decimals = 18
): Promise<number | null> {
    for (const url of rpcUrls) {
        try {
            const client = createPublicClient({ transport: http(url, { timeout: 10000 }) });
            const raw = await client.getBalance({ address: owner });
            return Number(formatUnits(raw, decimals));
        } catch {
            continue;
        }
    }
    return null;
}

export function isValidEvmAddress(address: string): boolean {
    return /^0x[0-9a-fA-F]{40}$/.test(address || '');
}

export interface EvmTransferParams {
    rpcUrls: string[];
    evmChainId: number;
    token: `0x${string}`;
    decimals: number;
    amount: number;
    to: `0x${string}`;
    sender: EvmSender;
}

/** Send an ERC-20 token on any EVM chain. */
export async function sendEvmToken(params: EvmTransferParams): Promise<TransactionResult> {
    const { rpcUrls, evmChainId, token, decimals, amount, to, sender } = params;
    try {
        if (!isValidEvmAddress(to)) return { success: false, error: 'Invalid recipient address' };
        if (!isValidEvmAddress(token)) return { success: false, error: 'Invalid token address' };
        if (!(amount > 0)) return { success: false, error: 'Amount must be greater than 0' };

        const value = parseUnits(String(amount), decimals);
        const data = encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [to, value],
        });

        if (sender.type === 'keypair') {
            const account = privateKeyToAccount(sender.privateKey);
            let lastError: any = null;
            for (const url of rpcUrls) {
                try {
                    const walletClient = createWalletClient({
                        account,
                        transport: http(url, { timeout: 15000 }),
                    });
                    const hash = await walletClient.writeContract({
                        address: token,
                        abi: ERC20_ABI,
                        functionName: 'transfer',
                        args: [to, value],
                        chain: undefined,
                    } as any);
                    const receipt = await publicClientFor(rpcUrls, evmChainId).waitForTransactionReceipt({ hash });
                    if (receipt.status === 'reverted') {
                        return { success: false, error: 'Transaction reverted on-chain' };
                    }
                    return { success: true, signature: hash };
                } catch (e: any) {
                    lastError = e;
                    continue;
                }
            }
            return { success: false, error: lastError?.message || 'EVM transfer failed on all RPCs' };
        }

        // Privy embedded wallet — EIP-1193 style send.
        const provider = sender.provider;
        const tx = { from: sender.address, to: token, data };
        if (typeof provider?.request === 'function') {
            const hash = await provider.request({ method: 'eth_sendTransaction', params: [tx] });
            return { success: true, signature: typeof hash === 'string' ? hash : hash?.hash };
        }
        if (typeof provider?.sendTransaction === 'function') {
            const res = await provider.sendTransaction(tx);
            const hash = typeof res === 'string' ? res : res?.hash || res?.signature;
            return { success: true, signature: hash };
        }
        return { success: false, error: 'Wallet does not support EVM sends' };
    } catch (e: any) {
        return { success: false, error: e?.message || 'EVM transfer failed' };
    }
}

/**
 * Send the native token on chains like Arc where USDC is the native gas asset.
 * Uses a plain value-transfer instead of an ERC-20 call.
 */
export async function sendNativeToken(params: Omit<EvmTransferParams, 'token'>): Promise<TransactionResult> {
    const { rpcUrls, evmChainId, decimals, amount, to, sender } = params;
    try {
        if (!isValidEvmAddress(to)) return { success: false, error: 'Invalid recipient address' };
        if (!(amount > 0)) return { success: false, error: 'Amount must be greater than 0' };

        const value = parseUnits(String(amount), decimals);

        if (sender.type === 'keypair') {
            const account = privateKeyToAccount(sender.privateKey);
            let lastError: any = null;
            for (const url of rpcUrls) {
                try {
                    const walletClient = createWalletClient({
                        account,
                        transport: http(url, { timeout: 15000 }),
                    });
                    const hash = await walletClient.sendTransaction({
                        to: to as `0x${string}`,
                        value,
                        chain: undefined,
                    } as any);
                    const pubClient = createPublicClient({ transport: http(url, { timeout: 15000 }) });
                    const receipt = await pubClient.waitForTransactionReceipt({ hash });
                    if (receipt.status === 'reverted') {
                        return { success: false, error: 'Transaction reverted on-chain' };
                    }
                    return { success: true, signature: hash };
                } catch (e: any) {
                    lastError = e;
                    continue;
                }
            }
            return { success: false, error: lastError?.message || 'Native transfer failed on all RPCs' };
        }

        // Privy embedded wallet — EIP-1193 style send.
        const provider = sender.provider;
        const tx = { from: sender.address, to, value: `0x${value.toString(16)}` };
        if (typeof provider?.request === 'function') {
            const hash = await provider.request({ method: 'eth_sendTransaction', params: [tx] });
            return { success: true, signature: typeof hash === 'string' ? hash : hash?.hash };
        }
        if (typeof provider?.sendTransaction === 'function') {
            const res = await provider.sendTransaction(tx);
            const hash = typeof res === 'string' ? res : res?.hash || res?.signature;
            return { success: true, signature: hash };
        }
        return { success: false, error: 'Wallet does not support native sends' };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Native transfer failed' };
    }
}
