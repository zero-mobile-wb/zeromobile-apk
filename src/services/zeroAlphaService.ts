import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl;
const API_URL = `${BACKEND_URL}/api/zero`;

export interface ZeroUser {
    _id: string;
    email: string;
    walletAddress: string;
    points: number;
    tradingVolume: number;
    rank?: number; // Rank in leaderboard
    fairScore?: number;
    reputationTier?: string;
    multiplier?: number;
}

export const ZeroAlphaService = {

    async sendOtp(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            return await response.json();
        } catch (error: any) {
            console.error('Send OTP Error:', error);
            return { success: false, error: error.message };
        }
    },

    async verifyOtp(email: string, otp: string, walletAddress: string): Promise<{ success: boolean; user?: ZeroUser; error?: string }> {
        try {
            const response = await fetch(`${API_URL}/auth/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp, walletAddress }),
            });
            const data = await response.json();

            if (data.success && data.user) {
                await AsyncStorage.setItem('zero_alpha_user', JSON.stringify(data.user));
            }
            return data;
        } catch (error: any) {
            console.error('Verify OTP Error:', error);
            return { success: false, error: error.message };
        }
    },

    async getStoredUser(): Promise<ZeroUser | null> {
        try {
            const userJson = await AsyncStorage.getItem('zero_alpha_user');
            return userJson ? JSON.parse(userJson) : null;
        } catch (error) {
            return null;
        }
    },

    async logout(): Promise<void> {
        await AsyncStorage.removeItem('zero_alpha_user');
    },

    async syncFairData(email: string): Promise<{ success: boolean; fairScore?: number; reputationTier?: string; multiplier?: number; error?: string }> {
        try {
            const response = await fetch(`${API_URL}/sync-fairscore`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            return await response.json();
        } catch (error: any) {
            console.error('Sync FairData Error:', error);
            return { success: false, error: error.message };
        }
    },

    async checkIn(email: string): Promise<{ success: boolean; points?: number; message?: string; error?: string; multiplier?: number; fairScore?: number, reputationTier?: string }> {
        try {
            const response = await fetch(`${API_URL}/checkin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error('Check-in JSON Parse Error:', text);
                return { success: false, error: `Server Error: ${text.substring(0, 100)}` };
            }
        } catch (error: any) {
            console.error('Check-in Error:', error);
            return { success: false, error: error.message };
        }
    },

    async getFairScorePreview(walletAddress: string): Promise<{ success: boolean; score: number; tier: string; multiplier: number; error?: string }> {
        try {
            const response = await fetch(`${API_URL}/fairscore?wallet=${walletAddress}`);
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error('FairScore Preview JSON Parse Error:', text);
                return { success: false, score: 0, tier: 'RP1', multiplier: 1, error: `Server Error: ${text.substring(0, 100)}` };
            }
        } catch (error: any) {
            console.error('FairScore Preview Error:', error);
            return { success: false, score: 0, tier: 'RP1', multiplier: 1, error: error.message };
        }
    },

    async getUserStats(email: string): Promise<ZeroUser | null> {
        try {
            const response = await fetch(`${API_URL}/user/${email}`);
            if (response.ok) {
                const user = await response.json();
                // Update local storage
                await AsyncStorage.setItem('zero_alpha_user', JSON.stringify(user));
                return user;
            } else if (response.status === 404) {
                // User deleted on server
                await AsyncStorage.removeItem('zero_alpha_user');
                return null; // Return null to indicate no user found
            }
            return null;
        } catch (error) {
            return null;
        }
    },

    async getLeaderboard(tier: string): Promise<ZeroUser[]> {
        try {
            // Add timestamp to prevent caching
            const timestamp = Date.now();
            const url = `${API_URL}/leaderboard?tier=${tier}&_t=${timestamp}`;
            console.log('[ZeroAlphaService] Fetching leaderboard:', url);
            const response = await fetch(url, {
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            console.log('[ZeroAlphaService] Leaderboard response status:', response.status);
            if (response.ok) {
                const data = await response.json();
                console.log('[ZeroAlphaService] Leaderboard data:', data);
                return data;
            }
            return [];
        } catch (error) {
            console.error('Leaderboard Error:', error);
            return [];
        }
    }
};
