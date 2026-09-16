import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity,
  Alert, ScrollView, Share, FlatList,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { useWallet } from '../context/WalletContext';
import { useNetwork } from '../context/NetworkContext';
import { useTheme } from '../context/ThemeContext';
import { InvoiceService, PaymentMode, PaymentFrequency, InvoiceHistoryItem } from '../services/invoiceService';
import { ZeroAlphaService } from '../services/zeroAlphaService';
import Header from '../components/Header';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, any> };

const FREQUENCIES: { label: string; value: PaymentFrequency }[] = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Annually', value: 'annually' },
  { label: 'Custom', value: 'custom' },
];

const CreateInvoiceScreen: React.FC<Props> = ({ navigation }) => {
  const { wallet } = useWallet();
  const { network } = useNetwork();
  const { currentTheme: t } = useTheme();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<PaymentMode>('payment');
  const [frequency, setFrequency] = useState<PaymentFrequency>('monthly');
  const [customDays, setCustomDays] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [tab, setTab] = useState<'create' | 'history'>('create');
  const [history, setHistory] = useState<InvoiceHistoryItem[]>([]);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    loadHistory();
    ZeroAlphaService.getStoredUser().then((u) => { if (u) setUserEmail(u.email); });
  }, []);

  const loadHistory = async () => {
    const h = await InvoiceService.getHistory();
    setHistory(h);
  };

  const handleGenerate = async () => {
    if (!amount || parseFloat(amount) <= 0) { Alert.alert('Error', 'Enter a valid amount'); return; }
    if (!description.trim()) { Alert.alert('Error', 'Enter a description'); return; }
    if (!wallet) { Alert.alert('Error', 'No wallet connected'); return; }
    if (mode === 'subscription' && frequency === 'custom' && (!customDays || parseInt(customDays) <= 0)) {
      Alert.alert('Error', 'Enter valid number of days'); return;
    }

    const result = InvoiceService.createInvoiceUrl({
      amount: parseFloat(amount),
      description: description.trim(),
      mode,
      frequency: mode === 'subscription' ? frequency : undefined,
      customDays: frequency === 'custom' ? parseInt(customDays) : undefined,
      autoRenew: mode === 'subscription',
      recipientAddress: wallet.publicKey.toBase58(),
      network: network as 'mainnet-beta' | 'devnet',
    });

    setGeneratedUrl(result.url);
    await InvoiceService.saveToHistory({
      trackingId: result.trackingId,
      url: result.url,
      amount: parseFloat(amount),
      description: description.trim(),
      mode,
      frequency: mode === 'subscription' ? (frequency === 'custom' ? `${customDays} days` : frequency) : undefined,
      createdAt: Date.now(),
      userEmail: userEmail || undefined,
    });
    loadHistory();
  };

  const handleCopy = async (url?: string) => {
    await Clipboard.setStringAsync(url || generatedUrl);
    Alert.alert('Copied!', 'Payment link copied');
  };

  const handleShare = async () => {
    await Share.share({ message: generatedUrl });
  };

  const renderHistory = () => (
    <FlatList
      data={history}
      keyExtractor={(item) => item.trackingId}
      ListEmptyComponent={<Text style={[st.emptyText, { color: t.textLight }]}>No invoices yet</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity style={[st.historyItem, { borderBottomColor: t.border }]} onPress={() => handleCopy(item.url)}>
          <View style={st.historyLeft}>
            <Text style={[st.historyDesc, { color: t.text }]} numberOfLines={1}>{item.description}</Text>
            <Text style={[st.historyMeta, { color: t.textLight }]}>${item.amount} • {item.mode === 'subscription' ? item.frequency : 'one-time'} • {new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
          <Ionicons name="copy-outline" size={18} color={t.textLight} />
        </TouchableOpacity>
      )}
    />
  );

  return (
    <SafeAreaView style={[st.container, { backgroundColor: t.primary }]}>
      <Header title="Invoices" showBack onBackPress={() => navigation.goBack()} showAddress={false} />

      {/* Tabs */}
      <View style={[st.tabBar, { borderBottomColor: t.border }]}>
        <TouchableOpacity onPress={() => setTab('create')}>
          <Text style={[st.tabText, { color: t.textLight }, tab === 'create' && { color: t.text }]}>Create</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('history')}>
          <Text style={[st.tabText, { color: t.textLight }, tab === 'history' && { color: t.text }]}>History</Text>
        </TouchableOpacity>
      </View>

      {tab === 'history' ? (
        <View style={st.content}>{renderHistory()}</View>
      ) : (
        <ScrollView style={st.content} showsVerticalScrollIndicator={false}>
          {!generatedUrl ? (
            <>
              <Text style={[st.label, { color: t.textLight }]}>Payment Type</Text>
              <View style={st.modeRow}>
                <TouchableOpacity
                  style={[st.modeBtn, { borderColor: t.border, backgroundColor: t.card }, mode === 'payment' && { backgroundColor: t.text, borderColor: t.text }]}
                  onPress={() => setMode('payment')}
                >
                  <Text style={[st.modeBtnText, { color: t.textLight }, mode === 'payment' && { color: t.primary }]}>One-time</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.modeBtn, { borderColor: t.border, backgroundColor: t.card }, mode === 'subscription' && { backgroundColor: t.text, borderColor: t.text }]}
                  onPress={() => setMode('subscription')}
                >
                  <Text style={[st.modeBtnText, { color: t.textLight }, mode === 'subscription' && { color: t.primary }]}>Recurring</Text>
                </TouchableOpacity>
              </View>

              {mode === 'subscription' && (
                <>
                  <Text style={[st.label, { color: t.textLight }]}>Frequency</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.freqScroll}>
                    {FREQUENCIES.map((f) => (
                      <TouchableOpacity
                        key={f.value}
                        style={[st.freqChip, { borderColor: t.border, backgroundColor: t.card }, frequency === f.value && { backgroundColor: t.text, borderColor: t.text }]}
                        onPress={() => setFrequency(f.value)}
                      >
                        <Text style={[st.freqChipText, { color: t.textLight }, frequency === f.value && { color: t.primary }]}>{f.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {frequency === 'custom' && (
                    <TextInput
                      style={[st.input, { backgroundColor: t.card, borderColor: t.border, color: t.text }]}
                      placeholder="Number of days"
                      placeholderTextColor={t.textLight}
                      keyboardType="number-pad"
                      value={customDays}
                      onChangeText={setCustomDays}
                    />
                  )}
                </>
              )}

              <Text style={[st.label, { color: t.textLight }]}>Amount (USDC)</Text>
              <TextInput
                style={[st.input, { backgroundColor: t.card, borderColor: t.border, color: t.text }]}
                placeholder="0.00"
                placeholderTextColor={t.textLight}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />

              <Text style={[st.label, { color: t.textLight }]}>Description</Text>
              <TextInput
                style={[st.input, { backgroundColor: t.card, borderColor: t.border, color: t.text }]}
                placeholder="What is this payment for?"
                placeholderTextColor={t.textLight}
                value={description}
                onChangeText={setDescription}
              />

              <Text style={[st.networkHint, { color: t.textLight }]}>{network === 'devnet' ? '⚠️ Devnet mode' : '🟢 Mainnet'}</Text>

              <TouchableOpacity style={[st.generateBtn, { backgroundColor: t.text }]} onPress={handleGenerate}>
                <Text style={[st.generateBtnText, { color: t.primary }]}>Generate Payment Link</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={st.resultSection}>
              <Ionicons name="checkmark-circle" size={48} color="#22C55E" style={{ alignSelf: 'center', marginBottom: 16 }} />
              <Text style={[st.resultTitle, { color: t.text }]}>Invoice Created</Text>
              <Text style={[st.resultDesc, { color: t.textLight }]}>{description} — ${amount} USDC {mode === 'subscription' ? `(${frequency === 'custom' ? customDays + ' days' : frequency})` : ''}</Text>

              <View style={[st.urlBox, { backgroundColor: t.card, borderColor: t.border }]}>
                <Text style={[st.urlText, { color: t.text }]} numberOfLines={3}>{generatedUrl}</Text>
              </View>

              <TouchableOpacity style={[st.actionBtn, { borderColor: t.border }]} onPress={() => handleCopy()}>
                <Ionicons name="copy-outline" size={20} color={t.text} />
                <Text style={[st.actionBtnText, { color: t.text }]}>Copy Link</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[st.actionBtn, { borderColor: t.border }]} onPress={handleShare}>
                <Ionicons name="share-outline" size={20} color={t.text} />
                <Text style={[st.actionBtnText, { color: t.text }]}>Share</Text>
              </TouchableOpacity>

              <TouchableOpacity style={st.newBtn} onPress={() => { setGeneratedUrl(''); setAmount(''); setDescription(''); }}>
                <Text style={[st.newBtnText, { color: t.textLight }]}>Create Another</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const st = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 24 },
  tabBar: { flexDirection: 'row', gap: 20, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1 },
  tabText: { fontSize: 16, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 20 },
  input: { borderWidth: 1, borderRadius: 14, padding: 16, fontSize: 16 },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  modeBtnText: { fontSize: 15, fontWeight: '600' },
  freqScroll: { marginBottom: 4 },
  freqChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  freqChipText: { fontSize: 14 },
  networkHint: { fontSize: 12, marginTop: 16 },
  generateBtn: { paddingVertical: 18, borderRadius: 16, alignItems: 'center', marginTop: 32 },
  generateBtnText: { fontSize: 16, fontWeight: 'bold' },
  resultSection: { paddingTop: 20 },
  resultTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  resultDesc: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  urlBox: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 20 },
  urlText: { fontSize: 13, fontFamily: 'monospace' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10, gap: 8 },
  actionBtnText: { fontSize: 15, fontWeight: '600' },
  newBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 14 },
  newBtnText: { fontSize: 15, fontWeight: '600' },
  historyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1 },
  historyLeft: { flex: 1 },
  historyDesc: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  historyMeta: { fontSize: 13 },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 40 },
});

export default CreateInvoiceScreen;
