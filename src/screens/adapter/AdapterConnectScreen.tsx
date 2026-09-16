import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
    Linking,
    DeviceEventEmitter,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../types/navigation';
import { useWallet } from '../../context/WalletContext';
import colors from '../../constants/colors';

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'AdapterConnect'>;
    route: RouteProp<RootStackParamList, 'AdapterConnect'>;
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const AdapterConnectScreen: React.FC<Props> = ({ navigation, route }) => {
    const { wallet } = useWallet();
    const { callback, id } = route.params;
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    // Guard: only one of approve/reject can fire — prevents backdrop tap from
    // sending rejected status AFTER the user has already tapped Connect.
    const handled = useRef(false);

    let requestingHost = '';
    try {
        requestingHost = new URL(callback).hostname;
    } catch {
        requestingHost = callback;
    }

    useEffect(() => {
        // Use a slightly faster animation without spring bounce to prevent shadow glitches
        Animated.timing(slideAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
        }).start();
    }, []);

    const dismiss = (callbackUrl?: string) => {
        Animated.timing(slideAnim, {
            toValue: SCREEN_HEIGHT,
            duration: 200,
            useNativeDriver: true,
        }).start(() => {
            if (callbackUrl) {
                DeviceEventEmitter.emit('zeroWalletCallback', callbackUrl);
            }
            navigation.goBack();
        });
    };

    const handleApprove = () => {
        if (!wallet || handled.current) return;
        handled.current = true;
        const redirectUrl = new URL(callback);
        redirectUrl.searchParams.set('id', id);
        redirectUrl.searchParams.set('status', 'approved');
        redirectUrl.searchParams.set('publicKey', wallet.publicKey.toBase58());
        dismiss(redirectUrl.toString());
    };

    const handleReject = () => {
        if (handled.current) return;  // already handled — ignore
        handled.current = true;
        const redirectUrl = new URL(callback);
        redirectUrl.searchParams.set('id', id);
        redirectUrl.searchParams.set('status', 'rejected');
        redirectUrl.searchParams.set('error', 'User Cancelled');
        dismiss(redirectUrl.toString());
    };

    return (
        <View style={styles.overlay} pointerEvents="box-none">
            {/* Tap backdrop to reject */}
            <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleReject} />

            {/* Slide-up bottom sheet */}
            <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
                {/* Handle bar */}
                <View style={styles.handle} />

                {/* Header Information */}
                <Text style={styles.title}>{requestingHost}</Text>
                <Text style={styles.host}>{callback}</Text>

                {/* Permissions Block */}
                <Text style={styles.permissionsHeader}>This app would like to:</Text>
                <View style={styles.permissionsContainer}>
                    <View style={styles.permissionItem}>
                        <Ionicons name="checkmark-circle" size={20} color={colors.black} style={styles.permissionIcon} />
                        <Text style={styles.permissionText}>View activity and wallet balance</Text>
                    </View>
                    <View style={styles.permissionItem}>
                        <Ionicons name="checkmark-circle" size={20} color={colors.black} style={styles.permissionIcon} />
                        <Text style={styles.permissionText}>Request approval for transactions</Text>
                    </View>
                    <View style={styles.permissionItem}>
                        <Ionicons name="close-circle" size={20} color={colors.black} style={styles.permissionIcon} />
                        <Text style={styles.permissionText}>Cannot access funds without your permission</Text>
                    </View>
                </View>

                {/* Account Info */}
                <View style={styles.accountRow}>
                    <Text style={styles.accountLabel}>Account:</Text>
                    <View style={styles.walletAddressContainer}>
                        <Text style={styles.walletAddress}>
                            {wallet?.publicKey.toBase58().slice(0, 6)}...{wallet?.publicKey.toBase58().slice(-4)}
                        </Text>
                    </View>
                </View>

                {/* Actions */}
                <View style={styles.actions}>
                    <TouchableOpacity style={styles.btnReject} onPress={handleReject}>
                        <Text style={styles.btnRejectText}>Close</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnApprove} onPress={handleApprove}>
                        <Text style={styles.btnApproveText}>Confirm</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.4)', // Slightly lighter to reduce shadow flash
    },
    backdrop: {
        flex: 1,
    },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingBottom: 40,
        paddingTop: 12,
        alignItems: 'center',
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: '#E0E0E0',
        borderRadius: 99,
        marginBottom: 24,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: colors.black,
        marginBottom: 4,
        textAlign: 'center',
    },
    host: {
        fontSize: 14,
        color: colors.gray,
        marginBottom: 24,
        textAlign: 'center',
    },
    permissionsHeader: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.black,
        width: '100%',
        marginBottom: 12,
    },
    permissionsContainer: {
        width: '100%',
        backgroundColor: '#F9F9F9',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#EFEFEF',
    },
    permissionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    permissionIcon: {
        marginRight: 10,
        width: 20,
        textAlign: 'center',
    },
    permissionText: {
        fontSize: 14,
        color: '#333',
        flex: 1,
        lineHeight: 20,
    },
    accountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 8,
        marginBottom: 32,
    },
    accountLabel: {
        fontSize: 16,
        color: colors.black,
        fontWeight: '600',
    },
    walletAddressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F3F3',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    walletAddress: {
        fontFamily: 'sans-serif',
        fontSize: 14,
        color: colors.black,
        fontWeight: '500',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    btnReject: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#E0E0E0',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    btnRejectText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.black,
    },
    btnApprove: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 12,
        backgroundColor: colors.black,
        alignItems: 'center',
    },
    btnApproveText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});

export default AdapterConnectScreen;
