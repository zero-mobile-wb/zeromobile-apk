import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '../context/WalletContext';
import { useTheme } from '../context/ThemeContext';
import colors from '../constants/colors';
import { RootStackParamList } from '../types/navigation';

interface DisplaySeedScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'DisplaySeed'>;
}

const DisplaySeedScreen: React.FC<DisplaySeedScreenProps> = ({ navigation }) => {
  const { currentTheme } = useTheme();
  const { mnemonic, confirmWalletSaved } = useWallet();

  const words = mnemonic?.split(' ') || [];

  const handleCopyToClipboard = async () => {
    if (mnemonic) {
      await Clipboard.setStringAsync(mnemonic);
      Alert.alert('Copied!', 'Recovery phrase copied to clipboard');
    }
  };

  const handleSaveKeyPhrase = () => {
    // User confirms they've saved the key phrase
    Alert.alert(
      'Important',
      'Make sure you have saved your recovery phrase. You will need it to recover your wallet.',
      [
        { text: 'Go Back', style: 'cancel' },
        {
          text: 'I Saved It',
          onPress: async () => {
            await confirmWalletSaved();
            navigation.navigate('Wallet');
          },
        },
      ]
    );
  };

  const handleDoLater = () => {
    Alert.alert(
      'Warning',
      'You can access your recovery phrase later from Settings. Make sure to save it before receiving any funds.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: async () => {
            await confirmWalletSaved();
            navigation.navigate('Wallet');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.primary }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Warning Section */}
        <View style={styles.warningContainer}>
          <Ionicons name="warning" size={48} color={colors.black} />
          <Text style={[styles.title, { color: colors.black }]}>
            SAVE YOUR RECOVERY PHRASE
          </Text>
          <Text style={[styles.subtitle, { color: currentTheme.textLight }]}>
            Write down these 12 words in order and store them safely. You'll need them to recover
            your wallet.
          </Text>
        </View>

        {/* Seed Phrase Grid */}
        <View style={[styles.mnemonicContainer, { borderColor: colors.black }]}>
          <View style={styles.mnemonicGrid}>
            {words.map((word, index) => (
              <View key={index} style={styles.wordContainer}>
                <Text style={[styles.wordNumber, { color: currentTheme.textLight }]}>
                  {index + 1}.
                </Text>
                <Text style={[styles.word, { color: colors.black }]}>{word}</Text>
              </View>
            ))}
          </View>

          {/* Copy Button */}
          <TouchableOpacity style={styles.copyButton} onPress={handleCopyToClipboard}>
            <Ionicons name="copy-outline" size={20} color={colors.black} />
            <Text style={[styles.copyButtonText, { color: colors.black }]}>
              COPY TO CLIPBOARD
            </Text>
          </TouchableOpacity>
        </View>

        {/* Warning Text */}
        <View style={[styles.warningBox, { backgroundColor: colors.black + '15' }]}>
          <Ionicons
            name="shield-checkmark"
            size={24}
            color={colors.black}
            style={styles.warningIcon}
          />
          <View style={styles.warningTextContainer}>
            <Text style={[styles.warningTitle, { color: colors.black }]}>
              NEVER SHARE YOUR RECOVERY PHRASE
            </Text>
            <Text style={[styles.warningText, { color: currentTheme.textLight }]}>
              Anyone with these words can access your wallet and steal your funds.
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.black }]}
            onPress={handleSaveKeyPhrase}
          >
            <Text style={styles.primaryButtonText}>I'VE SAVED MY KEY PHRASE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.black }]}
            onPress={handleDoLater}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.black }]}>
              I'LL DO THIS LATER
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  warningContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  mnemonicContainer: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  mnemonicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  wordContainer: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  wordNumber: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
    width: 24,
  },
  word: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 12,
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  warningBox: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
  },
  warningIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 12,
    lineHeight: 18,
  },
  buttonContainer: {
    marginTop: 'auto',
  },
  primaryButton: {
    paddingVertical: 18,
    borderRadius: 30,
    marginBottom: 12,
    elevation: 5,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  secondaryButton: {
    paddingVertical: 18,
    borderRadius: 30,
    borderWidth: 2,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default DisplaySeedScreen;
