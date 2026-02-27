// screens/customer/BarberSelectionScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet,
    Image, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { getBarbersV2, getServiceCategories } from '../../services/api';

// ─── Rating Stars ─────────────────────────────────────────────────────────────
const Stars = ({ rating }) => {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5;
    return (
        <Text style={styles.stars}>
            {'★'.repeat(full)}{half ? '½' : ''}{'☆'.repeat(5 - full - (half ? 1 : 0))}
        </Text>
    );
};

// ─── Barber Card ──────────────────────────────────────────────────────────────
const BarberCard = ({ item, selected, onSelect, theme }) => {
    const profileImage = item._resolvedImage || item.profileImage || item.user?.profile_image || null;
    const rating = item.rating?.average || 0;
    const ratingCount = item.rating?.count || 0;

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onSelect(item)}
            style={[
                styles.card,
                { backgroundColor: theme.card, borderColor: theme.border },
                selected && { borderColor: theme.primary, borderWidth: 2 },
            ]}
        >
            {/* Profile image */}
            <Image
                source={profileImage ? { uri: profileImage } : require('../../../assets/barber.png')}
                style={styles.avatar}
            />

            {/* Online indicator */}
            {item.isOnline && <View style={[styles.onlineDot, { borderColor: theme.card }]} />}

            <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.name, { color: theme.text }]}>
                            {item.user?.username || 'Barber'}
                        </Text>
                        <View style={styles.ratingRow}>
                            <Stars rating={rating} />
                            <Text style={[styles.ratingText, { color: theme.textMuted }]}>
                                {' '}{rating.toFixed(1)} ({ratingCount})
                            </Text>
                        </View>
                    </View>

                    {/* Experience badge */}
                    <View style={[styles.expBadge, { backgroundColor: theme.primary + '15' }]}>
                        <Text style={[styles.expText, { color: theme.primary }]}>
                            {item.experience_years}yr
                        </Text>
                    </View>
                </View>

                {/* Service tags */}
                {(item.services || []).length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagRow}>
                        {item.services.map(tag => (
                            <View key={tag} style={[styles.tag, { backgroundColor: theme.border }]}>
                                <Text style={[styles.tagText, { color: theme.textMuted }]}>{tag}</Text>
                            </View>
                        ))}
                    </ScrollView>
                )}

                {/* Bio preview */}
                {item.bio ? (
                    <Text style={[styles.bio, { color: theme.textLight }]} numberOfLines={2}>
                        {item.bio}
                    </Text>
                ) : null}
            </View>

            {/* Selected checkmark */}
            {selected && (
                <View style={[styles.checkCircle, { backgroundColor: theme.primary }]}>
                    <Text style={styles.checkMark}>✓</Text>
                </View>
            )}
        </TouchableOpacity>
    );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function BarberSelectionScreen({ navigation, route }) {
    const { theme } = useTheme();
    const { service } = route.params || {};

    const [barbers, setBarbers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [categories, setCategories] = useState([]);
    const [activeCategory, setActiveCategory] = useState('All');
    const [selected, setSelected] = useState(null);

    // Fetch barbers (optionally filtered by service category)
    const fetchBarbers = useCallback(async (cat) => {
        try {
            const params = {};
            if (cat && cat !== 'All') params.services = cat;
            const list = await getBarbersV2(params);
            setBarbers(list);
        } catch (e) {
            console.error('Fetch barbers error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Fetch valid service categories
    const fetchCategories = useCallback(async () => {
        const list = await getServiceCategories();
        setCategories(['All', ...list]);
    }, []);

    useEffect(() => {
        fetchCategories();
        fetchBarbers(null);
    }, [fetchCategories, fetchBarbers]);

    const handleCategoryFilter = (cat) => {
        setActiveCategory(cat);
        fetchBarbers(cat === 'All' ? null : cat);
    };

    const handleNext = () => {
        if (!selected) return;
        navigation.navigate('BarberDetails', {
            service,
            barber: selected,
            barberId: selected.user?._id || selected._id,
            barberName: selected.user?.username,
        });
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} style={{ flex: 1 }} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.background }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                    <Text style={{ fontSize: 24, color: theme.text }}>←</Text>
                </TouchableOpacity>
                <View>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Select Barber</Text>
                    {service && (
                        <Text style={[styles.headerSubtitle, { color: theme.primary }]}>
                            for {service.name}
                        </Text>
                    )}
                </View>
                <View style={{ width: 40 }} />
            </View>

            {/* Service filter */}
            <FlatList
                data={categories}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={i => i}
                contentContainerStyle={styles.filterRow}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        onPress={() => handleCategoryFilter(item)}
                        style={[
                            styles.filterChip,
                            { borderColor: theme.border, backgroundColor: theme.card },
                            activeCategory === item && { backgroundColor: theme.primary, borderColor: theme.primary },
                        ]}
                    >
                        <Text style={[
                            styles.filterText, { color: theme.textMuted },
                            activeCategory === item && { color: '#FFF', fontWeight: '700' },
                        ]}>
                            {item}
                        </Text>
                    </TouchableOpacity>
                )}
            />

            {/* Barber list */}
            <FlatList
                data={barbers}
                keyExtractor={item => item._id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); fetchBarbers(activeCategory === 'All' ? null : activeCategory); }}
                        tintColor={theme.primary}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={{ fontSize: 40 }}>💈</Text>
                        <Text style={[styles.emptyText, { color: theme.textLight }]}>No barbers available</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <BarberCard
                        item={item}
                        selected={selected?._id === item._id}
                        onSelect={b => setSelected(prev => prev?._id === b._id ? null : b)}
                        theme={theme}
                    />
                )}
            />

            {/* Bottom CTA */}
            {selected && (
                <View style={[styles.bottomBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
                    <Image
                        source={selected.user?.profile_image
                            ? { uri: selected.user.profile_image }
                            : require('../../../assets/barber.png')}
                        style={styles.bottomAvatar}
                    />
                    <View style={{ flex: 1, marginHorizontal: 12 }}>
                        <Text style={[styles.bottomName, { color: theme.text }]}>
                            {selected.user?.username}
                        </Text>
                        <Text style={[styles.bottomRating, { color: theme.textMuted }]}>
                            {selected.rating?.average > 0 ? `⭐ ${selected.rating.average.toFixed(1)}` : '✨ New Barber'}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.nextBtn, { backgroundColor: theme.primary }]}
                        onPress={handleNext}
                    >
                        <Text style={styles.nextBtnText}>Pick Time →</Text>
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 14,
    },
    iconBtn: { padding: 6 },
    headerTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
    headerSubtitle: { fontSize: 12, textAlign: 'center', marginTop: 2 },
    filterRow: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
    filterChip: {
        paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 20, borderWidth: 1, marginRight: 8,
    },
    filterText: { fontSize: 13 },
    listContent: { paddingHorizontal: 20, paddingBottom: 130 },
    card: {
        borderRadius: 16, padding: 16, marginBottom: 14,
        flexDirection: 'row', alignItems: 'flex-start',
        borderWidth: 1, position: 'relative',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
    },
    avatar: { width: 64, height: 64, borderRadius: 32, marginRight: 14 },
    onlineDot: {
        position: 'absolute', top: 14, left: 62,
        width: 14, height: 14, borderRadius: 7,
        backgroundColor: '#22c55e', borderWidth: 2,
    },
    cardContent: { flex: 1 },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
    name: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
    ratingRow: { flexDirection: 'row', alignItems: 'center' },
    stars: { color: '#f59e0b', fontSize: 13, letterSpacing: 1 },
    ratingText: { fontSize: 12 },
    expBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    expText: { fontSize: 12, fontWeight: '700' },
    tagRow: { marginBottom: 8 },
    tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginRight: 6 },
    tagText: { fontSize: 11 },
    bio: { fontSize: 13, lineHeight: 18 },
    checkCircle: {
        position: 'absolute', top: 12, right: 12,
        width: 24, height: 24, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
    },
    checkMark: { color: '#FFF', fontSize: 14, fontWeight: '700' },
    emptyState: { alignItems: 'center', paddingTop: 80, gap: 10 },
    emptyText: { fontSize: 16 },
    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1,
    },
    bottomAvatar: { width: 44, height: 44, borderRadius: 22 },
    bottomName: { fontSize: 15, fontWeight: '700' },
    bottomRating: { fontSize: 13, marginTop: 2 },
    nextBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
    nextBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
