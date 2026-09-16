import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { useTheme } from '../context/ThemeContext';

export type TransferType = 'Public' | 'Private';

interface TransferTypeModalProps {
    visible: boolean;
    selectedType?: TransferType;
    onSelect: (type: TransferType) => void;
    onClose: () => void;
}

const TransferTypeModal: React.FC<TransferTypeModalProps> = ({
    visible,
    selectedType,
    onSelect,
    onClose,
}) => {
    const { currentTheme: t, themeId } = useTheme();
    const isDark = themeId === 'dark';

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
                            backgroundColor: t.card,
                            borderTopColor: t.border,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: -6 },
                            shadowOpacity: isDark ? 0.4 : 0.12,
                            shadowRadius: 16,
                            elevation: 20,
                        },
                    ]}
                    onPress={(e) => e.stopPropagation()}
                >
                    <View style={[styles.dragHandle, { backgroundColor: t.border }]} />

                    <View style={[styles.header, { borderBottomColor: t.border }]}>
                        <Text style={[styles.headerTitle, { color: t.text }]}>Select Transfer Type</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Text style={[styles.closeButtonText, { color: t.textLight }]}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.listContent}>
                        {/* Public Option */}
                        <TouchableOpacity
                            style={[
                                styles.typeItem,
                                selectedType === 'Public' && [styles.typeItemSelected, { backgroundColor: t.border }]
                            ]}
                            onPress={() => {
                                onSelect('Public');
                                onClose();
                            }}
                        >
                            <View style={styles.typeInfo}>
                                <Text style={[styles.typeName, { color: t.text }]}>Public Transfer</Text>
                                <Text style={[styles.typeDesc, { color: t.textLight }]}>Standard Solana transaction</Text>
                            </View>
                            {selectedType === 'Public' && (
                                <Ionicons name="checkmark-circle" size={24} color={colors.success || '#10B981'} />
                            )}
                        </TouchableOpacity>

                        {/* Private Option */}
                        <TouchableOpacity
                            style={[
                                styles.typeItem,
                                selectedType === 'Private' && [styles.typeItemSelected, { backgroundColor: t.border }]
                            ]}
                            onPress={() => {
                                onSelect('Private');
                                onClose();
                            }}
                        >
                            <View style={styles.typeInfo}>
                                <Text style={[styles.typeName, { color: t.text }]}>Private Transfer</Text>
                                <Text style={[styles.typeDesc, { color: t.textLight }]}>Untraceable transaction using Cloak</Text>
                            </View>
                            {selectedType === 'Private' && (
                                <Ionicons name="checkmark-circle" size={24} color={colors.success || '#10B981'} />
                            )}
                        </TouchableOpacity>
                    </View>
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
        paddingBottom: 40,
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
    typeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 12,
        borderRadius: 12,
        marginVertical: 4,
    },
    typeItemSelected: {
        backgroundColor: colors.lightGray,
    },
    typeIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    typeInfo: {
        flex: 1,
    },
    typeName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.black,
        marginBottom: 4,
    },
    typeDesc: {
        fontSize: 14,
        color: colors.gray,
    },
});

export default TransferTypeModal;
