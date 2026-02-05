import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    Switch,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import Header from '../components/Header';
import Navigation from '../components/Navigation';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { useCurrency } from '../context/CurrencyContext';
import { RootStackParamList } from '../types/navigation';
import BiometricService from '../services/biometricService';

interface SettingsScreenProps {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
    const [biometricEnabled, setBiometricEnabled] = React.useState(false);
    const { currentTheme } = useTheme();
    const { wallet, signOut, wallets } = useWallet();
    const { selectedCurrency } = useCurrency();

    React.useEffect(() => {
        const loadBiometricPref = async () => {
            const enabled = await BiometricService.isEnabled();
            setBiometricEnabled(enabled);
        };
        loadBiometricPref();
    }, []);

    const handleToggleBiometrics = async (value: boolean) => {
        const available = await BiometricService.isBiometricAvailable();
        if (!available && value) {
            Alert.alert('Not Available', 'Biometric authentication is not available or not set up on this device.');
            return;
        }

        // If enabling, authenticate first to verify
        if (value) {
            const success = await BiometricService.authenticate('Verify biometrics to enable');
            if (!success) return;
        }

        await BiometricService.setEnabled(value);
        setBiometricEnabled(value);
    };

    const handleCopyAddress = async () => {
        if (wallet) {
            await Clipboard.setStringAsync(wallet.publicKey.toBase58());
            Alert.alert('Copied!', 'Wallet address copied to clipboard');
        }
    };

    const handleDisconnect = () => {
        Alert.alert(
            'Disconnect Wallet',
            'Are you sure you want to disconnect your wallet? Make sure you have saved your recovery phrase.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Disconnect',
                    style: 'destructive',
                    onPress: async () => {
                        await signOut();
                        navigation.navigate('Home');
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.primary }]}>
            <Header
                title="SETTINGS"
                showBack={true}
                onBackPress={() => navigation.goBack()}
                showAddress={false}
            />

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Profile Section */}
                <View style={styles.section}>
                    <View style={styles.profileCard}>
                        <View style={styles.profileHeader}>
                            <View style={styles.profileInfo}>
                                <Text style={styles.profileName}>Zero Wallet</Text>
                                <TouchableOpacity onPress={handleCopyAddress} style={styles.addressContainer}>
                                    <Text style={styles.profileAddress}>
                                        {wallet ? `${wallet.publicKey.toBase58().slice(0, 8)}...${wallet.publicKey.toBase58().slice(-6)}` : 'No wallet connected'}
                                    </Text>
                                    {wallet && <Ionicons name="copy-outline" size={16} color={colors.gray} style={styles.copyIcon} />}
                                </TouchableOpacity>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.editProfileButton}
                            onPress={() => navigation.navigate('WalletManagement')}
                        >
                            <Text style={styles.editProfileText}>
                                SWITCH WALLET ({wallets.length})
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Security Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Security</Text>
                    <View style={styles.settingsCard}>
                        <View style={styles.settingItem}>
                            <View style={styles.settingLeft}>
                                <Ionicons name="finger-print-outline" size={24} color={colors.secondary} />
                                <Text style={styles.settingText}>Biometric Login</Text>
                            </View>
                            <Switch
                                value={biometricEnabled}
                                onValueChange={handleToggleBiometrics}
                                trackColor={{ false: colors.lightGray, true: colors.accent }}
                                thumbColor={colors.white}
                            />
                        </View>

                        <View style={styles.divider} />

                        <TouchableOpacity style={styles.settingItem}>
                            <View style={styles.settingLeft}>
                                <Ionicons name="key-outline" size={24} color={colors.secondary} />
                                <Text style={styles.settingText}>Backup Wallet</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.gray} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Preferences Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Preferences</Text>
                    <View style={styles.settingsCard}>
                        <TouchableOpacity
                            style={styles.settingItem}
                            onPress={() => navigation.navigate('CurrencySelection')}
                        >
                            <View style={styles.settingLeft}>
                                <Ionicons name="cash-outline" size={24} color={colors.secondary} />
                                <Text style={styles.settingText}>Currency</Text>
                            </View>
                            <View style={styles.languageSelection}>
                                <Text style={styles.languageText}>{selectedCurrency.code} ({selectedCurrency.symbol})</Text>
                                <Ionicons name="chevron-forward" size={20} color={colors.gray} />
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Danger Zone */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Danger Zone</Text>
                    <View style={styles.settingsCard}>
                        <TouchableOpacity style={[styles.settingItem, styles.dangerItem]} onPress={handleDisconnect}>
                            <View style={styles.settingLeft}>
                                <Ionicons name="log-out-outline" size={24} color="#DC3545" />
                                <Text style={styles.dangerText}>Disconnect Wallet</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#DC3545" />
                        </TouchableOpacity>

                        <View style={styles.divider} />

                        <TouchableOpacity style={[styles.settingItem, styles.dangerItem]} onPress={handleDisconnect}>
                            <View style={styles.settingLeft}>
                                <Ionicons name="trash-outline" size={24} color="#DC3545" />
                                <Text style={styles.dangerText}>Delete Wallet</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#DC3545" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* App Version */}
                <View style={styles.versionContainer}>
                    <Text style={styles.versionText}>Zero Wallet v1.0.0</Text>
                </View>
            </ScrollView>

            <Navigation
                activeTab="settings"
                onTabPress={(tab) => {
                    if (tab === 'wallet') {
                        navigation.navigate('Wallet');
                    } else if (tab === 'activity') {
                        navigation.navigate('Activity');
                    } else if (tab === 'settings') {
                        navigation.navigate('Settings');
                    }
                }}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.primary,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 30,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.secondary,
        marginBottom: 12,
        marginLeft: 4,
    },
    profileCard: {
        backgroundColor: colors.white,
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        width: '100%',
    },
    profileLogo: {
        width: 60,
        height: 60,
        marginRight: 16,
    },
    profileInfo: {
        flex: 1,
    },
    profileName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.secondary,
        marginBottom: 8,
    },
    addressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    profileAddress: {
        fontSize: 14,
        color: colors.gray,
        fontFamily: 'monospace',
    },
    copyIcon: {
        marginLeft: 8,
    },
    editProfileButton: {
        backgroundColor: colors.secondary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 25,
        width: '100%',
        alignItems: 'center',
    },
    editProfileText: {
        color: colors.white,
        fontSize: 16,
        fontWeight: '600',
    },
    settingsCard: {
        backgroundColor: colors.white,
        borderRadius: 16,
        overflow: 'hidden',
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 18,
        paddingHorizontal: 20,
    },
    settingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    settingText: {
        fontSize: 16,
        color: colors.secondary,
        marginLeft: 16,
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: colors.lightGray,
        marginHorizontal: 20,
    },
    languageSelection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    languageText: {
        fontSize: 14,
        color: colors.gray,
        marginRight: 8,
    },
    dangerItem: {
        // Special styling for danger items
    },
    dangerText: {
        fontSize: 16,
        color: '#DC3545',
        marginLeft: 16,
        fontWeight: '500',
    },
    versionContainer: {
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 10,
    },
    versionText: {
        fontSize: 14,
        color: colors.gray,
        opacity: 0.7,
    },
});

export default SettingsScreen;