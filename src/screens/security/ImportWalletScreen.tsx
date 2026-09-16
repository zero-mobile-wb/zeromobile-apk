import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { useWallet } from '../../context/WalletContext';
import { useTheme } from '../../context/ThemeContext';
import Header from '../../components/Header';

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, any>;
};

const ImportWalletScreen: React.FC<Props> = ({ navigation }) => {
    const { importWallet } = useWallet();
    const { currentTheme, themeId } = useTheme();
    const isDark = themeId === 'dark';
    const [mnemonic, setMnemonic] = useState('');
    const [loading, setLoading] = useState(false);

    const handleImport = async () => {
        if (!mnemonic.trim()) {
            Alert.alert('Error', 'Please enter your recovery phrase');
            return;
        }
        setLoading(true);
        try {
            await importWallet(mnemonic.trim());
            navigation.navigate('Wallet');
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Invalid recovery phrase');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.primary }]}>
            <Header title="Import Wallet" showBack onBackPress={() => navigation.goBack()} showAddress={false} />
            <View style={styles.content}>
                <Text style={[styles.label, { color: currentTheme.textLight }]}>Enter your 12 or 24 word recovery phrase</Text>
                <TextInput
                    style={[
                        styles.input,
                        {
                            backgroundColor: isDark ? '#1E1E1E' : '#F9F9F9',
                            borderColor: isDark ? 'rgba(255,255,255,0.14)' : '#EFEFEF',
                            color: currentTheme.text,
                        },
                    ]}
                    placeholder="word1 word2 word3 ..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={mnemonic}
                    onChangeText={setMnemonic}
                />
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                    style={[styles.btn, { backgroundColor: currentTheme.text }]}
                    onPress={handleImport}
                    disabled={loading}
                >
                    {loading
                        ? <ActivityIndicator color={currentTheme.primary} />
                        : <Text style={[styles.btnText, { color: currentTheme.primary }]}>Import</Text>}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { flex: 1, padding: 24 },
    label: { fontSize: 14, marginBottom: 12 },
    input: { borderWidth: 1, borderRadius: 16, padding: 16, fontSize: 16, minHeight: 120, textAlignVertical: 'top' },
    btn: { paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
    btnText: { fontSize: 16, fontWeight: 'bold' },
});

export default ImportWalletScreen;
