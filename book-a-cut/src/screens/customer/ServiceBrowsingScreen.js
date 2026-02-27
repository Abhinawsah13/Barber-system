import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet,
    ActivityIndicator, Image, TextInput, RefreshControl, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { getServices } from '../../services/api';

const PURPLE = '#7B2FBE';
const AMBER = '#F59E0B';
const CREAM = '#F5F0E8';

const CATEGORY_META = {
    All: { emoji: '✨', color: PURPLE },
    Haircut: { emoji: '✂️', color: '#2563EB' },
    Shave: { emoji: '🪒', color: '#059669' },
    Facial: { emoji: '💆', color: '#DB2777' },
    Coloring: { emoji: '🎨', color: '#D97706' },
    Other: { emoji: '💈', color: '#6B7280' },
};
const CATEGORIES = Object.keys(CATEGORY_META);

// Service card with barber info and category badge
function ServiceCard({ item, onPress, theme }) {
    const meta = CATEGORY_META[item.category] || CATEGORY_META.Other;

    return (
        <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => onPress(item)}
            style={[styles.card, { backgroundColor: theme.card }]}
        >
            {/* image */}
            <Image
                source={{ uri: item.image || `https://picsum.photos/seed/${item._id}/600/300` }}
                style={styles.cardImg}
                resizeMode="cover"
            />

            {/* category badge overlay */}
            <View style={[styles.catBadge, { backgroundColor: meta.color }]}>
                <Text style={styles.catBadgeText}>{meta.emoji} {item.category}</Text>
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
                    {/* duration */}
                    <View style={[styles.pill, { backgroundColor: PURPLE + '15' }]}>
                        <Text style={[styles.pillText, { color: PURPLE }]}>
                            ⏱ {item.duration_minutes} min
                        </Text>
                    </View>

                    {/* barber name if populated */}
                    {item.barber?.username ? (
                        <View style={styles.barberRow}>
                            <Image
                                source={{ uri: item.barber.profile_image || `https://i.pravatar.cc/40?u=${item.barber._id}` }}
                                style={styles.barberAvatar}
                            />
                            <Text style={[styles.barberName, { color: theme.textMuted }]} numberOfLines={1}>
                                {item.barber.username}
                            </Text>
                        </View>
                    ) : null}
                </View>
            </View>

            {/* tap CTA */}
            <View style={[styles.bookStrip, { backgroundColor: PURPLE }]}>
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

    // local filter whenever category / search / source list changes
    useEffect(() => {
        let list = [...services];
        if (selectedCategory !== 'All') list = list.filter(s => s.category === selectedCategory);
        if (search.trim()) list = list.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
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
                <View>
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

            {/* Category chips — horizontal scroll */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
            >
                {CATEGORIES.map(cat => {
                    const meta = CATEGORY_META[cat];
                    const active = selectedCategory === cat;
                    return (
                        <TouchableOpacity
                            key={cat}
                            onPress={() => setSelectedCategory(cat)}
                            style={[
                                styles.chip,
                                { backgroundColor: active ? meta.color : '#fff', borderColor: active ? meta.color : '#E5E7EB' },
                            ]}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.chipEmoji}>{meta.emoji}</Text>
                            <Text style={[styles.chipLabel, { color: active ? '#fff' : '#555' }]}>{cat}</Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* Results count */}
            <View style={styles.resultsRow}>
                <Text style={[styles.resultsText, { color: theme.textMuted }]}>
                    {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                    {selectedCategory !== 'All' ? ` in "${selectedCategory}"` : ''}
                    {search ? ` for "${search}"` : ''}
                </Text>
            </View>

            {/* Error state */}
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

    // header
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14 },
    iconBtn: { padding: 6 },
    headerTitle: { fontSize: 18, fontWeight: '800' },
    headerSub: { fontSize: 12, marginTop: 1 },

    // search
    searchWrap: { paddingHorizontal: 16, paddingBottom: 10, paddingTop: 4 },
    searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    searchIcon: { fontSize: 16, marginRight: 8 },
    searchInput: { flex: 1, fontSize: 15 },

    // chips
    chipRow: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
    chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1.5, marginRight: 8, gap: 5 },
    chipEmoji: { fontSize: 14 },
    chipLabel: { fontSize: 13, fontWeight: '600' },

    // results
    resultsRow: { paddingHorizontal: 18, paddingBottom: 8 },
    resultsText: { fontSize: 12 },

    // error
    errorBox: { marginHorizontal: 16, marginBottom: 10, backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#FECACA' },
    errorText: { color: '#DC2626', fontSize: 13 },

    // list
    listContent: { paddingHorizontal: 16, paddingBottom: 30 },

    // card
    card: { borderRadius: 18, marginBottom: 18, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.09, shadowRadius: 8, elevation: 4 },
    cardImg: { width: '100%', height: 150 },
    catBadge: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
    catBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    cardBody: { padding: 14 },
    cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
    cardName: { fontSize: 16, fontWeight: '800', flex: 1, marginRight: 8 },
    cardPrice: { fontSize: 18, fontWeight: '900' },
    cardDesc: { fontSize: 13, lineHeight: 18, marginBottom: 10, color: '#666' },
    cardFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    pillText: { fontSize: 12, fontWeight: '600' },
    barberRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    barberAvatar: { width: 22, height: 22, borderRadius: 11 },
    barberName: { fontSize: 12, maxWidth: 120 },
    bookStrip: { paddingVertical: 11, alignItems: 'center' },
    bookStripText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    // empty state
    emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 30, gap: 10 },
    emptyEmoji: { fontSize: 52 },
    emptyTitle: { fontSize: 18, fontWeight: '800' },
    emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
    clearBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 11, backgroundColor: PURPLE, borderRadius: 12 },
    clearBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
