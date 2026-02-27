import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, FlatList, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME } from '../../theme/theme';
import { useTheme } from "../../context/ThemeContext";
import { getBarbers } from "../../services/api";

export default function HomeServicesScreen({ navigation, route }) {
    const { theme } = useTheme();
    const { serviceType } = route.params || { serviceType: 'home' };
    // 'all' means show every barber regardless of type
    const isSalon = serviceType === 'salon';
    const isAll = serviceType === 'all';

    // Header title logic: 'all' → "All Barbers", else filter-specific
    const screenTitle = isAll ? 'All Barbers' : isSalon ? 'Salon Services' : 'Home Services';

    const [selectedCategory, setSelectedCategory] = useState('All');

    // Generate dates dynamically
    const generateDates = () => {
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
    };
    const dates = generateDates();
    const [selectedDate, setSelectedDate] = useState(dates[0].date);

    const categories = ['All', 'Haircut', 'Beard Trim', 'Hair Color', 'Facial', 'Kids Cut', 'Shave', 'Others'];

    // Real Data State
    const [scannedBarbers, setScannedBarbers] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchHomeBarbers = async (category = selectedCategory, dateNum = selectedDate) => {
        setLoading(true);
        try {
            // Find the full date object to pass a real ISO date string if needed
            const dateObj = dates.find(d => d.date === dateNum);
            const formattedDate = dateObj ? dateObj.fullDate.toISOString().split('T')[0] : '';

            // For 'all', don't pass a type filter — let the backend return everyone
            const filtered = await getBarbers({
                type: isAll ? undefined : serviceType,
                service: category.toLowerCase() === 'all' ? 'all' : category,
                date: formattedDate
            });
            setScannedBarbers(filtered || []);
            console.log(`✅ Found ${filtered?.length || 0} barbers for ${serviceType} - ${category} on ${formattedDate}`);
        } catch (error) {
            console.log("Error:", error);
            setScannedBarbers([]);
        } finally {
            setLoading(false);
        }
    };

    // Handle returned date from full calendar
    React.useEffect(() => {
        if (route.params?.returnedDate) {
            setSelectedDate(new Date(route.params.returnedDate).getDate());
            fetchHomeBarbers();
        }
    }, [route.params?.returnedDate]);

    // Refetch when screen focuses OR category changes OR date changes
    React.useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            fetchHomeBarbers();
        });

        fetchHomeBarbers();
        return unsubscribe;
    }, [navigation, selectedCategory, selectedDate]);

    // Map scannedBarbers to view
    const barbers = scannedBarbers.map(b => ({
        id: b._id,
        name: b.user?.username || b.username || "Barber",
        title: b.services?.[0] || 'Professional',
        rating: b.rating?.average || 0,
        reviews: b.rating?.count || 0,
        price: isSalon
            ? (b.pricing?.salonValue || b.services?.[0]?.price || 'N/A')
            : (b.pricing?.homeValue || b.services?.[0]?.price || 'N/A'),
        image: b._resolvedImage || b.profileImage || b.user?.profile_image || null,
        availability: b.isOnline ? 'Online Now' : 'Offline',
        distance: b.location?.city || 'Nearby',
        verified: b.is_verified_barber || false,
        isOnline: b.isOnline,
        isPromoted: b.is_verified_barber, // Promote verified barbers
        raw: b // Keep original data
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
                selectedDate === item.date && { backgroundColor: theme.primary, shadowColor: theme.primary }
            ]}
            onPress={() => setSelectedDate(item.date)}
        >
            <Text style={[
                styles.dayText,
                { color: theme.textLight },
                selectedDate === item.date && styles.textWhite
            ]}>{item.day}</Text>
            <Text style={[
                styles.dateText,
                { color: theme.text },
                selectedDate === item.date && styles.textWhite
            ]}>{item.date}</Text>
        </TouchableOpacity>
    );

    const renderBarber = ({ item }) => (
        <View style={[styles.barberCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {/* 🔥 ALL BARBERS: Navigate to Details Screen */}
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => navigation.navigate('BarberDetails', {
                    barber: item.raw,
                    barberId: item.raw.user?._id || item.raw._id,
                    serviceType: serviceType
                })}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.imageContainer}>
                        <Image source={item.image ? { uri: item.image } : require('../../../assets/barber.png')} style={[styles.avatar, { backgroundColor: theme.inputBg }]} />
                        <View style={[
                            styles.ratingBadge,
                            item.isOnline && { backgroundColor: '#4CAF50' }
                        ]}>
                            <Text style={styles.ratingText}>
                                {item.isOnline ? '🟢' : '🔴'} {item.rating > 0 ? `${item.rating.toFixed(1)}★` : 'New'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.cardInfo}>
                        <View style={styles.nameRow}>
                            <Text style={[styles.barberName, { color: theme.text }]}>{item.name}</Text>
                            <Text style={[styles.priceText, { color: theme.text }]}>Rs.{item.price}</Text>
                        </View>

                        <Text style={[styles.roleText, { color: theme.textLight }]}>{item.title}</Text>
                        <View style={styles.metaRow}>
                            <Text style={[styles.metaText, { color: theme.textMuted }]}>🕒 {item.availability}</Text>
                            <Text style={[styles.dot, { color: theme.border }]}>•</Text>
                            <Text style={[styles.metaText, { color: theme.textMuted }]}> {item.distance}</Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.bookBtnPromoted, { backgroundColor: theme.primary }]}
                onPress={() => navigation.navigate('BarberDetails', {
                    barber: item.raw,
                    barberId: item.raw.user?._id || item.raw._id,
                    serviceType: serviceType
                })}
            >
                <Text style={styles.bookBtnTextPromoted}>See Details & Book →</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                    <Text style={[styles.iconText, { color: theme.text }]}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>{screenTitle}</Text>
                <TouchableOpacity style={styles.iconBtn}>
                    <Text style={[styles.iconText, { color: theme.text }]}>🗺️</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Location Bar */}
                <TouchableOpacity style={[styles.locationBar, { backgroundColor: theme.inputBg }]} onPress={() => alert("Location edit coming soon!")}>
                    <View style={styles.locationIconBg}>
                        <Text>📍</Text>
                    </View>
                    <Text style={[styles.locationText, { color: theme.text }]} numberOfLines={1}>Kathmandu, Nepal</Text>
                    <Text style={[styles.editText, { color: theme.primary }]}>Edit</Text>
                </TouchableOpacity>

                {/* Title Section */}
                <View style={styles.sectionContainer}>
                    <Text style={[styles.mainTitle, { color: theme.text }]}>Find a Barber near you</Text>
                    <Text style={[styles.subTitle, { color: theme.textLight }]}>Select a service and date to see available pros.</Text>
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

                {/* Calendar Section */}
                <View style={styles.calendarHeader}>
                    <Text style={[styles.monthTitle, { color: theme.text }]}>{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</Text>
                    <TouchableOpacity onPress={() => navigation.navigate("Calendar", {
                        fromScreen: 'HomeServices',
                        serviceType: serviceType
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

                {/* Results Header */}
                <Text style={[styles.resultHeader, { color: theme.text }]}>{barbers.length} Barbers available nearby</Text>

                {/* Barber List */}
                <View style={styles.listContainer}>
                    {barbers.map((barber) => (
                        <View key={barber.id}>
                            {renderBarber({ item: barber })}
                        </View>
                    ))}
                </View>

                <View style={{ height: 80 }} />
            </ScrollView>

            {/* AI FAB */}
            <TouchableOpacity style={[styles.fab, { backgroundColor: theme.primary, shadowColor: theme.primary }]}>
                <Text style={{ fontSize: 24, color: '#FFF' }}>✨</Text>
            </TouchableOpacity>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    iconBtn: {
        padding: 5,
    },
    iconText: {
        fontSize: 24,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    scrollContent: {
        paddingBottom: 20,
    },
    locationBar: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 20,
        padding: 12,
        borderRadius: 12,
        marginBottom: 20,
    },
    locationIconBg: {
        width: 30,
        height: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    locationText: {
        flex: 1,
        fontSize: 14,
    },
    editText: {
        fontWeight: 'bold',
    },
    sectionContainer: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    mainTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    subTitle: {
        fontSize: 14,
    },
    categoryContainer: {
        marginBottom: 25,
    },
    categoryChip: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 25,
        borderWidth: 1,
    },
    categoryText: {
        fontWeight: '600',
    },
    categoryTextActive: {
        color: '#FFF',
    },
    calendarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 15,
    },
    monthTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    viewCalendar: {
        fontWeight: '600',
    },
    dateContainer: {
        marginBottom: 30,
    },
    dateItem: {
        width: 60,
        height: 70,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10, // gap
    },
    dayText: {
        fontSize: 12,
        marginBottom: 4,
    },
    dateText: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    textWhite: {
        color: '#FFF',
    },
    resultHeader: {
        fontSize: 16,
        fontWeight: 'bold',
        paddingHorizontal: 20,
        marginBottom: 15,
    },
    listContainer: {
        paddingHorizontal: 20,
        gap: 15,
    },
    barberCard: {
        borderRadius: 16,
        padding: 15,
        marginBottom: 15,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        marginBottom: 15,
    },
    imageContainer: {
        marginRight: 15,
    },
    avatar: {
        width: 70,
        height: 70,
        borderRadius: 12,
    },
    ratingBadge: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
        paddingVertical: 2,
        alignItems: 'center',
    },
    ratingText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    cardInfo: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    barberName: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    priceText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    verifiedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    verifiedText: {
        fontSize: 12,
        fontWeight: '600',
    },
    roleText: {
        fontSize: 12,
        marginBottom: 6,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metaText: {
        fontSize: 12,
    },
    dot: {
        marginHorizontal: 5,
    },
    bookBtnPromoted: {
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    bookBtnTextPromoted: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
    bookBtnOutline: {
        backgroundColor: '#F5F5F5',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    bookBtnTextOutline: {
        color: '#333',
        fontWeight: 'bold',
        fontSize: 14,
    },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
    }
});
