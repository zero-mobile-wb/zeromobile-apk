import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert, DeviceEventEmitter, Animated, Dimensions } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../types/navigation';
import { useWallet } from '../../context/WalletContext';
import colors from '../../constants/colors';
import { Linking } from 'react-native';
import { Transaction, VersionedTransaction, SystemProgram } from '@solana/web3.js';
import { Ionicons } from '@expo/vector-icons';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'AdapterSign'>;
    route: RouteProp<RootStackParamList, 'AdapterSign'>;
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Fix: Remove redundant decodeURIComponent. React Navigation's Linking integration 
// already decodes URI components for the route.params.
const decodeBase64 = (data: string): Uint8Array => {
    try {
        // If it's already a clean base64 string, Buffer.from handles it.
        // If it was somehow double-encoded, we try one decode, but the primary fix is removing the mandatory one.
        return new Uint8Array(Buffer.from(data, 'base64'));
    } catch (e) {
        // Fallback just in case of non-standard behavior in some environments
        return new Uint8Array(Buffer.from(decodeURIComponent(data), 'base64'));
    }
};

const AdapterSignScreen: React.FC<Props> = ({ navigation, route }) => {
    const { wallet, connection } = useWallet();
    const params = route.params as any;
    const { callback, id, network, tx, txs, msg, isInternal } = params;

    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const handled = useRef(false);

    let type = '';
    let payload = '';

    if (tx) {
        type = 'signTransaction';
        payload = tx;
    } else if (txs) {
        type = 'signAll';
        payload = txs;
    } else if (msg) {
        type = 'signMessage';
        payload = msg;
    }

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [txDetails, setTxDetails] = useState<any[]>([]);
    const [balanceChanges, setBalanceChanges] = useState<any[]>([]);
    const [messageToSign, setMessageToSign] = useState<string | null>(null);

    // Slide up on mount
    useEffect(() => {
        Animated.timing(slideAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
        }).start();
    }, []);

    const parseChanges = (txs: any[]) => {
        const changes: any[] = [];
        txs.forEach(transaction => {
            try {
                if ('version' in transaction) {
                    transaction.message.compiledInstructions.forEach((ix: any) => {
                        const progId = transaction.message.staticAccountKeys[ix.programIdIndex];
                        const data = ix.data;

                        if (progId.equals(SystemProgram.programId)) {
                            if (data[0] === 2) {
                                const amount = new DataView(data.buffer, data.byteOffset + 1, 8).getBigUint64(0, true);
                                changes.push({ type: 'SOL', amount: Number(amount) / 1e9, label: 'YOU PAY', isDeduction: true });
                            }
                        } else if (progId.equals(TOKEN_PROGRAM_ID)) {
                            if (data[0] === 3 || data[0] === 12) {
                                const amount = new DataView(data.buffer, data.byteOffset + 1, 8).getBigUint64(0, true);
                                changes.push({ type: 'Token', amount: Number(amount) / 1e6, label: 'YOU PAY', isDeduction: true });
                            }
                        }
                    });
                } else {
                    transaction.instructions.forEach((ix: any) => {
                        const data = ix.data;
                        if (ix.programId.equals(SystemProgram.programId)) {
                            if (data[0] === 2) {
                                const amount = new DataView(data.buffer, data.byteOffset + 1, 8).getBigUint64(0, true);
                                changes.push({ type: 'SOL', amount: Number(amount) / 1e9, label: 'YOU PAY', isDeduction: true });
                            }
                        } else if (ix.programId.equals(TOKEN_PROGRAM_ID)) {
                            if (data[0] === 3 || data[0] === 12) {
                                const amount = new DataView(data.buffer, data.byteOffset + 1, 8).getBigUint64(0, true);
                                changes.push({ type: 'Token', amount: Number(amount) / 1e6, label: 'YOU PAY', isDeduction: true });
                            }
                        }
                    });
                }
            } catch (e) {
                console.warn('Failed to parse changes', e);
            }
        });
        setBalanceChanges(changes);
    };

    // Parse payloads on mount
    useEffect(() => {
        try {
            if (type === 'signTransaction') {
                const buffer = decodeBase64(payload);
                try {
                    const transaction = VersionedTransaction.deserialize(buffer);
                    setTxDetails([transaction]);
                    parseChanges([transaction]);
                } catch (e) {
                    const transaction = Transaction.from(buffer);
                    setTxDetails([transaction]);
                    parseChanges([transaction]);
                }
            } else if (type === 'signAll') {
                const rawTxs = JSON.parse(decodeURIComponent(payload)) as string[];
                const parsedTxs = rawTxs.map(txBase64 => {
                    const buffer = decodeBase64(txBase64);
                    try {
                        return VersionedTransaction.deserialize(buffer);
                    } catch (e) {
                        return Transaction.from(buffer);
                    }
                });
                setTxDetails(parsedTxs);
                parseChanges(parsedTxs);
            } else if (type === 'signMessage') {
                const buffer = decodeBase64(payload);
                setMessageToSign(Buffer.from(buffer).toString('utf-8'));
            }
        } catch (err: any) {
            console.error('Parsing error:', err);
            setError('Failed to parse transaction data.');
        } finally {
            setLoading(false);
        }
    }, [type, payload]);

    let requestingUrl = '';
    try {
        requestingUrl = new URL(callback).hostname;
    } catch {
        requestingUrl = callback || 'Unknown App';
    }

    const dismiss = (redirectUrl?: string) => {
        Animated.timing(slideAnim, {
            toValue: SCREEN_HEIGHT,
            duration: 200,
            useNativeDriver: true,
        }).start(() => {
            if (redirectUrl) {
                if (isInternal) {
                    DeviceEventEmitter.emit('zeroWalletCallback', redirectUrl);
                } else {
                    Linking.openURL(redirectUrl)
                        .catch(err => console.error('Failed to open callbackURL:', err));
                }
            }
            navigation.goBack();
        });
    };

    const handleApprove = async () => {
        if (!wallet || handled.current) return;
        handled.current = true;
        setLoading(true);

        try {
            const redirectUrl = new URL(callback);
            redirectUrl.searchParams.append('id', id);
            redirectUrl.searchParams.append('status', 'approved');

            if (type === 'signTransaction' || type === 'signAll') {
                const signedTxsBase64: string[] = [];

                for (const tx of txDetails) {
                    if ('version' in tx) {
                        tx.sign([wallet]);
                        signedTxsBase64.push(Buffer.from(tx.serialize()).toString('base64'));
                    } else {
                        const typedTx = tx as Transaction;
                        if (!typedTx.recentBlockhash) {
                            const latest = await connection.getLatestBlockhash();
                            typedTx.recentBlockhash = latest.blockhash;
                            typedTx.lastValidBlockHeight = latest.lastValidBlockHeight;
                        }
                        if (!typedTx.feePayer) {
                            typedTx.feePayer = wallet.publicKey;
                        }
                        typedTx.partialSign(wallet);
                        signedTxsBase64.push(Buffer.from(typedTx.serialize({ requireAllSignatures: false })).toString('base64'));
                    }
                }

                if (type === 'signTransaction') {
                    redirectUrl.searchParams.append('signedTx', signedTxsBase64[0]);
                } else {
                    redirectUrl.searchParams.append('signedTxs', JSON.stringify(signedTxsBase64));
                }
            } else if (type === 'signMessage') {
                const buffer = decodeBase64(payload);
                const nacl = require('tweetnacl');
                const signature = nacl.sign.detached(buffer, wallet.secretKey);
                redirectUrl.searchParams.append('signature', Buffer.from(signature).toString('base64'));
            }

            dismiss(redirectUrl.toString());

        } catch (err: any) {
            setLoading(false);
            handled.current = false;
            Alert.alert('Signing Error', err.message);
        }
    };

    const handleReject = () => {
        if (handled.current) return;
        handled.current = true;
        const redirectUrl = new URL(callback);
        redirectUrl.searchParams.append('id', id);
        redirectUrl.searchParams.append('status', 'rejected');
        redirectUrl.searchParams.append('error', 'User Cancelled');

        dismiss(redirectUrl.toString());
    };

    return (
        <View style={styles.overlay} pointerEvents="box-none">
            <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleReject} />

            <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
                <View style={styles.handle} />

                <Text style={styles.title}>Signature Request</Text>
                <Text style={styles.subtitle}>
                    <Text style={{ fontWeight: 'bold', color: colors.black }}>{requestingUrl}</Text> is requesting a signature.
                </Text>

                <View style={{ width: '100%', marginBottom: 24 }}>
                    {loading ? (
                        <ActivityIndicator size="large" color={colors.black} style={{ marginTop: 20 }} />
                    ) : error ? (
                        <View style={styles.errorBox}>
                            <Ionicons name="alert-circle" size={24} color="#CC0000" style={{ marginBottom: 8 }} />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : (
                        <View style={styles.detailsBox}>
                            <Text style={styles.detailsLabel}>TYPE</Text>
                            <Text style={styles.detailsValue}>
                                {type === 'signTransaction' ? 'Sign Single Transaction' : type === 'signAll' ? `Sign ${txDetails.length} Transactions` : 'Sign Message'}
                            </Text>

                            <View style={styles.separator} />

                            <Text style={styles.detailsLabel}>NETWORK</Text>
                            <Text style={styles.detailsValue}>{network || 'mainnet-beta'}</Text>

                            <View style={styles.separator} />

                            {type === 'signMessage' ? (
                                <>
                                    <Text style={styles.detailsLabel}>MESSAGE</Text>
                                    <ScrollView style={{ maxHeight: 150 }} showsVerticalScrollIndicator={false}>
                                        <Text style={styles.messageValue}>{messageToSign || 'Unable to decode raw message.'}</Text>
                                    </ScrollView>
                                </>
                            ) : (
                                <>
                                    <Text style={styles.detailsLabel}>PAYLOAD INFO</Text>
                                    <Text style={styles.detailsValue}>{txDetails.length} Transaction(s) to sign.</Text>

                                    {balanceChanges.length > 0 && (
                                        <>
                                            <View style={styles.separator} />
                                            <Text style={styles.detailsLabel}>ESTIMATED CHANGES</Text>
                                            {balanceChanges.map((change, idx) => (
                                                <View key={idx} style={styles.changeRowMinimal}>
                                                    <Text style={styles.changeLabelMinimal}>
                                                        {change.label}: <Text style={styles.changeTextMinimal}>{change.amount.toFixed(change.isNative ? 4 : 2)} {change.type === 'Token' ? 'USDC' : change.type}</Text>
                                                    </Text>
                                                </View>
                                            ))}
                                        </>
                                    )}
                                </>
                            )}
                        </View>
                    )}
                </View>

                <View style={styles.actions}>
                    <TouchableOpacity style={styles.btnReject} onPress={handleReject} disabled={loading}>
                        <Text style={styles.btnRejectText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.btnApprove, (loading || !!error) && { opacity: 0.5 }]}
                        onPress={handleApprove}
                        disabled={loading || !!error}
                    >
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnApproveText}>Approve</Text>}
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
        backgroundColor: 'rgba(0,0,0,0.4)',
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
        maxHeight: Dimensions.get('window').height * 0.85,
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
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 15,
        color: colors.gray,
        marginBottom: 24,
        textAlign: 'center',
        lineHeight: 22,
    },
    detailsBox: {
        backgroundColor: '#F9F9F9',
        padding: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#EFEFEF',
        width: '100%',
    },
    detailsLabel: {
        fontSize: 11,
        fontWeight: 'bold',
        color: colors.gray,
        marginBottom: 4,
        letterSpacing: 0.5,
    },
    detailsValue: {
        fontSize: 16,
        color: colors.black,
        fontWeight: '600',
    },
    networkBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    networkDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    messageValue: {
        fontSize: 14,
        color: colors.black,
        backgroundColor: '#F3F3F3',
        padding: 12,
        borderRadius: 12,
        marginTop: 4,
        fontFamily: 'sans-serif',
    },
    errorBox: {
        padding: 20,
        backgroundColor: '#FFF5F5',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#FFE0E0',
        alignItems: 'center',
        width: '100%',
    },
    errorText: {
        color: '#CC0000',
        fontSize: 14,
        textAlign: 'center',
        fontWeight: '500',
    },
    separator: {
        height: 1,
        backgroundColor: '#EFEFEF',
        marginVertical: 16,
    },
    changeRowMinimal: {
        marginTop: 6,
    },
    changeLabelMinimal: {
        fontSize: 14,
        color: colors.gray,
        fontWeight: '500',
    },
    changeTextMinimal: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.black,
        fontFamily: 'monospace',
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
        justifyContent: 'center',
    },
    btnApproveText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});

export default AdapterSignScreen;

