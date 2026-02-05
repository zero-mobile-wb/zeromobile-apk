import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { useCurrency, Currency } from '../context/CurrencyContext';
import { RootStackParamList } from '../types/navigation';

interface CurrencySelectionScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'CurrencySelection'>;
}

const CurrencySelectionScreen: React.FC<CurrencySelectionScreenProps> = ({ navigation }) => {
  const { currentTheme } = useTheme();
  const { selectedCurrency, setSelectedCurrency, currencies } = useCurrency();

  const handleSelectCurrency = async (currency: Currency) => {
    await setSelectedCurrency(currency);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.primary }]}>
      <Header
        title="Select Currency"
        showBack={true}
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.currencyList}>
          {currencies.map((currency) => {
            const isSelected = selectedCurrency.code === currency.code;
            return (
              <TouchableOpacity
                key={currency.code}
                style={[
                  styles.currencyItem,
                  isSelected && styles.currencyItemSelected,
                ]}
                onPress={() => handleSelectCurrency(currency)}
              >
                <View style={styles.currencyLeft}>
                  <View style={styles.currencySymbol}>
                    <Text style={styles.currencySymbolText}>{currency.symbol}</Text>
                  </View>
                  <View style={styles.currencyInfo}>
                    <Text style={styles.currencyCode}>{currency.code}</Text>
                    <Text style={styles.currencyName}>{currency.name}</Text>
                  </View>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.black} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.infoText}>
          Exchange rates are approximate and updated periodically.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 30,
  },
  currencyList: {
    backgroundColor: colors.white,
    borderRadius: 16,
    overflow: 'hidden',
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  currencyItemSelected: {
    backgroundColor: colors.lightGray,
  },
  currencyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  currencySymbol: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  currencySymbolText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.black,
  },
  currencyInfo: {
    flex: 1,
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.black,
    marginBottom: 4,
  },
  currencyName: {
    fontSize: 14,
    color: colors.gray,
  },
  infoText: {
    fontSize: 13,
    color: colors.gray,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
});

export default CurrencySelectionScreen;
