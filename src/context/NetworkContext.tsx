import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type NetworkType = 'mainnet-beta' | 'devnet';

interface NetworkContextType {
    network: NetworkType;
    setNetwork: (network: NetworkType) => Promise<void>;
}

const NetworkContext = createContext<NetworkContextType>({
    network: 'mainnet-beta',
    setNetwork: async () => { },
});

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [network, setNetworkState] = useState<NetworkType>('mainnet-beta');

    useEffect(() => {
        const loadNetwork = async () => {
            try {
                const stored = await AsyncStorage.getItem('@zero_network');
                if (stored === 'mainnet-beta' || stored === 'devnet') {
                    setNetworkState(stored);
                } else {
                    // Default to mainnet-beta
                    await AsyncStorage.setItem('@zero_network', 'mainnet-beta');
                    setNetworkState('mainnet-beta');
                }
            } catch (e) {
                console.error('Failed to load network preference', e);
            }
        };
        loadNetwork();
    }, []);

    const setNetwork = async (newNetwork: NetworkType) => {
        try {
            await AsyncStorage.setItem('@zero_network', newNetwork);
            setNetworkState(newNetwork);
        } catch (e) {
            console.error('Failed to save network preference', e);
        }
    };

    return (
        <NetworkContext.Provider value={{ network, setNetwork }}>
            {children}
        </NetworkContext.Provider>
    );
};

export const useNetwork = () => useContext(NetworkContext);
