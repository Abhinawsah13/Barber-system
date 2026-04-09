import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    Animated,
    ScrollView,
    Dimensions,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { getNearbyBarbers } from '../../services/api';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width - 80;

// ─── Service-type badge helper ─────────────────────────────────────────────────
const ServiceBadge = ({ type }) => {
    const color = type === 'home' ? '#4CAF50' : type === 'salon' ? '#9C27B0' : '#2196F3';
    const label = type === 'home' ? '🏠 Home' : type === 'salon' ? '💈 Salon' : '🔀 Both';
    return (
        <View style={[badgeStyles.badge, { backgroundColor: color + '20', borderColor: color + '60' }]}>
            <Text style={[badgeStyles.text, { color }]}>{label}</Text>
        </View>
    );
};

const badgeStyles = StyleSheet.create({
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
    text: { fontSize: 11, fontWeight: '700' },
});

// ─── Star rating component ─────────────────────────────────────────────────────
const Stars = ({ rating }) => {
    const stars = Math.round(rating);
    return (
        <Text style={{ color: '#F59E0B', fontSize: 12 }}>
            {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
        </Text>
    );
};

// ─── Derive service type from barber data ──────────────────────────────────────
function getServiceType(barber) {
    const { salon, home } = barber.serviceModes || {};
    if (salon && home) return 'both';
    if (home) return 'home';
    return 'salon';
}

// ─── Haversine distance (km) ──────────────────────────────────────────────────
function calcDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
}

// ─── Custom Marker pin ────────────────────────────────────────────────────────
const MarkerPin = ({ isSelected, isUser }) => {
    if (isUser) {
        return (
            <View style={markerStyles.userPin}>
                <View style={markerStyles.userPulse} />
                <View style={markerStyles.userDot} />
            </View>
        );
    }
    return (
        <View style={[markerStyles.pin, isSelected && markerStyles.pinSelected]}>
            <Text style={{ fontSize: isSelected ? 22 : 18 }}>💈</Text>
        </View>
    );
};

