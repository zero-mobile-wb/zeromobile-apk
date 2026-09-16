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
import * as Updates from 'expo-updates';
import Header from '../components/Header';
import Navigation from '../components/Navigation';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { useCurrency } from '../context/CurrencyContext';
import { useNetwork, NetworkType } from '../context/NetworkContext';
import { RootStackParamList } from '../types/navigation';
import BiometricService from '../services/biometricService';
import { ZeroAlphaService, ZeroUser } from '../services/zeroAlphaService';
import { useEmbeddedSolanaWallet, usePrivy } from '@privy-io/expo';

interface SettingsScreenProps {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
    const [biometricEnabled, setBiometricEnabled] = React.useState(false);
    const [updateStatus, setUpdateStatus] = React.useState<'idle' | 'checking' | 'downloading' | 'ready' | 'uptodate'>('idle');

    const updateLabel =
        updateStatus === 'checking' ? 'Checking…' :
        updateStatus === 'downloading' ? 'Downloading…' :
        updateStatus === 'ready' ? 'Restart to apply' :
        updateStatus === 'uptodate' ? 'Up to date' : 'Check for updates';

    const handleCheckUpdates = async () => {
        if (!Updates.isEnabled) {
            Alert.alert('Not available', 'Over-the-air updates are not enabled in this build yet. Rebuild the app once with the updates config to enable them.');
            return;
        }
        if (updateStatus === 'checking' || updateStatus === 'downloading') return;
        try {
            setUpdateStatus('checking');
            const res = await Updates.checkForUpdateAsync();
            if (!res.isAvailable) {
                setUpdateStatus('uptodate');
                return;
            }
            setUpdateStatus('downloading');
            await Updates.fetchUpdateAsync();
            setUpdateStatus('ready');
            Alert.alert('Update ready', 'A new version was downloaded. Restart now to apply it?', [
                { text: 'Later', style: 'cancel' },
                { text: 'Restart', onPress: () => Updates.reloadAsync() },
            ]);
        } catch (e: any) {
            setUpdateStatus('idle');
            const detail = e?.message ? `\n\nReason: ${e.message}` : '';
            Alert.alert('Update failed', `Could not check for updates. Check your connection and try again.${detail}`);
        }
    };
    const { currentTheme, themeId, toggleTheme } = useTheme();
    const { wallet, wipeAllData } = useWallet();
    const privySolanaWallet = useEmbeddedSolanaWallet();
    const { selectedCurrency } = useCurrency();
    const { network, setNetwork } = useNetwork();
    const { user, logout: privyLogout } = usePrivy();

