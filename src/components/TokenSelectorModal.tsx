import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Image,
  Pressable,
} from 'react-native';
import colors from '../constants/colors';

export interface SelectableToken {
  mint: string;
  name: string;
  symbol: string;
  balance: number;
  priceUSD: number;
  valueUSD: number;
  logoURI?: string;
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

  const handleImageError = (mint: string) => {
    setImageErrors(prev => ({ ...prev, [mint]: true }));
  };

  const renderTokenItem = ({ item }: { item: SelectableToken }) => {
    const isSelected = selectedToken?.mint === item.mint;
    const hasImageError = imageErrors[item.mint];

    return (
      <TouchableOpacity
        style={[styles.tokenItem, isSelected && styles.tokenItemSelected]}
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
            <View style={[styles.tokenImage, styles.tokenImagePlaceholder]}>
              <Text style={styles.tokenImageText}>{item.symbol[0]}</Text>
            </View>
          )}
          <View style={styles.tokenInfo}>
            <Text style={styles.tokenName}>{item.name}</Text>
            <Text style={styles.tokenSymbol}>{item.symbol}</Text>
          </View>
        </View>
        <View style={styles.tokenRight}>
          <Text style={styles.tokenBalance}>{item.balance.toFixed(4)}</Text>
          <Text style={styles.tokenValue}>${item.valueUSD.toFixed(2)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          {/* Drag Handle */}
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Select Token</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Token List */}
          <FlatList
            data={tokens}
            renderItem={renderTokenItem}
            keyExtractor={(item) => item.mint}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.lightGray,
    borderRadius: 2,
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
