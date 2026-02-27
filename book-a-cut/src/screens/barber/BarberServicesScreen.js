import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { getServices, createService, updateService, deleteService, getProfile, getBarberById } from '../../services/api';

export default function BarberServicesScreen({ navigation }) {
    const { theme } = useTheme();
    const [serviceList, setServiceList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingService, setEditingService] = useState(null);
    const [barberId, setBarberId] = useState(null);
    const [skillCategories, setSkillCategories] = useState([]);

    // Form fields
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [duration, setDuration] = useState('30');
    const [category, setCategory] = useState('');
    const [serviceModes, setServiceModes] = useState({ salon: { enabled: true }, home: { enabled: false } });
    const [serviceType, setServiceType] = useState('salon');
    const [saving, setSaving] = useState(false);

    const serviceTypes = ["salon", "home"];

    useEffect(() => {
        const init = async () => {
            try {
                const profile = await getProfile();
                if (profile?._id) {
                    setBarberId(profile._id);
                    fetchBarberServices(profile._id);

                    // Fetch specialties and service modes from the barber's profile
                    const barberRes = await getBarberById(profile._id);
                    const barberData = barberRes?.data || barberRes;

                    const cats = barberData?.services || [];
                    setSkillCategories(cats);
                    if (cats.length > 0) setCategory(cats[0]);

                    if (barberData?.serviceModes) {
                        setServiceModes(barberData.serviceModes);
                        // If current serviceType is disabled, switch to the first enabled one
                        if (barberData.serviceModes.salon.enabled) {
                            setServiceType('salon');
                        } else if (barberData.serviceModes.home.enabled) {
                            setServiceType('home');
                        }
                    }
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
        setServiceType('salon');
        setEditingService(null);
    };

    const handleEdit = (service) => {
        setEditingService(service);
        setName(service.name);
        setPrice(String(service.price));
        setDuration(String(service.duration_minutes));
        setCategory(service.category || '');
        setServiceType(service.serviceType || 'salon');
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!name || !price || !duration || !category) {
            Alert.alert('Missing Info', 'Please fill in all required fields. Ensure you have selected a category.');
            return;
        }

        setSaving(true);
        const payload = {
            name,
            price: Number(price),
            duration_minutes: Number(duration),
            category,
            serviceType: 'both', // Always default to both
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
            'Delete Service',
            'Are you sure you want to remove this service?',
            [
                { text: 'Cancel', style: 'cancel' },
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
        const isDraft = item.isActive === false;

        return (
            <View style={[
                styles.card,
                { backgroundColor: theme.card, shadowColor: theme.shadow },
                isDraft && { borderColor: '#FF9500', borderWidth: 1.5, borderStyle: 'dashed' }
            ]}>
                <View style={{ flex: 1 }}>
                    <View style={styles.cardTitleRow}>
                        <View>
                            <Text style={[styles.serviceName, { color: theme.text }]}>{item.name}</Text>
                            {isDraft && (
                                <View style={{ backgroundColor: '#FF950020', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4, alignSelf: 'flex-start' }}>
                                    <Text style={{ color: '#FF9500', fontSize: 10, fontWeight: 'bold' }}>⚠️ INCOMPLETE DRAFT</Text>
                                </View>
                            )}
                        </View>
                    </View>
                    <Text style={[styles.serviceMeta, { color: theme.textLight }]}>
                        {item.category} • {item.duration_minutes} min
                    </Text>
                </View>

                <View style={styles.rightSection}>
                    <Text style={[styles.servicePrice, { color: theme.primary }]}>Rs. {item.price}</Text>
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            onPress={() => handleEdit(item)}
                            style={[styles.setupBtn, isDraft && { backgroundColor: '#FF9500' }]}
                        >
                            <Text style={[styles.setupBtnText, isDraft && { color: '#FFF' }]}>
                                {isDraft ? 'Complete' : 'Edit'}
                            </Text>
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
                <Text style={[styles.headerTitle, { color: theme.text }]}>My Services</Text>
                <TouchableOpacity onPress={() => { resetForm(); setModalVisible(true); }}>
                    <Text style={[styles.addText, { color: theme.primary }]}>+ Add</Text>
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
                            <Text style={{ color: theme.textLight, fontSize: 16 }}>No services added yet.</Text>
                            <TouchableOpacity
                                style={[styles.addFirstBtn, { backgroundColor: theme.primary }]}
                                onPress={() => setModalVisible(true)}
                            >
                                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Add Your First Service</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}

            <Modal visible={modalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>
                            {editingService ? 'Edit Service' : 'Add New Service'}
                        </Text>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={[styles.label, { color: theme.textMuted }]}>Derived From Category</Text>
                            {skillCategories.length === 0 ? (
                                <Text style={{ color: '#FF3B30', fontSize: 12, marginBottom: 10 }}>
                                    You must add service categories to your profile first!
                                </Text>
                            ) : (
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
                            )}

                            <Text style={[styles.label, { color: theme.textMuted }]}>Service Name</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                                value={name}
                                onChangeText={setName}
                                placeholder="Service Name (e.g. Skin Fade)"
                                placeholderTextColor={theme.textMuted}
                            />

                            <View style={styles.row}>
                                <View style={{ flex: 1, marginRight: 10 }}>
                                    <Text style={[styles.label, { color: theme.textMuted }]}>Price (Rs.)</Text>
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
                                    <Text style={[styles.label, { color: theme.textMuted }]}>Duration (min)</Text>
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
                                    <Text style={{ color: theme.text }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                                    onPress={handleSave}
                                    disabled={saving || skillCategories.length === 0}
                                >
                                    {saving ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Save Service</Text>}
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
