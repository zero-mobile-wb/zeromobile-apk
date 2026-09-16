// Country-aware onboarding presets.
//
// Nigerians (NG) get a Flutterwave virtual account. Everyone else links a
// bank account verified via Flipeet — starting with these 7, but users are NOT
// blocked from linking any other country (LinkAccountScreen offers "Other").
export interface PayoutCountry {
    code: string;
    name: string;
    currency: string;
    symbol: string;
    flag: string;
    // Live-tested against Flipeet (institutions + lookup + offramp + onramp):
    // NG/KE/GH verify and pay out. US/GB/EU/AE have no Flipeet coverage —
    // empty bank lists, null lookup names, no on/off-ramp.
    payoutLive: boolean;
    // Identifier style hint for the account input placeholder.
    accountHint: string;
    // Max input length hint (0 = no limit).
    accountMaxLength: number;
    // Numeric-only keypad when true.
    numericOnly: boolean;
}

// Live-tested against Flipeet (institutions + lookup + offramp + onramp).
// Live: NG (367 banks), KE + GH + TZ + UG (mobile money), ZA (14 banks).
// AE opened on request (65 banks listed). CN lists 448 banks but Flipeet
// blocks its payouts. No coverage at all: US, GB, EU, JP, IN, PH.
export const PAYOUT_COUNTRIES: PayoutCountry[] = [
    { code: 'NG', name: 'Nigeria', currency: 'NGN', symbol: '₦', flag: '🇳🇬', payoutLive: true, accountHint: '0123456789', accountMaxLength: 10, numericOnly: true },
    { code: 'KE', name: 'Kenya', currency: 'KES', symbol: 'KSh', flag: '🇰🇪', payoutLive: true, accountHint: 'M-PESA / Airtel number', accountMaxLength: 0, numericOnly: false },
    { code: 'GH', name: 'Ghana', currency: 'GHS', symbol: '₵', flag: '🇬🇭', payoutLive: true, accountHint: 'MTN / Airtel / Vodafone number', accountMaxLength: 0, numericOnly: false },
    { code: 'ZA', name: 'South Africa', currency: 'ZAR', symbol: 'R', flag: '🇿🇦', payoutLive: true, accountHint: 'Account number', accountMaxLength: 0, numericOnly: false },
    { code: 'TZ', name: 'Tanzania', currency: 'TZS', symbol: 'TSh', flag: '🇹🇿', payoutLive: true, accountHint: 'Airtel / Tigo / Halopesa / Vodacom number', accountMaxLength: 0, numericOnly: false },
    { code: 'AE', name: 'UAE', currency: 'AED', symbol: 'AED ', flag: '🇦🇪', payoutLive: true, accountHint: 'IBAN / account number', accountMaxLength: 0, numericOnly: false },
];

export const DEFAULT_COUNTRY = PAYOUT_COUNTRIES[0];

export function findCountry(code?: string | null): PayoutCountry | null {
    if (!code) return null;
    const c = code.trim().toUpperCase();
    return PAYOUT_COUNTRIES.find(p => p.code === c) || null;
}

export function isNigeria(code?: string | null): boolean {
    // Strict: a missing/unknown country is NEVER treated as Nigeria.
    // (Accounts created before country tracking have no country stored —
    // defaulting those to NG wrongly showed them the NIN panel.)
    return (code || '').trim().toUpperCase() === 'NG';
}
