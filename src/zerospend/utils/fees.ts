// Mirrors zerospend-server/src/services/fees.js so the app can show projected
// fees before the user confirms a trade.
export const MIN_FEE = 100;
export const ONRAMP_RATE = 0.005; // 0.5% buy fee
export const OFFRAMP_RATE = 0.01; // 1% sell fee
export const SEND_FEE = 50;
export const SEND_FEE_THRESHOLD = 10000;

export function calcTradeFee(amount: number, rate: number): number {
    const n = Number(amount) || 0;
    if (n <= 0) return 0;
    const raw = n * rate;
    return Math.round(Math.max(raw, MIN_FEE) * 100) / 100;
}

export function calcSendFee(amount: number): number {
    const n = Number(amount) || 0;
    return n > SEND_FEE_THRESHOLD ? SEND_FEE : 0;
}