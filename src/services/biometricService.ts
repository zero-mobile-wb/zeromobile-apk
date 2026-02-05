import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_ENABLED_KEY = '@biometric_enabled';

const BiometricService = {
    /**
     * Checks if the device has biometric hardware and if any biometrics are enrolled
     */
    async isBiometricAvailable(): Promise<boolean> {
        try {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();
            return hasHardware && isEnrolled;
        } catch (error) {
            console.error('[BiometricService] Error checking availability:', error);
            return false;
        }
    },

    /**
     * Triggers the biometric authentication prompt
     */
    async authenticate(reason: string = 'Authenticate to continue'): Promise<boolean> {
        try {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: reason,
                fallbackLabel: 'Use Passcode',
                disableDeviceFallback: false,
            });
            return result.success;
        } catch (error) {
            console.error('[BiometricService] Authentication error:', error);
            return false;
        }
    },

    /**
     * Get user preference for biometric usage
     */
    async isEnabled(): Promise<boolean> {
        try {
            const value = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
            return value === 'true';
        } catch (error) {
            return false;
        }
    },

    /**
     * Set user preference for biometric usage
     */
    async setEnabled(enabled: boolean): Promise<void> {
        try {
            await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled.toString());
        } catch (error) {
            console.error('[BiometricService] Error saving preference:', error);
        }
    }
};

export default BiometricService;
