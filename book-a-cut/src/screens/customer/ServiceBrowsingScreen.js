import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet,
    ActivityIndicator, Image, TextInput, RefreshControl, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { getServices } from '../../services/api';

const PURPLE = '#7B2FBE';
const CREAM = '#F5F0E8';

const getServiceImage = (serviceName) => {
    if (!serviceName) return require('../../../assets/barber.png');
    const name = String(serviceName).toLowerCase().replace(/\s+/g, '_');
    if (name.includes('beard') || name.includes('bread')) return require('../../../assets/beard_trim.jpg');
    if (name.includes('hair')) return require('../../../assets/hair_cut.jpg');
    if (name.includes('facial')) return require('../../../assets/facial.jpg');
    if (name.includes('shave')) return require('../../../assets/shave.jpg');
    return require('../../../assets/barber.png');
};

const CATEGORY_META = {
    'All': { emoji: '✨' },
    'Haircut': { emoji: '✂️' },
    'Shave': { emoji: '🪒' },
    'Facial': { emoji: '💆' },
    'Hair Color': { emoji: '🎨' },
    'Beard Trim': { emoji: '🧔' },
    'Kids Cut': { emoji: '👦' },
    'Others': { emoji: '💈' },
};
const CATEGORIES = Object.keys(CATEGORY_META);

// ─── REUSABLE COMPONENTS ──────────────────────────────────
const CategoryButton = ({ title, emoji, selected, onPress }) => (
    <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[
            styles.categoryBtn,
            selected ? styles.categoryBtnActive : styles.categoryBtnInactive,
            { transform: [{ scale: selected ? 1 : 0.97 }] }
        ]}
    >
        <Text style={styles.categoryEmoji}>{emoji}</Text>
        <Text 
            style={[styles.categoryLabel, { color: selected ? '#ffffff' : '#222222' }]}
            numberOfLines={1}
            ellipsizeMode="tail"
        >
            {title}
        </Text>
    </TouchableOpacity>
);

function ServiceCard({ item, onPress, theme }) {
    return (
        <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => onPress(item)}
            style={[styles.card, { backgroundColor: theme.card }]}
        >
            <Image
                source={getServiceImage(item.name)}
                style={styles.cardImg}
                resizeMode="cover"
            />

            <View style={styles.catBadge}>
                <Text style={styles.catBadgeText}>
                    {CATEGORY_META[item.category]?.emoji || '💈'} {item.category}
                </Text>
            </View>

            <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                    <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>
                        {item.name}
                    </Text>
                    <Text style={[styles.cardPrice, { color: PURPLE }]}>
                        Rs {item.price}
                    </Text>
                </View>

                {item.description ? (
                    <Text style={[styles.cardDesc, { color: theme.textMuted }]} numberOfLines={2}>
                        {item.description}
                    </Text>
                ) : null}

                <View style={styles.cardFooterRow}>
                    <View style={[styles.durationPill, { backgroundColor: PURPLE + '18' }]}>
                        <Text style={[styles.durationText, { color: PURPLE }]}>
                            ⏱ {item.duration_minutes} min
                        </Text>
                    </View>

                    {item.barber?.username ? (
                        <View style={styles.barberRow}>
                            <Image
                                source={item.barber.profile_image
                                    ? { uri: item.barber.profile_image }
                                    : require('../../../assets/barber.png')}
                                style={styles.barberAvatar}
                            />
                            <Text style={[styles.barberName, { color: theme.textMuted }]} numberOfLines={1}>
                                {item.barber.username}
                            </Text>
                        </View>
                    ) : null}
                </View>
            </View>

            <View style={styles.bookStrip}>
                <Text style={styles.bookStripText}>Book This Service →</Text>
            </View>
        </TouchableOpacity>
    );
}

