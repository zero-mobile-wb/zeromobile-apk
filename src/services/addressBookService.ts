import AsyncStorage from '@react-native-async-storage/async-storage';

const ADDRESS_BOOK_KEY = '@zero_wallet_address_book';

export interface SavedAddress {
  address: string;
  label?: string;
  lastUsed: number;
  frequency: number;
}

/**
 * Get all saved addresses sorted by frequency and recency
 */
export const getSavedAddresses = async (): Promise<SavedAddress[]> => {
  try {
    const saved = await AsyncStorage.getItem(ADDRESS_BOOK_KEY);
    if (!saved) return [];

    const addresses: SavedAddress[] = JSON.parse(saved);

    // Sort by frequency first, then by lastUsed
    return addresses.sort((a, b) => {
      if (b.frequency !== a.frequency) {
        return b.frequency - a.frequency;
      }
      return b.lastUsed - a.lastUsed;
    });
  } catch (error) {
    console.error('Error loading saved addresses:', error);
    return [];
  }
};

/**
 * Save or update an address in the address book
 */
export const saveAddress = async (address: string, label?: string): Promise<void> => {
  try {
    const addresses = await getSavedAddresses();
    const existingIndex = addresses.findIndex(a => a.address === address);

    if (existingIndex >= 0) {
      // Update existing address
      addresses[existingIndex].frequency += 1;
      addresses[existingIndex].lastUsed = Date.now();
      if (label) {
        addresses[existingIndex].label = label;
      }
    } else {
      // Add new address
      addresses.push({
        address,
        label,
        lastUsed: Date.now(),
        frequency: 1,
      });
    }

    // Keep only the last 20 addresses
    const limitedAddresses = addresses.slice(0, 20);

    await AsyncStorage.setItem(ADDRESS_BOOK_KEY, JSON.stringify(limitedAddresses));
  } catch (error) {
    console.error('Error saving address:', error);
  }
};

/**
 * Remove an address from the address book
 */
export const removeAddress = async (address: string): Promise<void> => {
  try {
    const addresses = await getSavedAddresses();
    const filtered = addresses.filter(a => a.address !== address);
    await AsyncStorage.setItem(ADDRESS_BOOK_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing address:', error);
  }
};
