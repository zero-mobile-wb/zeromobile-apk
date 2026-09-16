import { Buffer } from 'buffer';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_DEVNET_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const TRIBUTARY_GATEWAY = 'CwNybLVQ3sVmcZ3Q1veS6x99gUZcAF2duNDe3qbcEMGr';
const CHECKOUT_BASE = 'https://checkout.tributary.so';
const USDC_DECIMALS = 6;
const INVOICE_HISTORY_KEY = 'zero_invoice_history';

export type PaymentMode = 'payment' | 'subscription';
export type PaymentFrequency = 'daily' | 'weekly' | 'monthly' | 'annually' | 'custom';

export interface InvoiceParams {
  amount: number;
  description: string;
  mode: PaymentMode;
  frequency?: PaymentFrequency;
  customDays?: number;
  autoRenew?: boolean;
  recipientAddress: string;
  trackingId?: string;
  network?: 'mainnet-beta' | 'devnet';
}

export interface InvoiceResult {
  url: string;
  trackingId: string;
  mode: PaymentMode;
}

export interface InvoiceHistoryItem {
  trackingId: string;
  url: string;
  amount: number;
  description: string;
  mode: PaymentMode;
  frequency?: string;
  createdAt: number;
  userEmail?: string;
}

function toBase64Url(obj: object): string {
  const json = JSON.stringify(obj);
  const base64 = Buffer.from(json, 'utf-8').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function generateTrackingId(): string {
  return `trib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function frequencyToSdk(freq: PaymentFrequency, customDays?: number): string {
  if (freq === 'custom' && customDays) {
    if (customDays <= 1) return 'daily';
    if (customDays <= 7) return 'weekly';
    if (customDays <= 30) return 'monthly';
    return 'annually';
  }
  return freq === 'custom' ? 'monthly' : freq;
}

export const InvoiceService = {
  createInvoiceUrl(params: InvoiceParams): InvoiceResult {
    const trackingId = params.trackingId || generateTrackingId();
    const tokenMint = params.network === 'devnet' ? USDC_DEVNET_MINT : USDC_MINT;
    const amountRaw = Math.round(params.amount * Math.pow(10, USDC_DECIMALS));
    const sdkFrequency = frequencyToSdk(params.frequency || 'monthly', params.customDays);

    if (params.mode === 'subscription') {
      const data: Record<string, any> = {
        m: 'subscription',
        tm: tokenMint,
        r: params.recipientAddress,
        a: amountRaw,
        tid: trackingId,
        su: 'null',
        cu: 'null',
        g: TRIBUTARY_GATEWAY,
        ar: params.autoRenew ?? true,
        mr: 'null',
        pf: sdkFrequency,
        st: 'null',
        li: JSON.stringify([{ description: params.description, unitPrice: params.amount, quantity: 1 }]),
      };
      const encoded = toBase64Url(data);
      return { url: `${CHECKOUT_BASE}/#/subscribe/${encoded}`, trackingId, mode: 'subscription' };
    }

    const data: Record<string, any> = {
      m: 'payment',
      tm: tokenMint,
      r: params.recipientAddress,
      a: amountRaw,
      tid: trackingId,
      su: 'null',
      cu: 'null',
      li: JSON.stringify([{ description: params.description, unitPrice: params.amount, quantity: 1 }]),
    };
    const encoded = toBase64Url(data);
    return { url: `${CHECKOUT_BASE}/#/pay/${encoded}`, trackingId, mode: 'payment' };
  },

  async saveToHistory(item: InvoiceHistoryItem): Promise<void> {
    const raw = await AsyncStorage.getItem(INVOICE_HISTORY_KEY);
    const history: InvoiceHistoryItem[] = raw ? JSON.parse(raw) : [];
    history.unshift(item);
    await AsyncStorage.setItem(INVOICE_HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
  },

  async getHistory(): Promise<InvoiceHistoryItem[]> {
    const raw = await AsyncStorage.getItem(INVOICE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  },

  async getHistoryForUser(email: string): Promise<InvoiceHistoryItem[]> {
    const all = await this.getHistory();
    // Return items that either belong to this user or have no userEmail (legacy)
    return all.filter((item) => !item.userEmail || item.userEmail === email);
  },
};
