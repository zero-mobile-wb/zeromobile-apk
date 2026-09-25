import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Image,
  Pressable,
  TextInput,
} from 'react-native';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';

export interface SelectableToken {
  mint: string;
  name: string;
  symbol: string;
  balance: number;
  priceUSD: number;
  valueUSD: number;
  decimals?: number;
  logoURI?: string;
  chainId?: number;
  chain?: string;
  chainLogo?: string;
}

interface TokenSelectorModalProps {
  visible: boolean;
  tokens: SelectableToken[];
  selectedToken?: SelectableToken;
  onSelect: (token: SelectableToken) => void;
  onClose: () => void;
}

const TokenSelectorModal: React.FC<TokenSelectorModalProps> = ({
  visible,
  tokens,
  selectedToken,
  onSelect,
  onClose,
}) => {
  const [imageErrors, setImageErrors] = useState<{ [key: string]: boolean }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const { currentTheme, themeId } = useTheme();
  const isDark = themeId === 'dark';

  useEffect(() => {
    if (visible) setSearchQuery('');
  }, [visible]);

  const filteredTokens = useMemo(() => {
    if (!searchQuery.trim()) return tokens;
    const q = searchQuery.toLowerCase();
    return tokens.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.symbol.toLowerCase().includes(q) ||
      t.mint.toLowerCase().includes(q)
    );
  }, [tokens, searchQuery]);

  const handleImageError = (mint: string) => {
    setImageErrors(prev => ({ ...prev, [mint]: true }));
  };

  const renderTokenItem = ({ item }: { item: SelectableToken }) => {
    const isSelected = selectedToken?.mint === item.mint;
    const hasImageError = imageErrors[item.mint];

    return (
      <TouchableOpacity
        style={[styles.tokenItem, isSelected && { backgroundColor: currentTheme.border }]}
        onPress={() => {
          onSelect(item);
          onClose();
        }}
      >
        <View style={styles.tokenLeft}>
          {item.logoURI && !hasImageError ? (
            <Image
              source={{ uri: item.logoURI }}
              style={styles.tokenImage}
              onError={() => handleImageError(item.mint)}
            />
          ) : (
            <View style={[styles.tokenImage, { backgroundColor: currentTheme.border, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={[styles.tokenImageText, { color: currentTheme.text }]}>{item.symbol[0]}</Text>
            </View>
          )}
          <View style={styles.tokenInfo}>
            <Text style={[styles.tokenName, { color: currentTheme.text }]}>{item.name}</Text>
            <Text style={[styles.tokenSymbol, { color: currentTheme.textLight }]}>{item.symbol}</Text>
          </View>
        </View>
        <View style={styles.tokenRight}>
          <Text style={[styles.tokenBalance, { color: currentTheme.text }]}>{item.balance.toFixed(4)}</Text>
          <Text style={[styles.tokenValue, { color: currentTheme.textLight }]}>${item.valueUSD.toFixed(2)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[
            styles.modalContent,
            {
              backgroundColor: currentTheme.card,
              borderTopColor: currentTheme.border,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -6 },
              shadowOpacity: isDark ? 0.4 : 0.12,
              shadowRadius: 16,
              elevation: 20,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Drag Handle */}
          <View style={[styles.dragHandle, { backgroundColor: currentTheme.border }]} />

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: currentTheme.border }]}>
            <Text style={[styles.headerTitle, { color: currentTheme.text }]}>Select Token</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={[styles.closeButtonText, { color: currentTheme.textLight }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <TextInput
              style={[styles.searchInput, { backgroundColor: currentTheme.border, color: currentTheme.text }]}
              placeholder="Search by name, symbol, or address"
              placeholderTextColor={currentTheme.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Token List */}
          <FlatList
            data={filteredTokens}
            renderItem={renderTokenItem}
            keyExtractor={(item) => item.mint}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: currentTheme.textLight }]}>No tokens found</Text>
              </View>
            }
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  dragHandle: {
    width: 44,
    height: 5,
    backgroundColor: colors.lightGray,
    borderRadius: 99,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.black,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  searchInput: {
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: colors.gray,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  tokenItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginVertical: 4,
  },
  tokenItemSelected: {
    backgroundColor: colors.lightGray,
  },
  tokenLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tokenImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  tokenImagePlaceholder: {
    backgroundColor: colors.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenImageText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  tokenInfo: {
    flex: 1,
  },
  tokenName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.black,
    marginBottom: 4,
  },
  tokenSymbol: {
    fontSize: 14,
    color: colors.gray,
  },
  tokenRight: {
    alignItems: 'flex-end',
  },
  tokenBalance: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.black,
    marginBottom: 4,
  },
  tokenValue: {
    fontSize: 14,
    color: colors.gray,
  },
});

export default TokenSelectorModal;
