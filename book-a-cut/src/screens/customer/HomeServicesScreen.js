// screens/customer/HomeServicesScreen.js
import React, { useState, useRef } from 'react';
import {
    View, Text, StyleSheet, Image, TouchableOpacity,
    ScrollView, FlatList, TextInput, ActivityIndicator, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from "../../context/ThemeContext";
import { getBarbers } from "../../services/api";

export default function HomeServicesScreen({ navigation, route }) {
    const { theme } = useTheme();
    const { serviceType } = route.params || { serviceType: 'home' };
    const isSalon = serviceType === 'salon';
    const isAll = serviceType === 'all';
    const screenTitle = isAll ? 'All Barbers' : isSalon ? 'Salon Services' : 'Home Services';

    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedDate, setSelectedDate] = useState(generateDates()[0].date);
    const [scannedBarbers, setScannedBarbers] = useState([]);
    const [loading, setLoading] = useState(true);

    // ✅ FIX: Location search state
    const [locationText, setLocationText] = useState('');
    const [locationInput, setLocationInput] = useState('');
    const [showLocationModal, setShowLocationModal] = useState(false);

    const categories = ['All', 'Haircut', 'Beard Trim', 'Hair Color', 'Facial', 'Kids Cut', 'Shave', 'Others'];

    function generateDates() {
        const days = [];
        const today = new Date();
        const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        for (let i = 0; i < 5; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            days.push({
                day: daysOfWeek[date.getDay()],
                date: date.getDate(),
                fullDate: date
            });
        }
        return days;
    }

    const dates = generateDates();

    const fetchHomeBarbers = async (
        category = selectedCategory,
        dateNum = selectedDate,
        cityFilter = locationText
    ) => {
        setLoading(true);
        try {
            const dateObj = dates.find(d => d.date === dateNum);
            const formattedDate = dateObj ? dateObj.fullDate.toISOString().split('T')[0] : '';

            // Only filter by location if user typed something specific (not empty/default)
            const isDefaultLocation =
                cityFilter === 'Kathmandu, Nepal' ||
                cityFilter === 'Kathmandu' ||
                cityFilter === '' ||
                !cityFilter;

            const filtered = await getBarbers({
                // Don't pass type for 'all' — backend shows everyone without a serviceMode filter
                ...(serviceType && serviceType !== 'all' && { type: serviceType }),
                ...(category && category !== 'All' && { service: category }),
                date: formattedDate,
                // Only send city/search when user typed something specific (not Kathmandu default)
                ...(!isDefaultLocation && cityFilter && {
                    city: cityFilter.trim(),
                    search: cityFilter.trim(),
                }),
            });

            setScannedBarbers(filtered || []);
        } catch (error) {
            console.log("Error fetching barbers:", error);
            setScannedBarbers([]);
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        if (route.params?.returnedDate) {
            setSelectedDate(new Date(route.params.returnedDate).getDate());
        }
    }, [route.params?.returnedDate]);

    React.useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            fetchHomeBarbers();
        });
        fetchHomeBarbers();
        return unsubscribe;
    }, [navigation, selectedCategory, selectedDate]);

    // ✅ FIX: Apply location search
    const handleLocationSearch = () => {
        const trimmed = locationInput.trim();
        if (!trimmed) return;
        setLocationText(trimmed);
        setShowLocationModal(false);
        fetchHomeBarbers(selectedCategory, selectedDate, trimmed);
    };

    const handleClearLocation = () => {
        setLocationInput('');
    };

    // ✅ FIX: Correct price logic
    const getBarberPrice = (b) => {
        // Priority 1: pricing object from barber profile
        if (isSalon && b.pricing?.salonValue && b.pricing.salonValue > 0) {
            return `Rs. ${b.pricing.salonValue}`;
        }
        if (!isSalon && b.pricing?.homeValue && b.pricing.homeValue > 0) {
            return `Rs. ${b.pricing.homeValue}`;
        }

        // Priority 2: first offered service price
        const firstService = b.offeredServices?.[0] || b.services_list?.[0];
        if (firstService?.price && firstService.price > 0) {
            return `Rs. ${firstService.price}`;
        }

        // Priority 3: show starting from if any number found
        if (b.pricing?.salonValue > 0) return `Rs. ${b.pricing.salonValue}`;
        if (b.pricing?.homeValue > 0) return `Rs. ${b.pricing.homeValue}`;

        return 'Ask Price';
    };

    // Map scannedBarbers to view model
    const barbers = scannedBarbers.map(b => ({
        id: b._id,
        name: b.user?.username || b.username || "Barber",
        title: Array.isArray(b.services) && b.services.length > 0
            ? b.services[0]
            : 'Professional Barber',
        rating: b.rating?.average || 0,
        reviews: b.rating?.count || 0,
        // ✅ FIX: Use correct price function
        price: getBarberPrice(b),
        image: b.user?.profile_image || null,
        availability: b.isOnline ? 'Online Now' : 'Offline',
        // ✅ FIX: Show actual saved location
        distance: b.location?.city
            || b.location?.address
            || b.location?.serviceArea
            || 'Nearby',
        isOnline: b.isOnline,
        raw: b
    }));

    const renderCategory = ({ item }) => (
        <TouchableOpacity
            style={[
                styles.categoryChip,
                { backgroundColor: theme.card, borderColor: theme.border },
                selectedCategory === item && { backgroundColor: theme.primary, borderColor: theme.primary }
            ]}
            onPress={() => setSelectedCategory(item)}
        >
            <Text style={[
                styles.categoryText,
                { color: selectedCategory === item ? '#FFF' : theme.textMuted },
            ]}>
                {item}
            </Text>
        </TouchableOpacity>
    );

    const renderDate = ({ item }) => (
        <TouchableOpacity
            style={[
                styles.dateItem,
                { backgroundColor: theme.card },
                selectedDate === item.date && { backgroundColor: theme.primary }
            ]}
            onPress={() => setSelectedDate(item.date)}
        >
            <Text style={[
                styles.dayText, { color: theme.textLight },
                selectedDate === item.date && { color: '#FFF' }
            ]}>{item.day}</Text>
            <Text style={[
                styles.dateText, { color: theme.text },
                selectedDate === item.date && { color: '#FFF' }
            ]}>{item.date}</Text>
        </TouchableOpacity>
    );

    const renderBarber = ({ item }) => (
        <View style={[styles.barberCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => navigation.navigate('BarberDetails', {
                    barber: item.raw,
                    barberId: item.raw.user?._id || item.raw._id,
                    serviceType
                })}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.imageContainer}>
                        <Image
                            source={item.image ? { uri: item.image } : require('../../../assets/barber.png')}
                            style={[styles.avatar, { backgroundColor: theme.inputBg }]}
                        />
                        <View style={[
                            styles.ratingBadge,
                            { backgroundColor: item.isOnline ? '#4CAF50' : 'rgba(0,0,0,0.7)' }
                        ]}>
                            <Text style={styles.ratingText}>
                                {item.isOnline ? '🟢' : '🔴'} {item.rating > 0 ? `${item.rating.toFixed(1)}★` : 'New'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.cardInfo}>
                        <View style={styles.nameRow}>
                            <Text style={[styles.barberName, { color: theme.text }]}>{item.name}</Text>
                            {/* ✅ FIX: Shows real price now */}
                            <Text style={[styles.priceText, { color: theme.primary }]}>{item.price}</Text>
                        </View>
                        <Text style={[styles.roleText, { color: theme.textLight }]}>{item.title}</Text>
                        <View style={styles.metaRow}>
                            <Text style={[styles.metaText, { color: theme.textMuted }]}>
                                🕒 {item.availability}
                            </Text>
                            <Text style={[styles.dot, { color: theme.border }]}>•</Text>
                            {/* ✅ FIX: Shows barber's actual saved location */}
                            <Text style={[styles.metaText, { color: theme.textMuted }]}>
                                📍 {item.distance}
                            </Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.bookBtn, { backgroundColor: theme.primary }]}
                onPress={() => navigation.navigate('BarberDetails', {
                    barber: item.raw,
                    barberId: item.raw.user?._id || item.raw._id,
                    serviceType
                })}
            >
                <Text style={styles.bookBtnText}>See Details & Book →</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                    <Text style={[styles.iconText, { color: theme.text }]}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>{screenTitle}</Text>
                <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => navigation.navigate('NearbyMap', { filter: serviceType })}
                >
                    <Text style={[styles.iconText, { color: theme.primary }]}>🗺️</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* ✅ FIX: Location search bar — now clickable and searchable */}
                <TouchableOpacity
                    style={[styles.locationBar, { backgroundColor: theme.inputBg }]}
                    onPress={() => {
                        setLocationInput('');
                        setShowLocationModal(true);
                    }}
                >
                    <Text style={{ fontSize: 18, marginRight: 8 }}>📍</Text>
                    <Text style={[styles.locationText, { color: locationText ? theme.text : theme.textMuted }]} numberOfLines={1}>
                        {locationText || 'Search by city or area...'}
                    </Text>
                    <Text style={[styles.editText, { color: theme.primary }]}>Edit</Text>
                </TouchableOpacity>

                {/* Title */}
                <View style={styles.sectionContainer}>
                    <Text style={[styles.mainTitle, { color: theme.text }]}>Find a Barber near you</Text>
                    <Text style={[styles.subTitle, { color: theme.textLight }]}>
                        Select a service and date to see available pros.
                    </Text>
                </View>

                {/* Categories */}
                <View style={styles.categoryContainer}>
                    <FlatList
                        data={categories}
                        renderItem={renderCategory}
                        keyExtractor={item => item}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}
                    />
                </View>

                {/* Calendar */}
                <View style={styles.calendarHeader}>
                    <Text style={[styles.monthTitle, { color: theme.text }]}>
                        {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </Text>
                    <TouchableOpacity onPress={() => navigation.navigate("Calendar", {
                        fromScreen: 'HomeServices',
                        serviceType
                    })}>
                        <Text style={[styles.viewCalendar, { color: theme.primary }]}>View Calendar</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.dateContainer}>
                    <FlatList
                        data={dates}
                        renderItem={renderDate}
                        keyExtractor={item => item.day}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ justifyContent: 'space-between', flexGrow: 1, paddingHorizontal: 20 }}
                    />
                </View>

                {/* Results bar */}
                <View style={styles.resultsBar}>
                    <Text style={[styles.resultHeader, { color: theme.text }]}>
                        {loading ? 'Searching...' : `${barbers.length} Barbers available`}
                        {locationText !== '' && locationText !== 'Kathmandu, Nepal' && locationText !== 'Kathmandu' && (
                            <Text style={{ color: theme.primary }}> in {locationText}</Text>
                        )}
                    </Text>
                    <TouchableOpacity
                        style={[styles.mapBtn, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '40' }]}
                        onPress={() => navigation.navigate('NearbyMap', { filter: serviceType })}
                    >
                        <Text style={[styles.mapBtnText, { color: theme.primary }]}>🗺️ Map</Text>
                    </TouchableOpacity>
                </View>

                {/* Barber List */}
                {loading ? (
                    <ActivityIndicator color={theme.primary} size="large" style={{ marginTop: 40 }} />
                ) : barbers.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Text style={{ fontSize: 40, marginBottom: 12 }}>🔍</Text>
                        <Text style={[styles.emptyTitle, { color: theme.text }]}>
                            No barbers found in "{locationText}"
                        </Text>
                        <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                            Try searching a different city or area
                        </Text>
                        <TouchableOpacity
                            style={[styles.clearBtn, { backgroundColor: theme.primary }]}
                            onPress={handleClearLocation}
                        >
                            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Show All Barbers</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.listContainer}>
                        {barbers.map((barber) => (
                            <View key={barber.id}>
                                {renderBarber({ item: barber })}
                            </View>
                        ))}
                    </View>
                )}

                <View style={{ height: 80 }} />
            </ScrollView>

            {/* AI FAB */}
            <TouchableOpacity
                style={[styles.fab, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
                onPress={() => navigation.navigate('AIChat')}
            >
                <Text style={{ fontSize: 24, color: '#FFF' }}>✨</Text>
            </TouchableOpacity>

            {/* ✅ FIX: Location Search Modal */}
            <Modal
                visible={showLocationModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowLocationModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalBox, { backgroundColor: theme.card }]}>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>
                            🔍 Search by Location
                        </Text>
                        <Text style={[styles.modalSub, { color: theme.textMuted }]}>
                            Enter a city or area to find barbers near you
                        </Text>

                        <TextInput
                            style={[styles.locationInput, {
                                color: theme.text,
                                borderColor: theme.primary,
                                backgroundColor: theme.background
                            }]}
                            placeholder="e.g. Pokhara, Balkumari, Thamel..."
                            placeholderTextColor={theme.textMuted}
                            value={locationInput}
                            onChangeText={setLocationInput}
                            autoFocus
                            returnKeyType="search"
                            onSubmitEditing={handleLocationSearch}
                        />

                        {/* Quick location suggestions */}
                        <Text style={[styles.suggestLabel, { color: theme.textMuted }]}>
                            Quick Select:
                        </Text>
                        <View style={styles.suggestRow}>
                            {['Kathmandu', 'Pokhara', 'Lalitpur', 'Bhaktapur', 'Thamel', 'Balkumari'].map(city => (
                                <TouchableOpacity
                                    key={city}
                                    style={[styles.suggestChip, {
                                        backgroundColor: locationInput === city
                                            ? theme.primary
                                            : theme.inputBg,
                                        borderColor: theme.border
                                    }]}
                                    onPress={() => {
                                        setLocationInput(city);
                                    }}
                                >
                                    <Text style={{
                                        color: locationInput === city ? '#fff' : theme.text,
                                        fontSize: 13,
                                        fontWeight: '600'
                                    }}>
                                        {city}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: '#eee' }]}
                                onPress={() => setShowLocationModal(false)}
                            >
                                <Text style={{ color: '#333', fontWeight: '600' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: '#FF5722' }]}
                                onPress={handleClearLocation}
                            >
                                <Text style={{ color: '#fff', fontWeight: '600' }}>Clear</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                                onPress={() => {
                                    const trimmed = locationInput.trim();
                                    if (!trimmed) {
                                        setLocationText('');
                                        setShowLocationModal(false);
                                        fetchHomeBarbers(selectedCategory, selectedDate, '');
                                    } else {
                                        handleLocationSearch();
                                    }
                                }}
                            >
                                <Text style={{ color: '#fff', fontWeight: '600' }}>Search</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15 },
    iconBtn: { padding: 5 },
    iconText: { fontSize: 24 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    scrollContent: { paddingBottom: 20 },

    locationBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, padding: 12, borderRadius: 12, marginBottom: 20 },
    locationText: { flex: 1, fontSize: 14 },
    editText: { fontWeight: 'bold' },

    sectionContainer: { paddingHorizontal: 20, marginBottom: 20 },
    mainTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
    subTitle: { fontSize: 14 },

    categoryContainer: { marginBottom: 25 },
    categoryChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25, borderWidth: 1 },
    categoryText: { fontWeight: '600' },

    calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 },
    monthTitle: { fontSize: 18, fontWeight: 'bold' },
    viewCalendar: { fontWeight: '600' },

    dateContainer: { marginBottom: 30 },
    dateItem: { width: 60, height: 70, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    dayText: { fontSize: 12, marginBottom: 4 },
    dateText: { fontSize: 18, fontWeight: 'bold' },

    resultsBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 15 },
    resultHeader: { fontSize: 15, fontWeight: 'bold', flex: 1 },
    mapBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
    mapBtnText: { fontSize: 13, fontWeight: '700' },

    listContainer: { paddingHorizontal: 20, gap: 15 },
    barberCard: { borderRadius: 16, padding: 15, marginBottom: 15, borderWidth: 1, elevation: 2 },
    cardHeader: { flexDirection: 'row', marginBottom: 15 },
    imageContainer: { marginRight: 15 },
    avatar: { width: 70, height: 70, borderRadius: 12 },
    ratingBadge: { position: 'absolute', bottom: 0, left: 0, right: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, paddingVertical: 2, alignItems: 'center' },
    ratingText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
    cardInfo: { flex: 1 },
    nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    barberName: { fontSize: 16, fontWeight: 'bold', flex: 1 },
    priceText: { fontSize: 15, fontWeight: 'bold' },
    roleText: { fontSize: 12, marginBottom: 6 },
    metaRow: { flexDirection: 'row', alignItems: 'center' },
    metaText: { fontSize: 12 },
    dot: { marginHorizontal: 5 },
    bookBtn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
    bookBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },

    // Empty state
    emptyBox: { alignItems: 'center', padding: 40 },
    emptyTitle: { fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    emptySub: { fontSize: 13, textAlign: 'center', marginBottom: 20 },
    clearBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },

    // FAB
    fab: { position: 'absolute', bottom: 30, right: 20, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 6 },

    // ✅ Location modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalBox: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
    modalSub: { fontSize: 13, marginBottom: 16 },
    locationInput: { borderWidth: 2, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 16 },
    suggestLabel: { fontSize: 12, fontWeight: '600', marginBottom: 10 },
    suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
    suggestChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    modalActions: { flexDirection: 'row', gap: 10 },
    modalBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
});