export default function ServiceBrowsingScreen({ navigation, route }) {
    const { theme } = useTheme();
    const preSelectedBarberId = route?.params?.barberId;

    const [services, setServices] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [search, setSearch] = useState('');
    const [error, setError] = useState('');

    const fetchServices = useCallback(async () => {
        setError('');
        try {
            const params = {};
            if (preSelectedBarberId) params.barberId = preSelectedBarberId;
            const res = await getServices(params);
            const list = res.data || [];
            setServices(list);
            setFiltered(list);
        } catch (e) {
            console.error('ServiceBrowsing fetch error:', e);
            setError('Could not load services. Pull down to retry.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [preSelectedBarberId]);

    useEffect(() => { fetchServices(); }, [fetchServices]);

    useEffect(() => {
        let list = [...services];

        if (selectedCategory !== 'All') {
            list = list.filter(s => {
                const cat = (s.category || '').toLowerCase().trim();
                const selected = selectedCategory.toLowerCase().trim();
                if (cat === selected) return true;
                if (selected === 'hair color') {
                    return cat.includes('color') || cat.includes('colour') || cat.includes('hair');
                }
                return cat.includes(selected) || selected.includes(cat);
            });
        }

        if (search.trim()) {
            list = list.filter(s =>
                s.name.toLowerCase().includes(search.toLowerCase()) ||
                (s.category || '').toLowerCase().includes(search.toLowerCase())
            );
        }

        setFiltered(list);
    }, [selectedCategory, search, services]);

    const handleSelect = (service) => {
        navigation.navigate('BarberSelection', { service });
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: CREAM }]}>
                <View style={styles.loadingView}>
                    <ActivityIndicator size="large" color={PURPLE} />
                    <Text style={[styles.loadingText, { color: PURPLE }]}>Loading services...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: CREAM }]}>

            {/* Header */}
            <View style={[styles.header, { backgroundColor: '#fff' }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                    <Text style={{ fontSize: 24, color: theme.text }}>←</Text>
                </TouchableOpacity>
                <View style={{ alignItems: 'center' }}>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Explore Services</Text>
                    <Text style={[styles.headerSub, { color: theme.textMuted }]}>
                        {services.length} services available
                    </Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {/* Search bar */}
            <View style={styles.searchWrap}>
                <View style={[styles.searchBar, { backgroundColor: '#fff' }]}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                        style={[styles.searchInput, { color: theme.text }]}
                        placeholder="Search services..."
                        placeholderTextColor={theme.textMuted}
                        value={search}
                        onChangeText={setSearch}
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <Text style={{ fontSize: 18, color: theme.textMuted }}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Category Grid (Wrapping) */}
            <View style={styles.categoryWrap}>
                {CATEGORIES.map(cat => (
                    <CategoryButton
                        key={cat}
                        title={cat}
                        emoji={CATEGORY_META[cat].emoji}
                        selected={selectedCategory === cat}
                        onPress={() => setSelectedCategory(cat)}
                    />
                ))}
            </View>

            {/* Results count */}
            <View style={styles.resultsRow}>
                <Text style={[styles.resultsText, { color: theme.textMuted }]}>
                    {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                    {selectedCategory !== 'All' ? ` in "${selectedCategory}"` : ''}
                    {search ? ` for "${search}"` : ''}
                </Text>
            </View>

            {error ? (
                <View style={styles.errorBox}>
                    <Text style={styles.errorText}>⚠️ {error}</Text>
                </View>
            ) : null}

            {/* Service list */}
            <FlatList
                data={filtered}
                keyExtractor={item => item._id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); fetchServices(); }}
                        tintColor={PURPLE}
                        colors={[PURPLE]}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyEmoji}>✂️</Text>
                        <Text style={[styles.emptyTitle, { color: theme.text }]}>No services found</Text>
                        <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                            {search || selectedCategory !== 'All'
                                ? 'Try clearing your filters'
                                : 'No services have been added yet'}
                        </Text>
                        {(search || selectedCategory !== 'All') && (
                            <TouchableOpacity
                                style={styles.clearBtn}
                                onPress={() => { setSearch(''); setSelectedCategory('All'); }}
                            >
                                <Text style={styles.clearBtnText}>Clear Filters</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                }
                renderItem={({ item }) => (
                    <ServiceCard item={item} onPress={handleSelect} theme={theme} />
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingView: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontSize: 14, fontWeight: '600' },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingVertical: 14,
    },
    iconBtn: { padding: 6 },
    headerTitle: { fontSize: 18, fontWeight: '800' },
    headerSub: { fontSize: 12, marginTop: 1 },

    searchWrap: { paddingHorizontal: 16, paddingBottom: 10, paddingTop: 4 },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 11,
        borderRadius: 14,
        elevation: 2,
    },
    searchIcon: { fontSize: 16, marginRight: 8 },
    searchInput: { flex: 1, fontSize: 15 },

    categoryWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        paddingBottom: 16,
        paddingTop: 4,
        justifyContent: 'flex-start',
        gap: 10,
    },
    categoryBtn: {
        width: 110,
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        borderWidth: 1.5,
        gap: 6,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
    },
    categoryBtnActive: {
        backgroundColor: PURPLE,
        borderColor: PURPLE,
    },
    categoryBtnInactive: {
        backgroundColor: '#ffffff',
        borderColor: '#dddddd',
    },
    categoryEmoji: { fontSize: 16 },
    categoryLabel: { fontSize: 13, fontWeight: '700' },

    resultsRow: { paddingHorizontal: 18, paddingBottom: 8 },
    resultsText: { fontSize: 12 },

    errorBox: {
        marginHorizontal: 16,
        marginBottom: 10,
        backgroundColor: '#FEF2F2',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    errorText: { color: '#DC2626', fontSize: 13 },

    listContent: { paddingHorizontal: 16, paddingBottom: 30 },

    card: {
        borderRadius: 18,
        marginBottom: 18,
        overflow: 'hidden',
        elevation: 4,
    },
    cardImg: { width: '100%', height: 160 },
    catBadge: {
        position: 'absolute',
        top: 12,
        left: 12,
        backgroundColor: PURPLE,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 100,
    },
    catBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    cardBody: { padding: 14 },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 5,
    },
    cardName: { fontSize: 16, fontWeight: '800', flex: 1, marginRight: 8 },
    cardPrice: { fontSize: 18, fontWeight: '900' },
    cardDesc: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
    cardFooterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    durationPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    durationText: { fontSize: 12, fontWeight: '600' },
    barberRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    barberAvatar: { width: 24, height: 24, borderRadius: 12 },
    barberName: { fontSize: 12, maxWidth: 130 },
    bookStrip: {
        paddingVertical: 12,
        alignItems: 'center',
        backgroundColor: PURPLE,
    },
    bookStripText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 30, gap: 10 },
    emptyEmoji: { fontSize: 52 },
    emptyTitle: { fontSize: 18, fontWeight: '800' },
    emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
    clearBtn: {
        marginTop: 8,
        paddingHorizontal: 24,
        paddingVertical: 11,
        backgroundColor: PURPLE,
        borderRadius: 12,
    },
    clearBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});