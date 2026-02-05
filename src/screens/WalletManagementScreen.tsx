import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Modal,
  Animated,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { RootStackParamList } from '../types/navigation';

interface WalletManagementScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'WalletManagement'>;
}

const WalletManagementScreen: React.FC<WalletManagementScreenProps> = ({ navigation }) => {
  const { currentTheme } = useTheme();
  const { wallets, switchWallet, currentWalletIndex, createWallet } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const fadeAnim = useState(new Animated.Value(0))[0];

  const showToastNotification = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setShowToast(false));
  };

  const handleSwitchWallet = async (index: number) => {
    if (index === currentWalletIndex) {
      showToastNotification('This wallet is already active');
      return;
    }

    try {
      await switchWallet(index);
      showToastNotification('Wallet switched successfully');
      setTimeout(() => {
        navigation.goBack();
      }, 1500);
    } catch (error) {
      showToastNotification('Failed to switch wallet');
    }
  };

  const handleAddWallet = () => {
    setShowModal(true);
  };

  const handleCreateNewWallet = async () => {
    setShowModal(false);
    await createWallet();
    navigation.navigate('DisplaySeed');
  };

  const handleImportWallet = () => {
    setShowModal(false);
    navigation.navigate('ImportWallet');
  };

  const renderWallet = ({ item, index }: { item: any; index: number }) => {
    const isActive = currentWalletIndex === index;

    return (
      <TouchableOpacity
        style={[styles.walletCard, isActive && styles.activeWalletCard]}
        onPress={() => handleSwitchWallet(index)}
      >
        <View style={styles.walletCardContent}>
          <View style={styles.walletIconContainer}>
            <Ionicons
              name={isActive ? 'checkmark-circle' : 'wallet-outline'}
              size={40}
              color={isActive ? colors.black : colors.gray}
            />
          </View>
          <View style={styles.walletInfo}>
            <Text style={[styles.walletName, isActive && styles.activeText]}>
              {item.name}
            </Text>
            <Text style={styles.walletAddress}>
              {item.publicKey.slice(0, 12)}...{item.publicKey.slice(-12)}
            </Text>
            {isActive && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>ACTIVE</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.primary }]}>
      <Header
        title="Manage Wallets"
        showBack={true}
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.content}>
        {/* Wallet List */}
        <FlatList
          data={wallets}
          renderItem={renderWallet}
          keyExtractor={(item, index) => `${item.publicKey}-${index}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />

        {/* Toast Notification */}
        {showToast && (
          <Animated.View style={[styles.toast, { opacity: fadeAnim }]}>
            <Text style={styles.toastText}>{toastMessage}</Text>
          </Animated.View>
        )}

        {/* Add New Wallet Button */}
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.black }]}
          onPress={handleAddWallet}
        >
          <Ionicons name="add-circle-outline" size={24} color={colors.white} />
          <Text style={styles.addButtonText}>ADD NEW WALLET</Text>
        </TouchableOpacity>
      </View>

      {/* Modal for Create/Import */}
      <Modal
        visible={showModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Wallet</Text>
            <Text style={styles.modalSubtitle}>Choose how you want to add a wallet</Text>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleCreateNewWallet}
            >
              <Ionicons name="add-circle-outline" size={24} color={colors.black} />
              <Text style={styles.modalButtonText}>Create New Wallet</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.gray} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleImportWallet}
            >
              <Ionicons name="download-outline" size={24} color={colors.black} />
              <Text style={styles.modalButtonText}>Import Existing Wallet</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.gray} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listContent: {
    paddingTop: 20,
    paddingBottom: 20,
  },
  walletCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.lightGray,
  },
  activeWalletCard: {
    borderColor: colors.black,
    borderWidth: 2,
  },
  walletCardContent: {
    flexDirection: 'row',
    padding: 20,
    alignItems: 'center',
  },
  walletIconContainer: {
    marginRight: 16,
  },
  walletInfo: {
    flex: 1,
  },
  walletName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.secondary,
    marginBottom: 8,
  },
  activeText: {
    color: colors.black,
  },
  walletAddress: {
    fontSize: 12,
    color: colors.gray,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  activeBadge: {
    backgroundColor: colors.black,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  activeBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 30,
    marginBottom: 40,
    gap: 10,
  },
  addButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  toast: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: colors.black,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 50,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  toastText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.black,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.gray,
    marginBottom: 24,
    textAlign: 'center',
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightGray,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
  },
  modalButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.black,
    marginLeft: 16,
  },
  modalCancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray,
  },
});

export default WalletManagementScreen;
