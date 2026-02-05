import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useWallet } from '../context/WalletContext';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../types/navigation';
import colors from '../constants/colors';
import * as bip39 from 'bip39';

interface ImportWalletScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ImportWallet'>;
}

const ImportWalletScreen: React.FC<ImportWalletScreenProps> = ({ navigation }) => {
  const { currentTheme } = useTheme();
  const { importWallet } = useWallet();
  const [words, setWords] = useState<string[]>(Array(12).fill(''));
  const inputRefs = useRef<Array<TextInput | null>>([]);

  const handleWordChange = (index: number, value: string) => {
    const newWords = [...words];
    newWords[index] = value.trim().toLowerCase();
    setWords(newWords);

    // Auto-focus next input only when pressing space or enter
    // Not on every character
  };

  const handleImport = async () => {
    const mnemonic = words.join(' ').trim();

    // Validate all words are filled
    if (words.some(word => !word.trim())) {
      Alert.alert('Invalid Input', 'Please fill in all 12 words.');
      return;
    }

    // Validate mnemonic
    if (!bip39.validateMnemonic(mnemonic)) {
      Alert.alert('Invalid Mnemonic', 'The recovery phrase you entered is invalid. Please check and try again.');
      return;
    }

    try {
      await importWallet(mnemonic);
      navigation.navigate('Wallet');
    } catch (error) {
      Alert.alert('Import Failed', 'Unable to import wallet. Please try again.');
    }
  };

  const handlePaste = async () => {
    // For mobile, we'll let users paste in first field and split
    Alert.alert(
      'Paste Recovery Phrase',
      'Please paste your 12-word recovery phrase in the first field, separated by spaces.',
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.primary }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topContent}>
          <Text style={[styles.title, { color: colors.black }]}>IMPORT WALLET</Text>
          <Text style={[styles.subtitle, { color: currentTheme.textLight }]}>
            Enter your 12-word recovery phrase to restore your wallet.
          </Text>

          <TouchableOpacity onPress={handlePaste} style={styles.pasteHint}>
            <Text style={styles.pasteHintText}>
              Tip: You can paste all words in the first field
            </Text>
          </TouchableOpacity>

          <View style={styles.wordsGrid}>
            {words.map((word, index) => (
              <View key={index} style={styles.wordContainer}>
                <Text style={styles.wordNumber}>{index + 1}</Text>
                <TextInput
                  ref={ref => { inputRefs.current[index] = ref; }}
                  style={[
                    styles.wordInput,
                    { color: currentTheme.text, borderColor: colors.black },
                  ]}
                  placeholder={`Word ${index + 1}`}
                  placeholderTextColor={colors.gray}
                  onChangeText={(value) => {
                    // Check if user pasted all words in first field
                    if (index === 0 && value.includes(' ')) {
                      const pastedWords = value.trim().toLowerCase().split(/\s+/).slice(0, 12);
                      const newWords = [...words];
                      pastedWords.forEach((word, i) => {
                        if (i < 12) newWords[i] = word;
                      });
                      setWords(newWords);
                    } else {
                      handleWordChange(index, value);
                    }
                  }}
                  value={word}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType={index === 11 ? 'done' : 'next'}
                  onSubmitEditing={() => {
                    if (index < 11) {
                      inputRefs.current[index + 1]?.focus();
                    }
                  }}
                />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomContent}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.black }]}
          onPress={handleImport}
        >
          <Text style={styles.buttonText}>IMPORT WALLET</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 20,
  },
  topContent: {
    paddingBottom: 20,
  },
  bottomContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  pasteHint: {
    marginBottom: 24,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
  },
  pasteHintText: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
  },
  wordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  wordContainer: {
    width: '48%',
    marginBottom: 16,
  },
  wordNumber: {
    fontSize: 12,
    color: colors.gray,
    marginBottom: 4,
    fontWeight: '600',
  },
  wordInput: {
    borderWidth: 2,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    height: 48,
  },
  button: {
    paddingVertical: 18,
    borderRadius: 12,
    elevation: 3,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    width: '100%',
  },
  buttonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default ImportWalletScreen;
