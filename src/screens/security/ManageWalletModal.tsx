import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
    Alert,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { useWallet, WalletEntry } from '../../context/WalletContext';
import { useTheme } from '../../context/ThemeContext';
import colors from '../../constants/colors';
import * as Clipboard from 'expo-clipboard';

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'ManageWalletModal'>;
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const ManageWalletModal: React.FC<Props> = ({ navigation }) => {
    const { currentTheme } = useTheme();
    const { wallet, wallets, activeWalletId, switchWallet, createWallet, removeWallet } = useWallet();
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const backdropAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
            Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        ]).start();
    }, []);

    const dismiss = () => {
        Animated.parallel([
            Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 200, useNativeDriver: true }),
            Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => navigation.goBack());
    };

    const handleCopyAddress = async () => {
        if (wallet) {
            await Clipboard.setStringAsync(wallet.publicKey.toBase58());
            Alert.alert('Copied!', 'Wallet address copied.');
        }
    };

    const handleCreateNew = async () => {
        await createWallet();
        Alert.alert('Done', 'New wallet created and activated.');
    };

    const handleSwitch = async (entry: WalletEntry) => {
        if (entry.id === activeWalletId) return;
        await switchWallet(entry.id);
        dismiss();
    };

    const handleRemove = (entry: WalletEntry) => {
        if (wallets.length <= 1) {
            Alert.alert('Cannot Remove', 'You need at least one wallet.');
            return;
        }
        Alert.alert('Remove Wallet', `Remove "${entry.name}"? Make sure you have the recovery phrase backed up.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => removeWallet(entry.id) },
        ]);
    };

    if (!wallet) return null;

    return (
        <View style={styles.outerContainer} pointerEvents="box-none">
            <Animated.View style={[styles.backdrop, { opacity: backdropAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }) }]}>
                <TouchableOpacity style={styles.flex1} activeOpacity={1} onPress={dismiss} />
            </Animated.View>

            <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }], backgroundColor: currentTheme.primary }]}>
                <View style={[styles.handle, { backgroundColor: currentTheme.border }]} />
                <Text style={[styles.title, { color: currentTheme.text }]}>Manage Wallets</Text>

                {/* Wallet List */}
                <ScrollView style={styles.walletList} showsVerticalScrollIndicator={false}>
                    {wallets.map((entry) => (
                        <TouchableOpacity key={entry.id} style={[styles.walletItem, entry.id === activeWalletId && { backgroundColor: currentTheme.card }]} onPress={() => handleSwitch(entry)} onLongPress={() => handleRemove(entry)}>
                            <View style={styles.walletInfo}>
                                <Text style={[styles.walletName, { color: currentTheme.text }]}>{entry.name}</Text>
                                <Text style={[styles.walletAddr, { color: currentTheme.textLight }]}>{entry.address.slice(0, 6)}...{entry.address.slice(-4)}</Text>
                            </View>
                            {entry.id === activeWalletId && <Ionicons name="checkmark-circle" size={22} color={currentTheme.text} />}
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Actions */}
                <View style={[styles.actionsContainer, { borderTopColor: currentTheme.border }]}>
                    <TouchableOpacity style={styles.actionBtn} onPress={handleCreateNew}>
                        <Ionicons name="add-circle-outline" size={22} color={currentTheme.text} />
                        <Text style={[styles.actionText, { color: currentTheme.text }]}>Create New Wallet</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('ImportWallet' as any)}>
                        <Ionicons name="download-outline" size={22} color={currentTheme.text} />
                        <Text style={[styles.actionText, { color: currentTheme.text }]}>Import Wallet</Text>
                    </TouchableOpacity>

                    <View style={[styles.divider, { backgroundColor: currentTheme.border }]} />

                    <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('SecurityWarning', { type: 'mnemonic' })}>
                        <Ionicons name="shield-checkmark-outline" size={22} color={currentTheme.text} />
                        <Text style={[styles.actionText, { color: currentTheme.text }]}>Export Recovery Phrase</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('ShowSecret', { type: 'privateKey' } as any)}>
                        <Ionicons name="key-outline" size={22} color={currentTheme.text} />
                        <Text style={[styles.actionText, { color: currentTheme.text }]}>Export Private Key</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    outerContainer: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'black' },
    flex1: { flex: 1 },
    sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12, maxHeight: SCREEN_HEIGHT * 0.75 },
    handle: { width: 40, height: 4, backgroundColor: '#E0E0E0', borderRadius: 99, marginBottom: 20, alignSelf: 'center' },
    title: { fontSize: 20, fontWeight: 'bold', color: colors.black, marginBottom: 16 },
    walletList: { maxHeight: 180, marginBottom: 16 },
    walletItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4 },
    walletItemActive: { backgroundColor: '#F5F5F5' },
    walletInfo: { flex: 1 },
    walletName: { fontSize: 15, fontWeight: '600', color: colors.black },
    walletAddr: { fontSize: 12, color: colors.gray, marginTop: 2 },
    actionsContainer: { borderTopWidth: 1, borderTopColor: '#EFEFEF', paddingTop: 12 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
    actionText: { fontSize: 15, fontWeight: '500', color: colors.black, marginLeft: 12 },
    divider: { height: 1, backgroundColor: '#EFEFEF', marginVertical: 4 },
});

export default ManageWalletModal;
