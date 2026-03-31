import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageProvider';
import { getServices, createService, updateService, deleteService, getProfile, getBarberById } from '../../services/api';

export default function BarberServicesScreen({ navigation }) {
    const { theme } = useTheme();
    const { t } = useLanguage();
    const [serviceList, setServiceList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingService, setEditingService] = useState(null);
    const [barberId, setBarberId] = useState(null);
    const [skillCategories, setSkillCategories] = useState([]);

    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [duration, setDuration] = useState('30');
    const [category, setCategory] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                const profile = await getProfile();
                if (profile?._id) {
                    setBarberId(profile._id);
                    fetchBarberServices(profile._id);

                    const barberRes = await getBarberById(profile._id);
                    const barberData = barberRes?.data || barberRes;

                    const cats = barberData?.services || [];
                    setSkillCategories(cats);
                    if (cats.length > 0) setCategory(cats[0]);
                }
            } catch (e) {
                console.warn('Init error:', e);
            }
        };
        init();
    }, []);

    const fetchBarberServices = async (id) => {
        setLoading(true);
        try {
            const result = await getServices({ barberId: id });
            setServiceList(result?.data || []);
        } catch (e) {
            console.error('Fetch services error:', e);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setName('');
        setPrice('');
        setDuration('30');
        setCategory(skillCategories[0] || '');
        setEditingService(null);
    };

    const handleEdit = (service) => {
        setEditingService(service);
        setName(service.name);
        setPrice(String(service.price));
        setDuration(String(service.duration_minutes));
        setCategory(service.category || '');
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!name || !price || !duration || !category) {
            Alert.alert('Missing Info', 'Please fill in all required fields.');
            return;
        }

        setSaving(true);
        const payload = {
            name,
            price: Number(price),
            duration_minutes: Number(duration),
            category,
            isActive: true
        };

        try {
            if (editingService) {
                await updateService(editingService._id, payload);
            } else {
                await createService(payload);
            }
            setModalVisible(false);
            resetForm();
            fetchBarberServices(barberId);
        } catch (e) {
            Alert.alert('Error', e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (id) => {
        Alert.alert(
            t('delete_account'),
            'Remove this service?',
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive', onPress: async () => {
                        try {
                            await deleteService(id);
                            fetchBarberServices(barberId);
                        } catch (e) {
                            Alert.alert('Error', e.message);
                        }
                    }
                }
            ]
        );
    };

    const renderServiceCard = ({ item }) => {
        return (
            <View style={[styles.card, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.serviceName, { color: theme.text }]}>{item.name}</Text>
                    <Text style={[styles.serviceMeta, { color: theme.textLight }]}>
                        {item.category} • {item.duration_minutes} min
                    </Text>
                </View>

                <View style={styles.rightSection}>
                    <Text style={[styles.servicePrice, { color: theme.primary }]}>Rs. {item.price}</Text>
                    <View style={styles.actionRow}>
                        <TouchableOpacity onPress={() => handleEdit(item)} style={styles.setupBtn}>
                            <Text style={styles.setupBtnText}>{t('edit_service')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(item._id)} style={styles.iconBtn}>
                            <Text style={{ color: '#FF3B30' }}>✕</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={{ fontSize: 24, color: theme.primary }}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>{t('my_services')}</Text>
                <TouchableOpacity onPress={() => { resetForm(); setModalVisible(true); }}>
                    <Text style={[styles.addText, { color: theme.primary }]}>+ {t('add_service')}</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={serviceList}
                    renderItem={renderServiceCard}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={{ color: theme.textLight, fontSize: 16 }}>{t('no_services')}</Text>
                            <TouchableOpacity
                                style={[styles.addFirstBtn, { backgroundColor: theme.primary }]}
                                onPress={() => setModalVisible(true)}
                            >
                                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>{t('add_first_service')}</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}

            <Modal visible={modalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>
                            {editingService ? t('edit_service') : t('add_new_service')}
                        </Text>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={[styles.label, { color: theme.textMuted }]}>{t('category')}</Text>
                            <View style={styles.chipRow}>
                                {skillCategories.map(s => (
                                    <TouchableOpacity
                                        key={s}
                                        onPress={() => setCategory(s)}
                                        style={[styles.chip, category === s ? { backgroundColor: theme.primary } : { backgroundColor: theme.border + '20' }]}
                                    >
                                        <Text style={{ color: category === s ? '#FFF' : theme.text }}>{s}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={[styles.label, { color: theme.textMuted }]}>{t('service_name')}</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                                value={name}
                                onChangeText={setName}
                                placeholder="..."
                                placeholderTextColor={theme.textMuted}
                            />

                            <View style={styles.row}>
                                <View style={{ flex: 1, marginRight: 10 }}>
                                    <Text style={[styles.label, { color: theme.textMuted }]}>{t('price')}</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                                        value={price}
                                        onChangeText={setPrice}
                                        keyboardType="numeric"
                                        placeholder="500"
                                        placeholderTextColor={theme.textMuted}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.label, { color: theme.textMuted }]}>{t('duration')}</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                                        value={duration}
                                        onChangeText={setDuration}
                                        keyboardType="numeric"
                                        placeholder="30"
                                        placeholderTextColor={theme.textMuted}
                                    />
                                </View>
                            </View>

                            <View style={styles.modalBtnRow}>
                                <TouchableOpacity
                                    style={[styles.modalBtn, { backgroundColor: theme.border + '40' }]}
                                    onPress={() => setModalVisible(false)}
                                >
                                    <Text style={{ color: theme.text }}>{t('cancel')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                                    onPress={handleSave}
                                    disabled={saving || skillCategories.length === 0}
                                >
                                    {saving ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: 'bold' }}>{t('save_service')}</Text>}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    addText: { fontSize: 16, fontWeight: 'bold' },
    listContent: { padding: 20 },
    card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderRadius: 16, marginBottom: 12, elevation: 2 },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    serviceName: { fontSize: 16, fontWeight: 'bold', marginRight: 8 },
    typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    typeBadgeText: { fontSize: 10, fontWeight: 'bold' },
    serviceMeta: { fontSize: 13 },
    rightSection: { alignItems: 'flex-end' },
    servicePrice: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
    actionRow: { flexDirection: 'row', gap: 15 },
    iconBtn: { padding: 5 },
    setupBtn: {
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center'
    },
    setupBtnText: { fontSize: 12, fontWeight: 'bold', color: '#666' },
    emptyContainer: { alignItems: 'center', marginTop: 100 },
    addFirstBtn: { marginTop: 20, paddingHorizontal: 25, paddingVertical: 12, borderRadius: 12 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { borderRadius: 20, padding: 25, maxHeight: '80%' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    label: { fontSize: 13, fontWeight: '600', marginTop: 15, marginBottom: 8 },
    input: { height: 50, borderRadius: 12, borderWidth: 1, paddingHorizontal: 15, fontSize: 16 },
    row: { flexDirection: 'row' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10 },
    modalBtnRow: { flexDirection: 'row', gap: 15, marginTop: 30, marginBottom: 10 },
    modalBtn: { flex: 1, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
});
