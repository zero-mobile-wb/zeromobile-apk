import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChainId, CHAINS, EVM_CHAINS } from '../services/chainService';
import { useWallet } from '../context/WalletContext';
import { useTheme } from '../context/ThemeContext';

const ChainSetupModal: React.FC = () => {
  const { unsupportedChains, setupEvmChain, dismissNewChains, isPrivyUser } = useWallet();
  const { currentTheme, themeId } = useTheme();
  const isDark = themeId === 'dark';
  const [settingUp, setSettingUp] = useState<ChainId | null>(null);

  // Keys-based chain setup only makes sense for key-created wallets. Privy
  // (social login) wallets are managed by Privy — showing the recovery-phrase
  // flow to those users is wrong, so the modal stays hidden for them.
  if (unsupportedChains.length === 0 || isPrivyUser) return null;

  const chainsToSetup = EVM_CHAINS.filter(c => unsupportedChains.includes(c.id));

  const handleSetup = async (chainId: ChainId) => {
    setSettingUp(chainId);
    try {
      await setupEvmChain(chainId);
    } catch (error) {
      console.error('Failed to setup chain:', error);
    } finally {
      setSettingUp(null);
    }
  };

  const handleSetupAll = async () => {
    for (const chain of chainsToSetup) {
      setSettingUp(chain.id);
      try {
        await setupEvmChain(chain.id);
      } catch (error) {
        console.error('Failed to setup chain:', error);
      }
    }
    setSettingUp(null);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismissNewChains}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: currentTheme.primary,
              borderTopColor: currentTheme.border,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -6 },
              shadowOpacity: isDark ? 0.4 : 0.12,
              shadowRadius: 16,
              elevation: 20,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: currentTheme.border }]} />
          <Ionicons name="layers-outline" size={36} color={currentTheme.text} />
          <Text style={[styles.title, { color: currentTheme.text }]}>New Chains Available</Text>
          <Text style={[styles.subtitle, { color: currentTheme.textLight }]}>
            Your wallet can now support additional blockchains. Set them up using your existing recovery phrase.
          </Text>

          <View style={styles.chainList}>
            {chainsToSetup.map(chain => (
              <View key={chain.id} style={[styles.chainRow, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
                <View style={styles.chainInfo}>
                  <View style={[styles.chainIcon, { backgroundColor: currentTheme.text }]}>
                    <Text style={[styles.chainIconText, { color: currentTheme.primary }]}>{chain.symbol[0]}</Text>
                  </View>
                  <View>
                    <Text style={[styles.chainName, { color: currentTheme.text }]}>{chain.name}</Text>
                    <Text style={[styles.chainDesc, { color: currentTheme.textLight }]}>{chain.symbol} Wallet</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.setupBtn, { backgroundColor: currentTheme.text }, settingUp === chain.id && styles.setupBtnDisabled]}
                  onPress={() => handleSetup(chain.id)}
                  disabled={settingUp !== null}
                  activeOpacity={0.85}
                >
                  {settingUp === chain.id ? (
                    <ActivityIndicator size="small" color={currentTheme.primary} />
                  ) : (
                    <Text style={[styles.setupBtnText, { color: currentTheme.primary }]}>Add</Text>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.setupAllBtn, { backgroundColor: currentTheme.text }, settingUp && styles.setupBtnDisabled]}
              onPress={handleSetupAll}
              disabled={settingUp !== null}
              activeOpacity={0.85}
            >
              <Text style={[styles.setupAllBtnText, { color: currentTheme.primary }]}>
                {settingUp ? 'Setting up...' : `Add All (${chainsToSetup.length})`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipBtn} onPress={dismissNewChains} activeOpacity={0.7}>
              <Text style={[styles.skipBtnText, { color: currentTheme.textLight }]}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    alignItems: 'center',
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 99,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: -0.4,
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  chainList: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  chainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    padding: 16,
    borderRadius: 16,
  },
  chainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chainIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chainIconText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  chainName: {
    fontSize: 16,
    fontWeight: '600',
  },
  chainDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  setupBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  setupBtnDisabled: {
    opacity: 0.5,
  },
  setupBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  setupAllBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  setupAllBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  skipBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipBtnText: {
    fontSize: 15,
    fontWeight: '500',
  },
});

export default ChainSetupModal;