const markerStyles = StyleSheet.create({
    pin: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 6,
        borderWidth: 2,
        borderColor: '#9C27B0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    pinSelected: {
        borderColor: '#7B1FA2',
        backgroundColor: '#F3E5F5',
        padding: 8,
    },
    userPin: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    userPulse: {
        position: 'absolute',
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(33, 150, 243, 0.2)',
    },
    userDot: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#2196F3',
        borderWidth: 3,
        borderColor: '#FFF',
        shadowColor: '#2196F3',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 6,
        elevation: 4,
    },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function NearbyMapScreen({ navigation, route }) {
    const { theme } = useTheme();
    const mapRef = useRef(null);
    const cardScrollRef = useRef(null);
    const slideAnim = useRef(new Animated.Value(200)).current;

    const initialFilter = route.params?.filter || 'all';

    const [userLocation, setUserLocation] = useState(null);
    const [barbers, setBarbers] = useState([]);
    const [filteredBarbers, setFilteredBarbers] = useState([]);
    const [selectedBarber, setSelectedBarber] = useState(null);
    const [filter, setFilter] = useState(initialFilter);
    const [loading, setLoading] = useState(true);
    const [locationError, setLocationError] = useState(false);
    const [cardVisible, setCardVisible] = useState(false);

    // ── Get user location ────────────────────────────────────────────────────
    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setLocationError(true);
                setLoading(false);
                Alert.alert(
                    'Location Required',
                    'Please enable location access to find nearby barbers.',
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
                return;
            }

            try {
                const loc = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
                const coords = {
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                };
                setUserLocation(coords);
                fetchNearbyBarbers(coords.latitude, coords.longitude, filter);
            } catch (err) {
                console.error('Location error:', err);
                setLocationError(true);
                setLoading(false);
            }
        })();
    }, []);

    // ── Fetch barbers ─────────────────────────────────────────────────────────
    const fetchNearbyBarbers = async (lat, lng, type = 'all') => {
        setLoading(true);
        try {
            const data = await getNearbyBarbers({ lat, lng, type: type === 'all' ? undefined : type });
            const processed = (data || [])
                .filter(b => b.location?.coordinates?.length === 2)
                .map(b => {
                    const [bLng, bLat] = b.location.coordinates;
                    const dist = calcDistance(lat, lng, bLat, bLng);
                    return { ...b, _lat: bLat, _lng: bLng, _distance: dist };
                })
                .sort((a, b) => parseFloat(a._distance) - parseFloat(b._distance));
            setBarbers(processed);
            setFilteredBarbers(processed);
        } catch (err) {
            console.error('Fetch barbers error:', err);
        } finally {
            setLoading(false);
        }
    };

    // ── Refetch on filter change ──────────────────────────────────────────────
    useEffect(() => {
        if (userLocation) {
            setSelectedBarber(null);
            hideCard();
            fetchNearbyBarbers(userLocation.latitude, userLocation.longitude, filter);
        }
    }, [filter]);

    // ── Card animation ────────────────────────────────────────────────────────
    const showCard = useCallback(() => {
        setCardVisible(true);
        Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
        }).start();
    }, [slideAnim]);

    const hideCard = useCallback(() => {
        Animated.timing(slideAnim, {
            toValue: 200,
            duration: 250,
            useNativeDriver: true,
        }).start(() => {
            setCardVisible(false);
            setSelectedBarber(null);
        });
    }, [slideAnim]);

    // ── Select a barber marker ────────────────────────────────────────────────
    const handleMarkerPress = useCallback((barber) => {
        setSelectedBarber(barber);
        showCard();
        mapRef.current?.animateToRegion({
            latitude: barber._lat - 0.002,
            longitude: barber._lng,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
        }, 400);
    }, [showCard]);

    // ── Open Google Maps directions ───────────────────────────────────────────
    const openDirections = (barber) => {
        const scheme = Platform.select({
            ios: 'maps:0,0?q=',
            android: 'geo:0,0?q=',
        });
        const latLng = `${barber._lat},${barber._lng}`;
        const label = encodeURIComponent(barber.user?.username || 'Barber');
        const url = Platform.select({
            ios: `${scheme}${label}@${latLng}`,
            android: `${scheme}${latLng}(${label})`,
        });

        const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${latLng}`;

        Linking.canOpenURL(googleUrl).then(supported => {
            if (supported) Linking.openURL(googleUrl);
            else Linking.openURL(url);
        });
    };

    // ── Navigate to booking ───────────────────────────────────────────────────
    const handleBookNow = (barber) => {
        navigation.navigate('BarberDetails', {
            barber: barber,
            barberId: barber.user?._id || barber._id,
            serviceType: getServiceType(barber) === 'both' ? 'salon' : getServiceType(barber),
        });
    };

    // ── Center map on user ────────────────────────────────────────────────────
    const recenterMap = () => {
        if (userLocation) {
            mapRef.current?.animateToRegion({
                ...userLocation,
                latitudeDelta: 0.03,
                longitudeDelta: 0.03,
            }, 400);
        }
    };

    const FILTERS = [
        { key: 'all', label: '🗺️ All' },
        { key: 'salon', label: '💈 Salon' },
        { key: 'home', label: '🏠 Home' },
    ];

    // ── Initial region ────────────────────────────────────────────────────────
    const initialRegion = userLocation
        ? { ...userLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 }
        : { latitude: 27.7172, longitude: 85.3240, latitudeDelta: 0.05, longitudeDelta: 0.05 }; // Kathmandu default

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* ── Header ─────────────────────────────────────────────────── */}
            <View style={[styles.header, { backgroundColor: theme.card }]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={[styles.backIcon, { color: theme.text }]}>←</Text>
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Nearby Barbers</Text>
                    <Text style={[styles.headerSub, { color: theme.textMuted }]}>
                        {loading ? 'Searching…' : `${filteredBarbers.length} found nearby`}
                    </Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {/* ── Filter Chips ────────────────────────────────────────────── */}
            <View style={[styles.filterRow, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                {FILTERS.map(f => (
                    <TouchableOpacity
                        key={f.key}
                        style={[
                            styles.filterChip,
                            { borderColor: theme.border },
                            filter === f.key && { backgroundColor: theme.primary, borderColor: theme.primary },
                        ]}
                        onPress={() => setFilter(f.key)}
                    >
                        <Text style={[
                            styles.filterText,
                            { color: theme.textMuted },
                            filter === f.key && { color: '#FFF' },
                        ]}>
                            {f.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* ── Map ─────────────────────────────────────────────────────── */}
            <View style={styles.mapContainer}>
                {loading && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color={theme.primary} />
                        <Text style={[styles.loadingText, { color: theme.primary }]}>Finding barbers…</Text>
                    </View>
                )}

                <MapView
                    ref={mapRef}
                    style={StyleSheet.absoluteFillObject}
                    provider={PROVIDER_GOOGLE}
                    initialRegion={initialRegion}
                    showsUserLocation={false}
                    showsMyLocationButton={false}
                    showsCompass={true}
                    onPress={() => {
                        if (cardVisible) hideCard();
                    }}
                >
                    {/* User location marker */}
                    {userLocation && (
                        <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
                            <MarkerPin isUser />
                        </Marker>
                    )}

                    {/* Barber markers */}
                    {filteredBarbers.map((barber) => (
                        <Marker
                            key={barber._id}
                            coordinate={{ latitude: barber._lat, longitude: barber._lng }}
                            onPress={() => handleMarkerPress(barber)}
                            anchor={{ x: 0.5, y: 1 }}
                        >
                            <MarkerPin isSelected={selectedBarber?._id === barber._id} />
                        </Marker>
                    ))}
                </MapView>

                {/* ── Re-center button ─────────────────────────────────── */}
                <TouchableOpacity
                    style={[styles.recenterBtn, { backgroundColor: theme.card }]}
                    onPress={recenterMap}
                >
                    <Text style={{ fontSize: 20 }}>📍</Text>
                </TouchableOpacity>

                {/* ── Count badge ──────────────────────────────────────── */}
                <View style={[styles.countBadge, { backgroundColor: theme.primary }]}>
                    <Text style={styles.countText}>{filteredBarbers.length} barbers</Text>
                </View>
            </View>

            {/* ── Bottom Barber Card (animated) ───────────────────────────── */}
            {cardVisible && selectedBarber && (
                <Animated.View
                    style={[
                        styles.cardContainer,
                        { backgroundColor: theme.card, transform: [{ translateY: slideAnim }] },
                    ]}
                >
                    {/* Drag handle */}
                    <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />

                    <View style={styles.cardRow}>
                        {/* Avatar */}
                        <Image
                            source={
                                selectedBarber._resolvedImage || selectedBarber.profileImage || selectedBarber.user?.profile_image
                                    ? { uri: selectedBarber._resolvedImage || selectedBarber.profileImage || selectedBarber.user?.profile_image }
                                    : require('../../../assets/logo.png')
                            }
                            style={styles.cardAvatar}
                        />

                        {/* Info */}
                        <View style={styles.cardInfo}>
                            <View style={styles.cardNameRow}>
                                <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>
                                    {selectedBarber.user?.username || 'Barber'}
                                </Text>
                                {selectedBarber.is_verified_barber && (
                                    <Text style={{ fontSize: 14, marginLeft: 4 }}>✅</Text>
                                )}
                            </View>

                            {/* Rating */}
                            <View style={styles.ratingRow}>
                                <Stars rating={selectedBarber.rating?.average || 0} />
                                <Text style={[styles.ratingNum, { color: theme.textMuted }]}>
                                    {' '}{selectedBarber.rating?.average > 0
                                        ? selectedBarber.rating.average.toFixed(1)
                                        : 'New'}
                                    {selectedBarber.rating?.count > 0 ? ` (${selectedBarber.rating.count})` : ''}
                                </Text>
                            </View>

                            {/* Service type + Distance */}
                            <View style={styles.metaRow}>
                                <ServiceBadge type={getServiceType(selectedBarber)} />
                                <View style={[styles.distanceBadge, { backgroundColor: theme.inputBg }]}>
                                    <Text style={[styles.distanceText, { color: theme.textMuted }]}>
                                        📏 {selectedBarber._distance} km
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Close */}
                        <TouchableOpacity onPress={hideCard} style={styles.closeBtn}>
                            <Text style={{ fontSize: 18, color: theme.textMuted }}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={[styles.dirBtn, { borderColor: theme.border }]}
                            onPress={() => openDirections(selectedBarber)}
                        >
                            <Text style={[styles.dirBtnText, { color: theme.text }]}>🗺️ Directions</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.bookBtn, { backgroundColor: theme.primary }]}
                            onPress={() => handleBookNow(selectedBarber)}
                        >
                            <Text style={styles.bookBtnText}>Book Now →</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            )}

            {/* ── Empty State ─────────────────────────────────────────────── */}
            {!loading && filteredBarbers.length === 0 && (
                <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
                    <Text style={{ fontSize: 40 }}>🔍</Text>
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>No barbers found</Text>
                    <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                        Try switching the filter or checking closer to the city center.
                    </Text>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 3,
        zIndex: 10,
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backIcon: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
    },
    headerSub: {
        fontSize: 12,
        marginTop: 1,
    },
    filterRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 10,
        borderBottomWidth: 1,
        zIndex: 9,
    },
    filterChip: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterText: {
        fontSize: 13,
        fontWeight: '600',
    },
    mapContainer: {
        flex: 1,
        position: 'relative',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 15,
        fontWeight: '600',
    },
    recenterBtn: {
        position: 'absolute',
        bottom: 120,
        right: 16,
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 6,
    },
    countBadge: {
        position: 'absolute',
        top: 12,
        alignSelf: 'center',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    countText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '700',
    },
    // ── Bottom Card ──────────────────────────────────────────────────────────
    cardContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 8,
        paddingBottom: 24,
        paddingHorizontal: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 16,
    },
    dragHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 16,
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    cardAvatar: {
        width: 68,
        height: 68,
        borderRadius: 14,
        marginRight: 14,
        backgroundColor: '#F0E6FF',
    },
    cardInfo: {
        flex: 1,
    },
    cardNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    cardName: {
        fontSize: 17,
        fontWeight: '700',
        flex: 1,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    ratingNum: {
        fontSize: 12,
    },
    metaRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    distanceBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    distanceText: {
        fontSize: 11,
        fontWeight: '600',
    },
    closeBtn: {
        padding: 4,
        marginLeft: 8,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
    },
    dirBtn: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 14,
        paddingVertical: 13,
        alignItems: 'center',
    },
    dirBtnText: {
        fontSize: 14,
        fontWeight: '600',
    },
    bookBtn: {
        flex: 1,
        borderRadius: 14,
        paddingVertical: 13,
        alignItems: 'center',
    },
    bookBtnText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '700',
    },
    // ── Empty State ──────────────────────────────────────────────────────────
    emptyCard: {
        position: 'absolute',
        bottom: 24,
        left: 24,
        right: 24,
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 8,
    },
    emptyTitle: {
        fontSize: 17,
        fontWeight: '700',
        marginTop: 10,
    },
    emptySub: {
        fontSize: 13,
        textAlign: 'center',
        marginTop: 6,
        lineHeight: 18,
    },
});
