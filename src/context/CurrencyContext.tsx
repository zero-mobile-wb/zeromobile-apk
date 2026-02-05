import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  rate?: number; // Exchange rate to USD
}

export const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', rate: 1 },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', rate: 1580 }, // Approximate rate
];

interface CurrencyContextType {
  selectedCurrency: Currency;
  setSelectedCurrency: (currency: Currency) => Promise<void>;
  currencies: Currency[];
  convertFromUSD: (usdAmount: number) => number;
  formatAmount: (usdAmount: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const CURRENCY_STORAGE_KEY = '@zero_wallet_currency';

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedCurrency, setSelectedCurrencyState] = useState<Currency>(CURRENCIES[0]);

  // Load saved currency on mount
  useEffect(() => {
    loadSavedCurrency();
  }, []);

  const loadSavedCurrency = async () => {
    try {
      const saved = await AsyncStorage.getItem(CURRENCY_STORAGE_KEY);
      if (saved) {
        const currencyCode = JSON.parse(saved);
        const currency = CURRENCIES.find(c => c.code === currencyCode);
        if (currency) {
          setSelectedCurrencyState(currency);
        }
      }
    } catch (error) {
      console.error('Error loading currency:', error);
    }
  };

  const setSelectedCurrency = async (currency: Currency) => {
    try {
      await AsyncStorage.setItem(CURRENCY_STORAGE_KEY, JSON.stringify(currency.code));
      setSelectedCurrencyState(currency);
    } catch (error) {
      console.error('Error saving currency:', error);
    }
  };

  const convertFromUSD = (usdAmount: number): number => {
    return usdAmount * (selectedCurrency.rate || 1);
  };

  const formatAmount = (usdAmount: number): string => {
    const convertedAmount = convertFromUSD(usdAmount);
    return `${selectedCurrency.symbol}${convertedAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <CurrencyContext.Provider
      value={{
        selectedCurrency,
        setSelectedCurrency,
        currencies: CURRENCIES,
        convertFromUSD,
        formatAmount,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
