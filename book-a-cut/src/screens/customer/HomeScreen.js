import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    Linking,
    Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { getBarbers, getProfile, getMyBookings } from "../../services/api";
import { getUserData } from "../../services/TokenManager";
import { formatDate } from '../../utils/dateUtils';

export default function HomeScreen({ navigation }) {
    const { theme } = useTheme();
    const [barbers, setBarbers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [userName, setUserName] = useState("Guest");
    const [greeting, setGreeting] = useState("Welcome");
    const [upcomingBookings, setUpcomingBookings] = useState([]);
    const [selectedService, setSelectedService] = useState('all');
    const [profileMissing, setProfileMissing] = useState([]);

    const fetchUpcoming = async () => {
        try {
            const bookings = await getMyBookings();
            const now = new Date();

            const future = bookings
                .filter(b => {
                    if (b.status !== 'confirmed' && b.status !== 'pending') return false;
                    // Build the real appointment datetime from date + time_slot
                    const dateStr = new Date(b.date).toISOString().split('T')[0]; // "YYYY-MM-DD"
                    const ts = b.time_slot || '00:00';
                    const [h, m] = ts.split(':').map(Number);
                    const apptTime = new Date(dateStr);
                    apptTime.setHours(h, m, 0, 0);
                    return apptTime > now;
                })
                .sort((a, b) => {
                    const toMs = (booking) => {
                        const ds = new Date(booking.date).toISOString().split('T')[0];
                        const [h, m] = (booking.time_slot || '00:00').split(':').map(Number);
                        const d = new Date(ds); d.setHours(h, m, 0, 0);
                        return d.getTime();
                    };
                    return toMs(a) - toMs(b);
                });

            setUpcomingBookings(future);
        } catch (e) {
            console.log("Error fetching upcoming", e);
        }
    };

    const fetchBarbers = async () => {
        setLoading(true);
        try {
            const data = await getBarbers({ type: 'all' });
            setBarbers(data);
        } catch (error) {
            console.error("Failed to fetch barbers", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchUserProfile = async () => {
        try {
            const user = await getProfile();
            if (user && user.username) {
                setUserName(user.username);

                // Check which fields are missing
                const missing = [];
                if (!user.phone) missing.push('phone number');
                if (!user.profile_image) missing.push('profile photo');
                if (!user.gender) missing.push('gender');
                setProfileMissing(missing);
            }
        } catch (error) {
            console.log('Failed to fetch profile');
        }
    };

    const updateGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting("Good Morning!");
        else if (hour < 18) setGreeting("Good Afternoon!");
        else setGreeting("Good Evening!");
    };

    useEffect(() => {
        const checkUserType = async () => {
            const userData = await getUserData();
            if (userData && userData.user_type === 'admin') {
                navigation.replace('AdminDashboard');
            }
        };

        checkUserType();
        fetchBarbers();
        fetchUserProfile();
        updateGreeting();
        fetchUpcoming();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchBarbers();
        fetchUserProfile();
        updateGreeting();
        fetchUpcoming();
    };

    const filteredBarbers = barbers.filter((barber) => {
        const text = searchText.toLowerCase();

        // match search
        const matchesSearch =
            barber.user.username.toLowerCase().includes(text) ||
            barber.specialization?.join(" ").toLowerCase().includes(text) ||
            barber.service_type.toLowerCase().includes(text);

        // match service filter
        let matchesService = true;

        if (selectedService === "salon") {
            matchesService =
                barber.service_type === "salon" ||
                barber.service_type === "both";
        }

        if (selectedService === "home") {
            matchesService =
                barber.service_type === "home" ||
                barber.service_type === "both";
        }

        return matchesSearch && matchesService;
    });

    const renderBarberCard = ({ item }) => {
        const user = item.user || {};
        const name = user.username || "Barber";
        // _resolvedImage is synced directly on BarberProfile (no populate needed)
        const image = item._resolvedImage || item.profileImage || user.profile_image || null;
        const rating = item.rating?.average || 0;

        return (
            <TouchableOpacity
                style={[styles.card, { backgroundColor: theme.card }]}
                onPress={() => navigation.navigate("BarberDetails", {
                    barber: item,
                    serviceType: selectedService === 'all' ? undefined : selectedService
                })}
            >
                <Image
                    source={image ? { uri: image } : require('../../../assets/barber.png')}
                    style={styles.cardImage}
                />
                <View style={[styles.ratingBadge, { backgroundColor: theme.card }]}>
                    {rating > 0 ? (
                        <>
                            <Text style={styles.star}>★</Text>
                            <Text style={[styles.ratingText, { color: theme.text }]}>{rating.toFixed(1)}</Text>
                        </>
                    ) : (
                        <Text style={[styles.ratingText, { color: theme.textLight }]}>New</Text>
                    )}
                </View>
                <TouchableOpacity style={styles.heartBtn}>
                    <Text style={{ color: '#FFF' }}>❤</Text>
                </TouchableOpacity>

                <View style={styles.cardContent}>
                    <Text style={[styles.barberName, { color: theme.text }]} numberOfLines={1}>{name}</Text>
                    <Text style={[styles.barberLocation, { color: theme.textLight }]}>
                        {item.location?.city || 'Nearby'} • {item.experience_years || 0} yrs exp
                    </Text>

                    <View style={styles.cardFooter}>
                        <Text style={styles.price}>Rs. {
                            selectedService === 'home'
                                ? (item.pricing?.homeValue || item.services?.[0]?.price || 500)
                                : (item.pricing?.salonValue || item.services?.[0]?.price || 500)
                        }</Text>
                        <TouchableOpacity
                            style={[styles.bookBtnSmall, { backgroundColor: theme.primary + '20' }]}
                            onPress={() => navigation.navigate("BarberDetails", {
                                barber: item,
                                serviceType: selectedService === 'all' ? undefined : selectedService
                            })}
                        >
                            <Text style={[styles.bookBtnText, { color: theme.primary }]}>Book Now</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <ScrollView
                contentContainerStyle={styles.scrollContainer}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={[styles.greeting, { color: theme.textLight }]}>Hello, {userName} 👋</Text>
                        <Text style={[styles.headerTitle, { color: theme.text }]}>{greeting}</Text>
                    </View>
                    <View style={styles.headerRight}>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate("Notifications")}>
                            <Text style={{ fontSize: 20 }}>🔔</Text>
                            <View style={styles.notifBadge} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => navigation.navigate("UserProfile")}>
                            {/* Logo instead of Profile Photo as requested */}
                            <View style={styles.logoContainer}>
                                <Text style={{ fontSize: 24 }}>💇‍♂️</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Search Bar */}
                <View style={[styles.searchContainer, { backgroundColor: theme.card }]}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                        style={[styles.searchInput, { color: theme.text }]}
                        placeholder="Find a barber or service..."
                        placeholderTextColor={theme.textLight}
                        value={searchText}
                        onChangeText={setSearchText}
                    />
                </View>

                {/* ── Incomplete Profile Banner ─────────────────────────── */}
                {profileMissing.length > 0 && (
                    <TouchableOpacity
                        style={styles.profileBanner}
                        onPress={() => navigation.navigate('UserProfile')}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.profileBannerIcon}>⚠️</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.profileBannerTitle}>Complete Your Profile</Text>
                            <Text style={styles.profileBannerMsg} numberOfLines={2}>
                                Missing: {profileMissing.join(', ')}. Tap to complete →
                            </Text>
                        </View>
                    </TouchableOpacity>
                )}

                {/* Categories */}
                <View style={styles.categoriesRow}>
                    <TouchableOpacity
                        style={[styles.categoryPill, selectedService === 'all' && styles.catActive]}
                        onPress={() => setSelectedService('all')}
                    >
                        <Text style={selectedService === 'all' ? styles.catTextActive : [styles.catText, { color: theme.text }]}>All</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.categoryPill, selectedService === 'salon' && styles.catActive]}
                        onPress={() => setSelectedService('salon')}
                    >
                        <Text style={selectedService === 'salon' ? styles.catTextActive : [styles.catText, { color: theme.text }]}>💇‍♂️ Salon</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.categoryPill, selectedService === 'home' && styles.catActive]}
                        onPress={() => setSelectedService('home')}
                    >
                        <Text style={selectedService === 'home' ? styles.catTextActive : [styles.catText, { color: theme.text }]}>🏠 Home</Text>
                    </TouchableOpacity>
                </View>

                {/* Upcoming Appointments */}
                {upcomingBookings.length > 0 ? (
                    <>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>
                                Upcoming Appointments
                                {upcomingBookings.length > 1 ? (
                                    <Text style={{ color: theme.primary, fontSize: 14 }}> ({upcomingBookings.length})</Text>
                                ) : null}
                            </Text>
                            <TouchableOpacity onPress={() => navigation.navigate('MyBookings')}>
                                <Text style={[styles.seeAll, { color: theme.primary }]}>View All</Text>
                            </TouchableOpacity>
                        </View>

                        {upcomingBookings.map((booking, index) => {
                            const ts = booking.time_slot || '';
                            let timeDisplay = '';
                            if (ts) {
                                const [h, m] = ts.split(':').map(Number);
                                const period = h >= 12 ? 'PM' : 'AM';
                                const hour12 = h % 12 === 0 ? 12 : h % 12;
                                timeDisplay = `${hour12}:${String(m).padStart(2, '0')} ${period}`;
                            }

                            return (
                                <View key={booking._id || index} style={[styles.upcomingCard, index > 0 && { marginTop: -10, opacity: 0.95 }]}>
                                    <View style={styles.upcomingHeader}>
                                        <Image
                                            source={booking.barber?.profile_image ? { uri: booking.barber.profile_image } : require('../../../assets/barber.png')}
                                            style={styles.upcomingAvatar}
                                        />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.upcomingName}>
                                                {booking.barber?.username || booking.barberName || 'Barber'}
                                            </Text>
                                            <View style={styles.statusBadge}>
                                                <Text style={styles.statusText}>
                                                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                                                </Text>
                                            </View>
                                        </View>
                                        {booking.service?.name ? (
                                            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, maxWidth: 90, textAlign: 'right' }}>
                                                ✂️ {booking.service.name}
                                            </Text>
                                        ) : null}
                                    </View>

                                    <View style={styles.upcomingTimeRow}>
                                        <Text style={{ color: '#FFF', fontSize: 16, marginRight: 8 }}>📅</Text>
                                        <Text style={styles.upcomingTime}>{formatDate(booking.date)}, {timeDisplay}</Text>
                                    </View>

                                    <View style={styles.divider} />

                                    <View style={styles.upcomingActions}>
                                        <TouchableOpacity
                                            style={styles.actionBtnWhite}
                                            onPress={() => {
                                                const coords = booking.barber_location?.coordinates;
                                                const profileCoords = booking.barber?.location?.coordinates;
                                                const address =
                                                    booking.barber?.location?.address ||
                                                    booking.barber?.location?.city ||
                                                    booking.barber?.address ||
                                                    booking.customer_address || '';
                                                if (coords && coords.length === 2) {
                                                    const [lng, lat] = coords;
                                                    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
                                                } else if (profileCoords && profileCoords.length === 2) {
                                                    const [lng, lat] = profileCoords;
                                                    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
                                                } else if (address) {
                                                    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);
                                                } else {
                                                    Alert.alert('No Location', 'Location info not found for this booking.');
                                                }
                                            }}
                                        >
                                            <Text style={styles.actionBtnTextPurple}>Get Directions</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.actionBtnTransparent}
                                            onPress={() => navigation.navigate('BarberDetails', {
                                                barber: booking.barber,
                                                barberId: booking.barber?._id || booking.barber,
                                                serviceType: booking.service_type || 'salon'
                                            })}
                                        >
                                            <Text style={styles.actionBtnTextWhite}>Reschedule</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </>
                ) : null}

                {/* Home Services Banner */}
                <TouchableOpacity
                    style={styles.homeServiceBanner}
                    onPress={() => navigation.navigate("HomeServices", { serviceType: 'home' })}
                >
                    <View style={styles.hsContent}>
                        <Text style={styles.hsTitle}>Book Home Service</Text>
                        <Text style={styles.hsSubtitle}>Haircuts at your doorstep</Text>
                    </View>
                    <View style={styles.hsIcon}>
                        <Text style={{ fontSize: 24 }}>🏠</Text>
                    </View>
                </TouchableOpacity>

                {/* Top Picks */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        Top {selectedService === 'all' ? 'Recommended' : selectedService === 'salon' ? 'Salon' : 'Home'} Barbers
                    </Text>
                    <TouchableOpacity onPress={() => navigation.navigate('HomeServices', { serviceType: selectedService })}><Text style={[styles.seeAll, { color: theme.primary }]}>View All</Text></TouchableOpacity>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} />
                ) : filteredBarbers.length > 0 ? (
                    <FlatList
                        horizontal
                        data={filteredBarbers}
                        renderItem={renderBarberCard}
                        keyExtractor={(item) => item._id || Math.random().toString()}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingRight: 20 }}
                    />
                ) : null}
                {!loading && filteredBarbers.length === 0 && (
                    <Text>No barbers found</Text>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Start AI Floating Button */}
            <TouchableOpacity style={styles.fabBtn} onPress={() => navigation.navigate("AIChat")}>
                <Text style={styles.fabIcon}>✨</Text>
                <Text style={styles.fabText}>Ask AI</Text>
            </TouchableOpacity>

        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8F9FA",
    },
    scrollContainer: {
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
    },
    greeting: {
        fontSize: 14,
        color: "#666",
        marginBottom: 4,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#333",
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconBtn: {
        width: 40,
        height: 40,
        backgroundColor: '#FFF',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    notifBadge: {
        position: 'absolute',
        top: 10,
        right: 12,
        width: 8,
        height: 8,
        backgroundColor: '#FF5252',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#FFF',
    },
    logoImage: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        borderWidth: 2,
        borderColor: '#FFF',
    },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFF",
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderRadius: 16,
        marginBottom: 25,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    searchIcon: {
        fontSize: 18,
        marginRight: 10,
        color: '#999',
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#333',
    },
    categoriesRow: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    categoryPill: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#FFF',
        borderRadius: 20,
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#EEE',
    },
    catActive: {
        backgroundColor: '#9C27B0',
        borderColor: '#9C27B0',
    },
    catText: {
        fontWeight: '600',
        color: '#333',
    },
    catTextActive: {
        fontWeight: '600',
        color: '#FFF',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    seeAll: {
        color: '#9C27B0', // Purple
        fontWeight: '600',
    },
    upcomingCard: {
        backgroundColor: '#9C27B0', // Main Purple
        borderRadius: 20,
        padding: 20,
        marginBottom: 30,
        shadowColor: "#9C27B0",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    upcomingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    upcomingAvatar: {
        width: 50,
        height: 50,
        borderRadius: 12,
        marginRight: 12,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    upcomingName: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    statusBadge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    statusText: {
        color: '#FFF',
        fontSize: 12,
    },
    upcomingTimeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    upcomingTime: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginBottom: 15,
    },
    upcomingActions: {
        flexDirection: 'row',
        gap: 10,
    },
    actionBtnWhite: {
        flex: 1,
        backgroundColor: '#FFF',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    actionBtnTransparent: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    actionBtnTextPurple: {
        color: '#9C27B0',
        fontWeight: 'bold',
        fontSize: 14,
    },
    actionBtnTextWhite: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
    // Home Service Banner
    homeServiceBanner: {
        flexDirection: 'row',
        backgroundColor: '#E1BEE7', // Light Purple
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 30,
        borderWidth: 1,
        borderColor: '#CE93D8',
    },
    hsContent: {
        flex: 1,
    },
    hsTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#4A148C',
        marginBottom: 4,
    },
    hsSubtitle: {
        fontSize: 13,
        color: '#6A1B9A',
    },
    hsIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Barber Card
    card: {
        width: 250,
        backgroundColor: '#FFF',
        borderRadius: 16,
        marginRight: 15,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        marginBottom: 10,
        paddingBottom: 15,
    },
    cardImage: {
        width: '100%',
        height: 140,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        backgroundColor: '#F0F0F0',
    },
    ratingBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: '#FFF',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 8,
    },
    ratingText: {
        fontWeight: 'bold',
        fontSize: 12,
        marginLeft: 4,
    },
    star: {
        color: '#FFB300',
        fontSize: 12,
    },
    heartBtn: {
        position: 'absolute',
        bottom: 95, // Position relative to image/content split
        right: 15,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardContent: {
        paddingHorizontal: 15,
        paddingTop: 10,
    },
    barberName: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    barberLocation: {
        fontSize: 12,
        color: '#888',
        marginBottom: 10,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    price: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#9C27B0',
    },
    bookBtnSmall: {
        backgroundColor: '#F3E5F5',
        paddingHorizontal: 15,
        paddingVertical: 6,
        borderRadius: 8,
    },
    bookBtnText: {
        color: '#9C27B0',
        fontWeight: 'bold',
        fontSize: 12,
    },
    fabBtn: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        backgroundColor: '#1A237E', // Dark Blue/Purple
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 30,
        elevation: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    fabIcon: {
        fontSize: 20,
        marginRight: 8,
        color: '#FFF',
    },
    fabText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    emptyContainer: {
        width: '100%',
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.02)',
        borderRadius: 15,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#CCC',
        marginTop: 10,
    },

    // ── Profile incomplete banner ──────────────────────────────────────
    profileBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF7ED',
        borderWidth: 1.5,
        borderColor: '#F97316',
        borderRadius: 12,
        padding: 12,
        marginHorizontal: 20,
        marginBottom: 12,
        gap: 10,
    },
    profileBannerIcon: { fontSize: 22 },
    profileBannerTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#C2410C',
        marginBottom: 2,
    },
    profileBannerMsg: {
        fontSize: 12,
        color: '#9A3412',
    },
});
