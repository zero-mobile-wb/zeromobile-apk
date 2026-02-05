import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useWallet } from '../context/WalletContext';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../types/navigation';

interface HomeScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { currentTheme } = useTheme();
  const { createWallet, wallet, isWalletConfirmed } = useWallet();
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (wallet && isWalletConfirmed) {
      navigation.navigate('Wallet');
    }
  }, [wallet, isWalletConfirmed, navigation]);

  const handleCreateWallet = async () => {
    try {
      setIsCreating(true);
      await createWallet();
      navigation.navigate('DisplaySeed');
    } catch (error) {
      console.error('Create wallet error:', error);
      Alert.alert(
        'Creation Error',
        'Failed to create a new wallet. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleImportWallet = () => {
    navigation.navigate('ImportWallet');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.primary }]}>
      {/* Logo Section */}
      <View style={styles.logoContainer}>
        <Image
          source={require('../../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={[styles.appName, { color: colors.black }]}>ZERO WALLET</Text>
        <Text style={[styles.tagline, { color: currentTheme.textLight }]}>
          Secure • Simple • Decentralized
        </Text>
      </View>

      {/* Center Spacer */}
      <View style={styles.spacer} />

      {/* Authentication Buttons at Bottom */}
      <View style={styles.buttonContainer}>
        <>
          <TouchableOpacity
            style={[styles.button, styles.createButton]}
            onPress={handleCreateWallet}
            disabled={isCreating}
          >
            {isCreating ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>CREATE WALLET</Text>
            )}
          </TouchableOpacity>
          <View style={{ marginVertical: 10 }} />
          <TouchableOpacity
            style={[styles.button, styles.importButton]}
            onPress={handleImportWallet}
          >
            <Text style={styles.buttonText}>IMPORT WALLET</Text>
          </TouchableOpacity>
        </>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  logoContainer: {
    flex: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 20,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  spacer: {
    flex: 1,
  },
  buttonContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 40,
  },
  button: {
    paddingVertical: 18,
    borderRadius: 30,
    elevation: 5
  },
  createButton: {
    backgroundColor: colors.black,
  },
  importButton: {
    backgroundColor: colors.black,
  },
  buttonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 10,
  },
});

export default HomeScreen;