    const localSolana = wallet?.publicKey.toBase58();
    const privySolana = (privySolanaWallet.wallets?.[0] as any)?.address;
    const solanaAddress = user ? privySolana : (localSolana || privySolana);

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
        if (solanaAddress) {
            await Clipboard.setStringAsync(solanaAddress);
            Alert.alert('Copied!', 'Wallet address copied to clipboard');
        }
    };


    const handleSignOut = () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out? This will remove all wallets from this device. Make sure you have your recovery phrases backed up.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        try { await privyLogout(); } catch (e) {}
                        await ZeroAlphaService.logout();
                        await wipeAllData();
                        navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.primary }]}>
            <Header
                title="Settings"
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
                                {user ? (
                                    <>
                                        <Text style={[styles.profileName, { color: currentTheme.text }]}>
                                            {(user as any).email?.address || (user as any).linkedAccounts?.find((a: any) => a.type === 'email')?.address || (user as any).linked_accounts?.find((a: any) => a.type === 'email')?.address || 'Privy User'}
                                        </Text>
                                        <Text style={{ color: currentTheme.textLight, fontSize: 12, marginBottom: 8 }}>
                                            ID: {user.id.split('did:privy:')[1] || user.id}
                                        </Text>
                                    </>
                                ) : (
                                    <Text style={[styles.profileName, { color: currentTheme.text }]}>Zero Wallet</Text>
                                )}
                                <TouchableOpacity onPress={handleCopyAddress} style={styles.addressContainer}>
                                    <Text style={[styles.profileAddress, { color: currentTheme.textLight }]}>
                                        {solanaAddress ? `${solanaAddress.slice(0, 8)}...${solanaAddress.slice(-6)}` : 'No wallet connected'}
                                    </Text>
                                    {solanaAddress && <Ionicons name="copy-outline" size={16} color={currentTheme.textLight} style={styles.copyIcon} />}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Security Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: currentTheme.textLight }]}>Security</Text>
                    <View style={styles.settingsCard}>
                        {!user && (
                            <TouchableOpacity
                                style={styles.settingItem}
                                onPress={() => navigation.navigate('ManageWalletModal' as any)}
                            >
                                <View style={styles.settingLeft}>
                                    <View style={[styles.iconContainer, { backgroundColor: `${currentTheme.text}10` }]}>
                                        <Ionicons name="shield-checkmark-outline" size={20} color={currentTheme.text} />
                                    </View>
                                    <Text style={[styles.settingText, { color: currentTheme.text }]}>Export Private Key / Security</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={currentTheme.textLight} />
                            </TouchableOpacity>
                        )}

                        <View style={styles.settingItem}>
                            <View style={styles.settingLeft}>
                                <View style={[styles.iconContainer, { backgroundColor: `${currentTheme.text}10` }]}>
                                    <Ionicons name="finger-print-outline" size={20} color={currentTheme.text} />
                                </View>
                                <Text style={[styles.settingText, { color: currentTheme.text }]}>Biometric Login</Text>
                            </View>
                            <Switch
                                value={biometricEnabled}
                                onValueChange={handleToggleBiometrics}
                                trackColor={{ false: currentTheme.border, true: currentTheme.gradientStart }}
                                thumbColor={currentTheme.text}
                            />
                        </View>
                    </View>
                </View>

                {/* Preferences Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: currentTheme.textLight }]}>Preferences</Text>
                    <View style={styles.settingsCard}>
                        <View style={styles.settingItem}>
                            <View style={styles.settingLeft}>
                                <View style={[styles.iconContainer, { backgroundColor: `${currentTheme.text}10` }]}>
                                    <Ionicons name="moon-outline" size={20} color={currentTheme.text} />
                                </View>
                                <Text style={[styles.settingText, { color: currentTheme.text }]}>Dark Theme</Text>
                            </View>
                            <Switch
                                value={themeId === 'dark'}
                                onValueChange={toggleTheme}
                                trackColor={{ false: currentTheme.border, true: currentTheme.gradientStart }}
                                thumbColor={currentTheme.text}
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.settingItem}
                            onPress={() => navigation.navigate('CurrencySelection')}
                        >
                            <View style={styles.settingLeft}>
                                <View style={[styles.iconContainer, { backgroundColor: `${currentTheme.text}10` }]}>
                                    <Ionicons name="cash-outline" size={20} color={currentTheme.text} />
                                </View>
                                <Text style={[styles.settingText, { color: currentTheme.text }]}>Currency</Text>
                            </View>
                            <View style={styles.languageSelection}>
                                <Text style={[styles.languageText, { color: currentTheme.textLight }]}>{selectedCurrency.code} ({selectedCurrency.symbol})</Text>
                                <Ionicons name="chevron-forward" size={18} color={currentTheme.textLight} />
                            </View>
                        </TouchableOpacity>

                        <View style={styles.settingItem}>
                            <View style={styles.settingLeft}>
                                <View style={[styles.iconContainer, { backgroundColor: `${currentTheme.text}10` }]}>
                                    <Ionicons name="git-network-outline" size={20} color={currentTheme.text} />
                                </View>
                                <Text style={[styles.settingText, { color: currentTheme.text }]}>Developer Network</Text>
                            </View>
                            <Switch
                                value={network === 'devnet'}
                                onValueChange={(val) => setNetwork(val ? 'devnet' : 'mainnet-beta')}
                                trackColor={{ false: currentTheme.border, true: currentTheme.gradientStart }}
                                thumbColor={currentTheme.text}
                            />
                        </View>
                    </View>
                </View>

                {/* Danger Zone */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: '#EF4444' }]}>Danger Zone</Text>
                    <View style={styles.settingsCard}>
                        <TouchableOpacity style={[styles.settingItem, styles.dangerItem]} onPress={handleSignOut}>
                            <View style={styles.settingLeft}>
                                <View style={styles.dangerIconContainer}>
                                    <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                                </View>
                                <Text style={styles.dangerText}>Sign Out from App</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#EF4444" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* App Updates */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>App Updates</Text>
                    <View style={styles.settingsCard}>
                        <TouchableOpacity style={styles.settingItem} onPress={handleCheckUpdates}>
                            <View style={styles.settingLeft}>
                                <View style={[styles.iconContainer, { backgroundColor: `${currentTheme.text}10` }]}>
                                    <Ionicons name="cloud-download-outline" size={20} color={currentTheme.text} />
                                </View>
                                <Text style={[styles.settingText, { color: currentTheme.text }]}>Check for updates</Text>
                            </View>
                            <Text style={[styles.languageText, { color: currentTheme.textLight }]}>{updateLabel}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* App Version */}
                <View style={styles.versionContainer}>
                    <Text style={[styles.versionText, { color: currentTheme.textLight }]}>Zero Wallet v1.0.0</Text>
                </View>
            </ScrollView>

            <Navigation
                activeTab="settings"
                onTabPress={(tab) => {
                    if (tab === 'wallet') {
                        navigation.navigate('Wallet');
                    } else if (tab === 'activity') {
                        navigation.navigate('Activity');
                    } else if (tab === 'swap') {
                        navigation.navigate('Swap');
                    } else if (tab === 'settings') {
                        navigation.navigate('Settings');
                    } else if (tab === 'bank') {
                        navigation.navigate('SpendEmail');
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
        fontSize: 12,
        fontWeight: '700',
        color: colors.gray,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginBottom: 16,
        marginLeft: 4,
    },
    profileCard: {
        backgroundColor: 'transparent',
        padding: 16,
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
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.secondary,
        marginBottom: 6,
    },
    addressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    profileAddress: {
        fontSize: 12,
        color: colors.gray,
        fontFamily: 'sans-serif',
    },
    copyIcon: {
        marginLeft: 8,
    },
    editProfileButton: {
        backgroundColor: colors.secondary,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 25,
        width: '100%',
        alignItems: 'center',
    },
    editProfileText: {
        color: colors.white,
        fontSize: 14,
        fontWeight: '600',
    },
    settingsCard: {
        backgroundColor: 'transparent',
        overflow: 'hidden',
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
    settingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    settingText: {
        fontSize: 14,
        color: colors.secondary,
        marginLeft: 14,
        fontWeight: '500',
    },
    iconContainer: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dangerIconContainer: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(220, 53, 69, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    divider: {
        height: 1,
        backgroundColor: colors.lightGray,
        marginHorizontal: 16,
    },
    languageSelection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    languageText: {
        fontSize: 13,
        color: colors.gray,
        marginRight: 8,
    },
    dangerItem: {
        // Special styling for danger items
    },
    dangerText: {
        fontSize: 14,
        color: '#DC3545',
        marginLeft: 14,
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