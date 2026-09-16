import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity,
  Alert, ScrollView, Share, FlatList,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { useWallet } from '../context/WalletContext';
import { useNetwork } from '../context/NetworkContext';
import { InvoiceService, PaymentMode, PaymentFrequency, InvoiceHistoryItem } from '../services/invoiceService';
import Header from '../components/Header';
import colors from '../constants/colors';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

const BACKEND_URL = ((Constants.expoConfig?.extra?.backendUrl as string) || '').replace(/\/$/, '');

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, any> };

const FREQUENCIES: { label: string; value: PaymentFrequency }[] = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Annually', value: 'annually' },
  { label: 'Custom', value: 'custom' },
];

const BusinessScreen: React.FC<Props> = ({ navigation }) => {
  const { wallet } = useWallet();
  const { network } = useNetwork();
  const [tab, setTab] = useState<'invoices' | 'create'>('invoices');
  const [history, setHistory] = useState<InvoiceHistoryItem[]>([]);

  // Create form
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<PaymentMode>('payment');
  const [frequency, setFrequency] = useState<PaymentFrequency>('monthly');
  const [customDays, setCustomDays] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState('');

  useEffect(() => { loadHistory(); }, []);

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

    const historyItem: InvoiceHistoryItem = {
      trackingId: result.trackingId,
      url: result.url,
      amount: parseFloat(amount),
      description: description.trim(),
      mode,
      frequency: mode === 'subscription' ? (frequency === 'custom' ? `${customDays} days` : frequency) : undefined,
      createdAt: Date.now(),
    };

    await InvoiceService.saveToHistory(historyItem);

    // Sync to backend
    try {
      await fetch(`${BACKEND_URL}/api/invoices/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: wallet.publicKey.toBase58(),
          trackingId: result.trackingId,
          type: mode === 'subscription' ? 'recurring' : 'one_time',
          amount: parseFloat(amount),
          description: description.trim(),
          frequency: mode === 'subscription' ? frequency : null,
          customDays: frequency === 'custom' ? parseInt(customDays) : null,
          checkoutUrl: result.url,
          network,
        }),
      });
    } catch (e) {}

    loadHistory();
  };

  const handleCopy = async (url?: string) => {
    await Clipboard.setStringAsync(url || generatedUrl);
    Alert.alert('Copied!', 'Payment link copied');
  };

  const resetForm = () => { setGeneratedUrl(''); setAmount(''); setDescription(''); };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Business" showBack onBackPress={() => navigation.goBack()} showAddress={false} />

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity onPress={() => setTab('invoices')}>
          <Text style={[styles.tabText, tab === 'invoices' && styles.tabActive]}>Invoices</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setTab('create'); resetForm(); }}>
          <Text style={[styles.tabText, tab === 'create' && styles.tabActive]}>New</Text>
        </TouchableOpacity>
      </View>

      {tab === 'invoices' ? (
        <FlatList
          data={history}
          contentContainerStyle={styles.listContent}
          keyExtractor={(item) => item.trackingId}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={40} color="#E0E0E0" />
              <Text style={styles.emptyText}>No invoices yet</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setTab('create')}>
                <Text style={styles.emptyBtnText}>Create your first invoice</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.invoiceCard} onPress={() => handleCopy(item.url)}>
              <View style={styles.invoiceTop}>
                <Text style={styles.invoiceDesc} numberOfLines={1}>{item.description}</Text>
                <Text style={styles.invoiceAmount}>${item.amount}</Text>
              </View>
              <View style={styles.invoiceBottom}>
                <Text style={styles.invoiceMeta}>
                  {item.mode === 'subscription' ? `↻ ${item.frequency}` : '⚡ one-time'} • {new Date(item.createdAt).toLocaleDateString()}
                </Text>
                <Ionicons name="copy-outline" size={16} color={colors.gray} />
              </View>
            </TouchableOpacity>
          )}
        />
      ) : (
        <ScrollView style={styles.formContent} showsVerticalScrollIndicator={false}>
          {!generatedUrl ? (
            <>
              {/* Type */}
              <View style={styles.modeRow}>
                <TouchableOpacity style={[styles.modeBtn, mode === 'payment' && styles.modeBtnActive]} onPress={() => setMode('payment')}>
                  <Text style={[styles.modeBtnText, mode === 'payment' && styles.modeBtnTextActive]}>One-time</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modeBtn, mode === 'subscription' && styles.modeBtnActive]} onPress={() => setMode('subscription')}>
                  <Text style={[styles.modeBtnText, mode === 'subscription' && styles.modeBtnTextActive]}>Recurring</Text>
                </TouchableOpacity>
              </View>

              {mode === 'subscription' && (
                <>
                  <Text style={styles.label}>Billing cycle</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {FREQUENCIES.map((f) => (
                      <TouchableOpacity key={f.value} style={[styles.chip, frequency === f.value && styles.chipActive]} onPress={() => setFrequency(f.value)}>
                        <Text style={[styles.chipText, frequency === f.value && styles.chipTextActive]}>{f.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {frequency === 'custom' && (
                    <TextInput style={styles.input} placeholder="Every X days" placeholderTextColor={colors.gray} keyboardType="number-pad" value={customDays} onChangeText={setCustomDays} />
                  )}
                </>
              )}

              <Text style={styles.label}>Amount</Text>
              <TextInput style={styles.input} placeholder="$0.00 USDC" placeholderTextColor={colors.gray} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />

              <Text style={styles.label}>Description</Text>
              <TextInput style={styles.input} placeholder="Invoice for..." placeholderTextColor={colors.gray} value={description} onChangeText={setDescription} />

              <TouchableOpacity style={styles.createBtn} onPress={handleGenerate}>
                <Text style={styles.createBtnText}>Create Invoice</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.successSection}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark" size={28} color="#fff" />
              </View>
              <Text style={styles.successTitle}>Invoice ready</Text>
              <Text style={styles.successDesc}>{description} — ${amount} USDC</Text>

              <View style={styles.urlBox}>
                <Text style={styles.urlText} numberOfLines={2}>{generatedUrl}</Text>
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleCopy()}>
                  <Ionicons name="copy-outline" size={20} color={colors.black} />
                  <Text style={styles.actionText}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => Share.share({ message: generatedUrl })}>
                  <Ionicons name="share-outline" size={20} color={colors.black} />
                  <Text style={styles.actionText}>Share</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.newInvoiceBtn} onPress={resetForm}>
                <Text style={styles.newInvoiceText}>+ New invoice</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  tabBar: { flexDirection: 'row', gap: 24, paddingHorizontal: 24, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  tabText: { fontSize: 16, fontWeight: '600', color: colors.gray },
  tabActive: { color: colors.black },
  listContent: { padding: 24, paddingTop: 12 },
  formContent: { flex: 1, padding: 24 },

  // Invoice cards
  invoiceCard: { backgroundColor: '#FAFAFA', borderRadius: 14, padding: 16, marginBottom: 10 },
  invoiceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  invoiceDesc: { fontSize: 15, fontWeight: '600', color: colors.black, flex: 1, marginRight: 12 },
  invoiceAmount: { fontSize: 16, fontWeight: '700', color: colors.black },
  invoiceBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  invoiceMeta: { fontSize: 13, color: colors.gray },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: colors.gray, marginTop: 12, marginBottom: 20 },
  emptyBtn: { backgroundColor: colors.black, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Form
  label: { fontSize: 13, fontWeight: '600', color: colors.gray, marginBottom: 8, marginTop: 20 },
  input: { backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: '#EFEFEF', borderRadius: 12, padding: 16, fontSize: 16, color: colors.black },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#EFEFEF', alignItems: 'center' },
  modeBtnActive: { backgroundColor: colors.black, borderColor: colors.black },
  modeBtnText: { fontSize: 15, fontWeight: '600', color: colors.gray },
  modeBtnTextActive: { color: '#fff' },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#EFEFEF', marginRight: 8 },
  chipActive: { backgroundColor: colors.black, borderColor: colors.black },
  chipText: { fontSize: 13, color: colors.gray },
  chipTextActive: { color: '#fff' },
  createBtn: { backgroundColor: colors.black, paddingVertical: 18, borderRadius: 14, alignItems: 'center', marginTop: 32 },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Success
  successSection: { alignItems: 'center', paddingTop: 24 },
  successIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successTitle: { fontSize: 20, fontWeight: '700', color: colors.black, marginBottom: 6 },
  successDesc: { fontSize: 14, color: colors.gray, marginBottom: 24 },
  urlBox: { width: '100%', backgroundColor: '#F9F9F9', borderRadius: 12, padding: 14, marginBottom: 20 },
  urlText: { fontSize: 12, color: colors.black, fontFamily: 'monospace' },
  actionsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1, borderColor: '#EFEFEF' },
  actionText: { fontSize: 14, fontWeight: '600', color: colors.black },
  newInvoiceBtn: { paddingVertical: 12 },
  newInvoiceText: { fontSize: 15, fontWeight: '600', color: colors.gray },
});

export default BusinessScreen;
