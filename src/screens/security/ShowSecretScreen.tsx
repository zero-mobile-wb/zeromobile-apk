import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    Alert,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../types/navigation';
import { useWallet } from '../../context/WalletContext';
import { useTheme } from '../../context/ThemeContext';
import { ChainId, EVM_CHAINS } from '../../services/chainService';
import Header from '../../components/Header';
import colors from '../../constants/colors';
import * as Clipboard from 'expo-clipboard';
import BiometricService from '../../services/biometricService';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'ShowSecret'>;
    route: RouteProp<RootStackParamList, 'ShowSecret'>;
};

const ShowSecretScreen: React.FC<Props> = ({ navigation, route }) => {
    const { exportMnemonic, exportPrivateKey, exportEvmPrivateKey } = useWallet();
    const { currentTheme } = useTheme();
    const [secretValue, setSecretValue] = useState('');
    const [isVisible, setIsVisible] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [activeChain, setActiveChain] = useState<ChainId>('solana');

    const showType = (route.params as any)?.type || 'mnemonic';
    const title = showType === 'privateKey' ? 'Private Key' : 'Recovery Phrase';

    const handleReveal = async () => {
        const isBiometricAvailable = await BiometricService.isBiometricAvailable();
        if (isBiometricAvailable) {
            const success = await BiometricService.authenticate(`Authenticate to view ${title}`);
            if (!success) return;
        }

        if (showType === 'privateKey') {
            if (activeChain === 'solana') {
                const pk = exportPrivateKey();
                if (pk) { setSecretValue(pk); setLoaded(true); }
                else Alert.alert('Error', 'No wallet loaded');
            } else {
                const pk = await exportEvmPrivateKey(activeChain);
                if (pk) { setSecretValue(pk); setLoaded(true); }
                else Alert.alert('Error', 'Could not export EVM key');
            }
        } else {
            const mnemonic = await exportMnemonic();
            if (mnemonic) { setSecretValue(mnemonic); setLoaded(true); }
            else Alert.alert('Error', 'No recovery phrase found');
        }
    };

    const switchChain = async (chain: ChainId) => {
        setActiveChain(chain);
        if (!loaded) return;
        if (chain === 'solana') {
            const pk = exportPrivateKey();
            if (pk) setSecretValue(pk);
        } else {
            const pk = await exportEvmPrivateKey(chain);
            if (pk) setSecretValue(pk);
        }
    };

    const handleCopy = async () => {
        if (secretValue) {
            await Clipboard.setStringAsync(secretValue);
            Alert.alert('Copied!', `${title} copied to clipboard.`);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.primary }]}>
            <Header title={`Export ${title}`} showBack onBackPress={() => {
                if (navigation.canGoBack()) {
                    navigation.goBack();
                } else {
                    navigation.navigate('Settings' as any);
                }
            }} showAddress={false} />

            <View style={styles.content}>
                {showType === 'privateKey' && (
                    <View style={styles.tabWrapper}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
                            <TouchableOpacity
                                style={[styles.tabBtn, activeChain === 'solana' && { borderBottomColor: currentTheme.text, borderBottomWidth: 2 }]}
                                onPress={() => switchChain('solana')}
                            >
                                <Text style={[styles.tabText, { color: activeChain === 'solana' ? currentTheme.text : currentTheme.textLight }]}>Solana</Text>
                            </TouchableOpacity>
                            {EVM_CHAINS.map(chain => (
                                <TouchableOpacity
                                    key={chain.id}
                                    style={[styles.tabBtn, activeChain === chain.id && { borderBottomColor: currentTheme.text, borderBottomWidth: 2 }]}
                                    onPress={() => switchChain(chain.id)}
                                >
                                    <Text style={[styles.tabText, { color: activeChain === chain.id ? currentTheme.text : currentTheme.textLight }]}>{chain.shortName}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {!loaded ? (
                    <View style={styles.revealSection}>
                        <Ionicons name="warning-outline" size={48} color="#F59E0B" style={{ marginBottom: 16 }} />
                        <Text style={[styles.warningTitle, { color: currentTheme.text }]}>Keep this secret</Text>
                        <Text style={[styles.warningText, { color: currentTheme.textLight }]}>
                            Anyone with your {title.toLowerCase()} has full access to your funds. Never share it.
                        </Text>

                        {currentTheme.id === 'white' ? (
                            <TouchableOpacity style={[styles.revealBtn, { backgroundColor: currentTheme.text }]} onPress={handleReveal}>
                                <Text style={[styles.revealBtnText, { color: currentTheme.primary }]}>Reveal {activeChain === 'solana' ? 'Solana' : activeChain} {title}</Text>
                            </TouchableOpacity>
                        ) : (
                            <LinearGradient
                                colors={[currentTheme.gradientStart, currentTheme.gradientEnd]}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                style={[styles.revealBtn, { paddingVertical: 0, overflow: 'hidden' }]}
                            >
                                <TouchableOpacity style={{ width: '100%', paddingVertical: 18, paddingHorizontal: 40, alignItems: 'center', justifyContent: 'center' }} onPress={handleReveal}>
                                    <Text style={[styles.revealBtnText, { color: currentTheme.primary }]}>Reveal {activeChain === 'solana' ? 'Solana' : activeChain} {title}</Text>
                                </TouchableOpacity>
                            </LinearGradient>
                        )}
                    </View>
                ) : (
                    <View style={styles.secretCard}>
                        <Text style={[styles.warningSubText, { color: currentTheme.textLight }]}>
                            Store this somewhere safe. Do not share it with anyone.
                        </Text>

                        <View style={[styles.secretBox, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
                            {isVisible ? (
                                <Text style={[styles.secretText, { color: currentTheme.text }]} selectable>{secretValue}</Text>
                            ) : (
                                <Text style={[styles.hiddenText, { color: currentTheme.textLight }]}>•••• •••• •••• •••• •••• •••• •••• ••••</Text>
                            )}
                            <TouchableOpacity style={styles.toggleBtn} onPress={() => setIsVisible(!isVisible)}>
                                <Ionicons name={isVisible ? "eye-off-outline" : "eye-outline"} size={24} color={currentTheme.text} />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity style={[styles.copyBtn, { borderColor: currentTheme.border }]} onPress={handleCopy}>
                            <Ionicons name="copy-outline" size={20} color={currentTheme.text} style={{ marginRight: 8 }} />
                            <Text style={[styles.copyBtnText, { color: currentTheme.text }]}>Copy to Clipboard</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.doneBtn, { backgroundColor: currentTheme.text }]} onPress={() => {
                            if (navigation.canGoBack()) {
                                navigation.goBack();
                            } else {
                                navigation.navigate('Settings' as any);
                            }
                        }}>
                            <Text style={[styles.doneBtnText, { color: currentTheme.primary }]}>Done</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
    tabWrapper: { height: 40, marginBottom: 24 },
    tabRow: { flexDirection: 'row', justifyContent: 'center' },
    tabBtn: { paddingVertical: 8, paddingHorizontal: 16, marginHorizontal: 4 },
    tabText: { fontSize: 16, fontWeight: '600' },
    revealSection: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
    warningTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
    warningText: { fontSize: 14, textAlign: 'center', marginBottom: 32, lineHeight: 20 },
    revealBtn: { paddingVertical: 18, paddingHorizontal: 40, borderRadius: 16 },
    revealBtnText: { fontSize: 16, fontWeight: 'bold' },
    secretCard: { flex: 1 },
    warningSubText: { fontSize: 14, marginBottom: 24, lineHeight: 20 },
    secretBox: { borderWidth: 1, borderRadius: 16, padding: 20, minHeight: 120, justifyContent: 'center', marginBottom: 16 },
    secretText: { fontSize: 16, lineHeight: 24, paddingRight: 32 },
    hiddenText: { fontSize: 24, letterSpacing: 2, paddingRight: 32 },
    toggleBtn: { position: 'absolute', right: 16, bottom: 16, padding: 4 },
    copyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1, marginBottom: 24 },
    copyBtnText: { fontSize: 16, fontWeight: '600' },
    doneBtn: { paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
    doneBtnText: { fontSize: 16, fontWeight: 'bold' },
});

export default ShowSecretScreen;
