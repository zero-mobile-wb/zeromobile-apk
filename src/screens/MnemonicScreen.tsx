
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useWallet } from '../context/WalletContext';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../types/navigation';
import colors from '../constants/colors';

interface MnemonicScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Mnemonic'>;
}

const MnemonicScreen: React.FC<MnemonicScreenProps> = ({ navigation }) => {
  const { currentTheme } = useTheme();
  const { mnemonic } = useWallet();

  const handleContinue = () => {
    navigation.navigate('Wallet');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.primary }]}>
      <Text style={[styles.title, { color: currentTheme.text }]}>Your Recovery Phrase</Text>
      <Text style={[styles.subtitle, { color: currentTheme.textLight }]}>
        Write down or copy these words in the right order and save them somewhere safe.
      </Text>
      <View style={[styles.mnemonicContainer, { borderColor: currentTheme.secondary }]}>
        <Text style={[styles.mnemonic, { color: currentTheme.text }]}>{mnemonic}</Text>
      </View>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: currentTheme.secondary }]}
        onPress={handleContinue}
      >
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 32,
  },
  mnemonicContainer: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 32,
  },
  mnemonic: {
    fontSize: 18,
    textAlign: 'center',
  },
  button: {
    paddingVertical: 18,
    borderRadius: 30,
    elevation: 5,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    width: '100%',
  },
  buttonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default MnemonicScreen;
