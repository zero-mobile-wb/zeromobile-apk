export interface SpendVirtualAccount {
    account_number: string;
    bank_name: string;
    flw_ref: string;
    created_at?: string;
}

export interface SpendCard {
    id: string;
    maskedpan: string;
    name_on_card: string;
    card_type: string;
    currency: string;
    amount: number;
    expiration: string;
    is_active: boolean;
    frozen: boolean;
}

export interface SpendTwoFactor {
    pinSet: boolean;
    passkeySet: boolean;
    preferred: 'passkey' | 'pin';
}

export interface SpendNotification {
    id: string;
    kind: string;
    title: string;
    body: string;
    ref?: string;
    read: boolean;
    createdAt: string;
}

export interface SpendUser {
    email: string;
    name: string;
    country: string;
    walletAddress: string;
    balanceNGN: number;
    verified: boolean;
    virtualAccount: SpendVirtualAccount | null;
    virtualCards: SpendCard[];
    twoFactor?: SpendTwoFactor;
    notifications?: SpendNotification[];
    createdAt?: string;
}

export interface SpendSession {
    token: string;
    user: SpendUser;
}

export interface Provisioning {
    virtualAccount: boolean;
    virtualCard: boolean;
    cardPending: boolean;
}

export interface SpendTransactionDetails {
    bankName?: string | null;
    accountNumber?: string | null;
    accountName?: string | null;
    bankCode?: string | null;
    provider?: string | null;
    rate?: number | null;
    assetAmount?: number | null;
    assetNetwork?: string | null;
    assetCurrency?: string | null;
    fee?: number | null;
    feeCurrency?: string | null;
    expiresAt?: string | null;
}

export interface SpendTransaction {
    reference: string;
    kind: 'onramp' | 'offramp' | 'card' | 'va' | 'send';
    direction: 'in' | 'out';
    asset: string | null;
    amount: number | null;
    currency: string | null;
    status: string;
    effectiveStatus?: string;
    expiresAt?: string | null;
    createdAt: string;
    details?: SpendTransactionDetails;
}

export interface SpendRecipient {
    id: string;
    name: string;
    account_number: string;
    bank_code: string;
    bank_name: string;
    country?: string;
    currency?: string;
}

export interface SpendEvent {
    slug: string;
    kind: 'fundraiser' | 'regular';
    title: string;
    description: string;
    imageUrl: string;
    link: string;
    status: 'active' | 'closed';
    goalNGN: number;
    raisedNGN: number;
    donorCount: number;
    paidOutNGN: number;
    createdAt: string;
}

export interface FundraiserDonor {
    donorName: string;
    amount: number;
    message: string;
    createdAt: string;
}