// Mock for react-native-passkeys in Expo Go
// Passkeys require native modules that aren't available in Expo Go

console.log('[react-native-passkeys] Using mock implementation for Expo Go');

export const PasskeyClient = {
  isSupported: async () => false,
  register: async () => {
    throw new Error('Passkeys are not supported in Expo Go. Please use a development build.');
  },
  authenticate: async () => {
    throw new Error('Passkeys are not supported in Expo Go. Please use a development build.');
  },
};

export const isSupported = async () => false;

export const register = async () => {
  throw new Error('Passkeys are not supported in Expo Go. Please use a development build.');
};

export const authenticate = async () => {
  throw new Error('Passkeys are not supported in Expo Go. Please use a development build.');
};

export default {
  PasskeyClient,
  isSupported,
  register,
  authenticate,
};
