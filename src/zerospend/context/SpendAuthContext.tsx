import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SpendSession, SpendUser } from '../types';
import { spendApi } from '../services/api';

const SESSION_KEY = 'zerospend_session';

interface SpendAuthContextValue {
    session: SpendSession | null;
    loading: boolean;
    setSession: (s: SpendSession) => void;
    updateUser: (u: SpendUser) => void;
    refreshUser: () => Promise<void>;
    logout: () => void;
}

const SpendAuthContext = createContext<SpendAuthContextValue>({
    session: null,
    loading: true,
    setSession: () => {},
    updateUser: () => {},
    refreshUser: async () => {},
    logout: () => {},
});

export const SpendAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSessionState] = useState<SpendSession | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const raw = await AsyncStorage.getItem(SESSION_KEY);
                if (raw) setSessionState(JSON.parse(raw));
            } catch {}
            setLoading(false);
        })();
    }, []);

    const setSession = useCallback(async (s: SpendSession) => {
        setSessionState(s);
        try { await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch {}
    }, []);

    const updateUser = useCallback(async (u: SpendUser) => {
        setSessionState(prev => {
            const next = prev ? { ...prev, user: u } : prev;
            if (next) AsyncStorage.setItem(SESSION_KEY, JSON.stringify(next)).catch(() => {});
            return next;
        });
    }, []);

    const refreshUser = useCallback(async () => {
        setSessionState(prev => {
            if (!prev?.token) return prev;
            spendApi.me(prev.token).then(res => {
                const user = res.user as SpendUser;
                if (user) updateUser(user);
            }).catch(() => {});
            return prev;
        });
    }, [updateUser]);

    const logout = useCallback(async () => {
        setSessionState(null);
        try { await AsyncStorage.removeItem(SESSION_KEY); } catch {}
    }, []);

    return (
        <SpendAuthContext.Provider value={{ session, loading, setSession, updateUser, refreshUser, logout }}>
            {children}
        </SpendAuthContext.Provider>
    );
};

export const useSpendAuth = () => useContext(SpendAuthContext);