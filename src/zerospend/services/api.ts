import Constants from 'expo-constants';
import { SpendTransaction, SpendRecipient, SpendNotification, SpendEvent, FundraiserDonor } from '../types';

const BASE = ((Constants.expoConfig?.extra?.zerospendUrl as string) || '').replace(/\/$/, '');

export class SpendApiError extends Error {}

async function request<T = any>(path: string, method: 'GET' | 'POST' | 'DELETE', body?: unknown, token?: string, extraHeaders?: Record<string, string>): Promise<T> {
    let res: Response;
    try {
        res = await fetch(`${BASE}${path}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(extraHeaders || {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        });
    } catch {
        throw new SpendApiError('Cannot reach ZeroSpend. Check your connection.');
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
        const err = new SpendApiError(json.error || `Request failed (${res.status})`);
        (err as any).payload = json;
        throw err;
    }
    return json as T;
}

export const spendApi = {
    register: (email: string, country?: string) =>
        request('/api/zerospend/auth/register', 'POST', country ? { email, country } : { email }),
    sendOtp: (email: string) => request('/api/zerospend/auth/send-otp', 'POST', { email }),
    /** Validates an OTP without consuming it — used by OtpScreen to fail fast before password creation. */
    checkOtp: (email: string, otp: string) =>
        request('/api/zerospend/auth/check-otp', 'POST', { email, otp }),
    verifyOtp: (email: string, otp: string, password: string) =>
        request('/api/zerospend/auth/verify-otp', 'POST', { email, otp, password }),
    login: (email: string, password: string) =>
        request<{ success: boolean; token: string; user: any }>('/api/zerospend/auth/login', 'POST', { email, password }),
    me: (token: string) => request('/api/zerospend/auth/me', 'GET', undefined, token),
    updateCountry: (token: string, country: string) =>
        request<{ success: boolean; user: any }>('/api/zerospend/auth/country', 'POST', { country }, token),

    getInstitutions: (currency = 'NGN', country = 'NG') =>
        request<{ success: boolean; banks: { code: string; name: string }[] }>(
            `/api/flipeet/institutions?currency=${encodeURIComponent(currency)}&country=${encodeURIComponent(country)}`,
            'GET'
        ),
    resolveInstitution: (accountNumber: string, bankCode: string, country = 'NG') =>
        request<{ success: boolean; accountName: string; accountNumber: string; bankCode: string }>(
            '/api/flipeet/institutions/lookup',
            'POST',
            { account_number: accountNumber, bank_code: bankCode, country }
        ),
    transactions: (token: string) =>
        request<{ success: boolean; transactions: SpendTransaction[] }>('/api/zerospend/transactions', 'GET', undefined, token),
    banks: (token: string) =>
        request<{ success: boolean; banks: { code: string; name: string }[] }>('/api/zerospend/banks', 'GET', undefined, token),
    resolveAccount: (token: string, accountNumber: string, bankCode: string) =>
        request<{ success: boolean; accountName: string }>(
            `/api/zerospend/banks/resolve?accountNumber=${encodeURIComponent(accountNumber)}&bankCode=${encodeURIComponent(bankCode)}`,
            'GET',
            undefined,
            token
        ),
    sendTransfer: (token: string, payload: { amount: number; account_number: string; bank_code: string; narration?: string }, twoFactorToken?: string) =>
        request<{ success: boolean; simulated?: boolean; transfer: { id: string; status: string; accountName: string } }>(
            '/api/zerospend/transfers',
            'POST',
            payload,
            token,
            twoFactorToken ? { 'x-2fa-token': twoFactorToken } : undefined
        ),
    setPin: (token: string, pin: string) =>
        request<{ success: boolean; needsOtp?: boolean; user?: any }>('/api/zerospend/auth/pin', 'POST', { pin }, token),
    confirmPin: (token: string, otp: string) =>
        request<{ success: boolean; user: any }>('/api/zerospend/auth/pin/confirm', 'POST', { otp }, token),
    authorize2FA: (token: string, method: 'passkey' | 'pin', pin?: string) =>
        request<{ success: boolean; twoFactorToken: string }>(
            '/api/zerospend/auth/2fa/authorize',
            'POST',
            method === 'pin' ? { method, pin } : { method },
            token
        ),
    setBiometric: (token: string, enabled: boolean, twoFactorToken?: string) =>
        request<{ success: boolean; user: any }>(
            '/api/zerospend/auth/biometric',
            'POST',
            { enabled },
            token,
            twoFactorToken ? { 'x-2fa-token': twoFactorToken } : undefined
        ),
    recipients: (token: string) =>
        request<{ success: boolean; recipients: SpendRecipient[] }>('/api/zerospend/recipients', 'GET', undefined, token),
    addRecipient: (token: string, payload: { account_number: string; bank_code: string; bank_name: string; country?: string; currency?: string }) =>
        request<{ success: boolean; recipient: SpendRecipient }>('/api/zerospend/recipients', 'POST', payload, token),
    notifications: (token: string) =>
        request<{ success: boolean; notifications: SpendNotification[] }>('/api/zerospend/notifications', 'GET', undefined, token),
    markNotificationsRead: (token: string, id?: string) =>
        request<{ success: boolean }>('/api/zerospend/notifications/read', 'POST', id ? { id } : {}, token),
    registerPushToken: (token: string, pushToken: string) =>
        request<{ success: boolean }>('/api/zerospend/auth/push-token', 'POST', { token: pushToken }, token),
    unregisterPushToken: (token: string, pushToken: string) =>
        request<{ success: boolean }>('/api/zerospend/auth/push-token', 'DELETE', { token: pushToken }, token),
    verifyNin: (token: string, identifier: string, type: 'nin' | 'bvn') =>
        request<{ success: boolean; alreadyProvisioned: boolean; user: any }>(
            '/api/zerospend/auth/verify-nin',
            'POST',
            type === 'nin' ? { nin: identifier } : { bvn: identifier },
            token
        ),
    listEvents: (kind?: 'fundraiser' | 'regular') =>
        request<{ success: boolean; events: SpendEvent[] }>(
            `/api/zerospend/events/public${kind ? `?kind=${kind}` : ''}`,
            'GET'
        ),
    getEvent: (slug: string) =>
        request<{ success: boolean; event: SpendEvent; recentDonations: FundraiserDonor[] }>(
            `/api/zerospend/events/${encodeURIComponent(slug)}`,
            'GET'
        ),
    donate: (token: string, slug: string, payload: { amount: number; donorName?: string; message?: string }, twoFactorToken?: string) =>
        request<{ success: boolean; donation: { reference: string; amount: number }; event: SpendEvent; balanceNGN: number }>(
            `/api/zerospend/events/${encodeURIComponent(slug)}/donate`,
            'POST',
            payload,
            token,
            twoFactorToken ? { 'x-2fa-token': twoFactorToken } : undefined
        ),
};