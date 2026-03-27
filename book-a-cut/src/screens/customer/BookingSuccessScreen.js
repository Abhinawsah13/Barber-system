// screens/customer/BookingSuccessScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, Image, TouchableOpacity,
    ScrollView, Linking, Platform, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { formatDate } from '../../utils/dateUtils';
import * as Location from 'expo-location';
import io from 'socket.io-client';
import { SOCKET_BASE_URL } from '../../config/server';
import { getUserData } from '../../services/TokenManager';

const TAX_RATE = 0.05;
const FALLBACK_BARBER_IMAGE = 'https://img.freepik.com/free-vector/barber-shop-logo-design_1308-46672.jpg?w=200';

export default function BookingSuccessScreen({ navigation, route }) {
    const { theme } = useTheme();

    const {
        barberName = 'Your Barber',
        location = '',
        date = new Date().toISOString(),
        time = '10:00 AM',
        serviceName = 'Service',
        price = 0,
        serviceType = 'salon',
        bookingId,
        barberId,
        barberImage,
        customerLat,
        customerLng,
        barberLat,
        barberLng,
        barberAddress = '',
    } = route.params || {};

    // ✅ FEATURE 1: Live location sharing state (home service)
    const [isSharingLocation, setIsSharingLocation] = useState(false);
    const [locationStatus, setLocationStatus] = useState('idle'); // idle | sharing | stopped
    const [currentLat, setCurrentLat] = useState(customerLat || null);
    const [currentLng, setCurrentLng] = useState(customerLng || null);
    const socketRef = useRef(null);
    const locationWatchRef = useRef(null);
    const [userData, setUserData] = useState(null);

    useEffect(() => {
        getUserData().then(setUserData);

        // Auto-connect socket for home service
        if (serviceType === 'home' && bookingId) {
            connectSocket();
        }

        return () => {
            stopLocationSharing();
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, []);

    const connectSocket = () => {
        socketRef.current = io(SOCKET_BASE_URL);
        socketRef.current.on('connect', () => {
            console.log('Socket connected for live location');
        });
    };

    // ✅ FEATURE 1: Start live location sharing
    const startLocationSharing = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Location permission is needed to share your location with the barber.');
                return;
            }

            setIsSharingLocation(true);
            setLocationStatus('sharing');

            // Watch position continuously
            locationWatchRef.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 5000,   // update every 5 seconds
                    distanceInterval: 10, // or every 10 meters
                },
                (loc) => {
                    const lat = loc.coords.latitude;
                    const lng = loc.coords.longitude;
                    setCurrentLat(lat);
                    setCurrentLng(lng);

                    // Emit live location to barber via socket
                    if (socketRef.current && bookingId) {
                        socketRef.current.emit('customer-location-update', {
                            bookingId,
                            barberId,
                            lat,
                            lng,
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            );

            Alert.alert(
                '📍 Location Sharing Started',
                'Your barber can now see your live location. It will update every 5 seconds.'
            );
        } catch (error) {
            console.error('Location sharing error:', error);
            Alert.alert('Error', 'Could not start location sharing.');
            setIsSharingLocation(false);
            setLocationStatus('idle');
        }
    };

    // ✅ FEATURE 1: Stop live location sharing
    const stopLocationSharing = () => {
        if (locationWatchRef.current) {
            locationWatchRef.current.remove();
            locationWatchRef.current = null;
        }

        if (socketRef.current && bookingId) {
            socketRef.current.emit('customer-location-stopped', { bookingId, barberId });
        }

        setIsSharingLocation(false);
        setLocationStatus('stopped');
    };

    // ✅ FEATURE 2: Open Google Maps for directions
    const openGoogleMaps = (lat, lng, label = '') => {
        const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        const fallbackUrl = Platform.select({
            ios: `maps:0,0?q=${encodeURIComponent(label)}@${lat},${lng}`,
            android: `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(label)})`,
        });

        Linking.canOpenURL(googleUrl)
            .then(supported => Linking.openURL(supported ? googleUrl : fallbackUrl))
            .catch(() => Linking.openURL(fallbackUrl));
    };

    const openGoogleMapsByAddress = (address) => {
        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
        Linking.openURL(url);
    };

    // ✅ FEATURE 2: Navigate to salon — customer clicks this
    const handleGetDirectionsToSalon = () => {
        if (barberLat && barberLng) {
            openGoogleMaps(barberLat, barberLng, barberName);
        } else if (barberAddress) {
            openGoogleMapsByAddress(barberAddress);
        } else {
            Alert.alert('No Location', 'Salon location is not available.');
        }
    };

    const formattedDate = formatDate(date);
    const subtotal = parseFloat(price);
    const tax = subtotal * TAX_RATE;
    const totalAmount = subtotal + tax;
    const displayLocation = serviceType === 'home' ? 'Home Service' : (location || barberAddress || 'Salon');

    const canGetDirectionsToSalon = serviceType === 'salon' && (barberLat || barberAddress);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.closeBtn}>
                    <Text style={{ fontSize: 20, color: theme.text }}>✕</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Confirmation</Text>
                <View style={{ width: 30 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Success icon */}
                <View style={[styles.successIconContainer, { shadowColor: theme.primary }]}>
                    <View style={[styles.successCircle, { backgroundColor: theme.primary, borderColor: theme.primary + '40' }]}>
                        <Text style={styles.checkMark}>✓</Text>
                    </View>
                </View>

                <Text style={[styles.title, { color: theme.text }]}>Booking Confirmed!</Text>
                <Text style={[styles.subtitle, { color: theme.textLight }]}>
                    Your appointment has been booked successfully.
                </Text>

                {/* ✅ FEATURE 1: Live Location Card — HOME SERVICE ONLY */}
                {serviceType === 'home' && (
                    <View style={[styles.liveLocationCard, {
                        backgroundColor: locationStatus === 'sharing' ? '#E8F5E9' : theme.card,
                        borderColor: locationStatus === 'sharing' ? '#4CAF50' : theme.border
                    }]}>
                        <View style={styles.liveLocationHeader}>
                            <Text style={styles.liveLocationIcon}>
                                {locationStatus === 'sharing' ? '🟢' : '📍'}
                            </Text>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.liveLocationTitle, { color: theme.text }]}>
                                    {locationStatus === 'sharing'
                                        ? 'Sharing Live Location'
                                        : 'Share Location with Barber'}
                                </Text>
                                <Text style={[styles.liveLocationSub, { color: theme.textMuted }]}>
                                    {locationStatus === 'sharing'
                                        ? 'Barber can see your live location 🔴 Live'
                                        : 'Help your barber find you easily'}
                                </Text>
                            </View>
                            {locationStatus === 'sharing' && (
                                <View style={styles.liveBadge}>
                                    <Text style={styles.liveBadgeText}>LIVE</Text>
                                </View>
                            )}
                        </View>

                        {locationStatus === 'idle' && (
                            <TouchableOpacity
                                style={[styles.shareLocationBtn, { backgroundColor: '#4CAF50' }]}
                                onPress={startLocationSharing}
                            >
                                <Text style={styles.shareLocationBtnText}>
                                    📍 Start Sharing My Location
                                </Text>
                            </TouchableOpacity>
                        )}

                        {locationStatus === 'sharing' && (
                            <View>
                                <View style={styles.locationCoords}>
                                    <Text style={{ color: '#2E7D32', fontSize: 12 }}>
                                        📌 Lat: {currentLat?.toFixed(5)} • Lng: {currentLng?.toFixed(5)}
                                    </Text>
                                    <Text style={{ color: '#2E7D32', fontSize: 11, marginTop: 2 }}>
                                        Updates every 5 seconds
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={[styles.shareLocationBtn, { backgroundColor: '#F44336' }]}
                                    onPress={stopLocationSharing}
                                >
                                    <Text style={styles.shareLocationBtnText}>
                                        ⏹ Stop Sharing Location
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {locationStatus === 'stopped' && (
                            <View>
                                <Text style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>
                                    Location sharing stopped.
                                </Text>
                                <TouchableOpacity
                                    style={[styles.shareLocationBtn, { backgroundColor: '#4CAF50' }]}
                                    onPress={startLocationSharing}
                                >
                                    <Text style={styles.shareLocationBtnText}>
                                        📍 Resume Sharing
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}

                {/* ✅ FEATURE 2: Get Directions Card — SALON SERVICE ONLY */}
                {canGetDirectionsToSalon && (
                    <TouchableOpacity
                        style={[styles.directionsCard, { backgroundColor: '#E3F2FD', borderColor: '#2196F3' }]}
                        onPress={handleGetDirectionsToSalon}
                        activeOpacity={0.8}
                    >
                        <Text style={{ fontSize: 32 }}>🗺️</Text>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.directionsTitle}>Get Directions to Salon</Text>
                            <Text style={styles.directionsSub}>
                                {barberAddress || 'Tap to open in Google Maps'}
                            </Text>
                        </View>
                        <Text style={{ color: '#2196F3', fontWeight: 'bold', fontSize: 18 }}>→</Text>
                    </TouchableOpacity>
                )}

                {/* Receipt card */}
                <View style={[styles.receiptCard, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>

                    <View style={styles.barberRow}>
                        <Image
                            source={{ uri: barberImage || FALLBACK_BARBER_IMAGE }}
                            style={[styles.barberAvatar, { backgroundColor: theme.inputBg }]}
                        />
                        <View>
                            <Text style={[styles.barberName, { color: theme.text }]}>{barberName}</Text>
                            <Text style={[styles.barberLocation, { color: theme.textMuted }]}>
                                📍 {displayLocation}
                            </Text>
                            {serviceType === 'salon' && (barberLat || barberAddress) && (
                                <TouchableOpacity onPress={handleGetDirectionsToSalon}>
                                    <Text style={styles.inlineDirections}>Get Directions →</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    <View style={[styles.divider, { backgroundColor: theme.border }]} />

                    <View style={styles.detailRow}>
                        <View style={[styles.iconCircle, { backgroundColor: theme.primary + '10' }]}>
                            <Text>📅</Text>
                        </View>
                        <View style={styles.detailTextBox}>
                            <Text style={[styles.detailLabel, { color: theme.textMuted }]}>DATE</Text>
                            <Text style={[styles.detailValue, { color: theme.text }]}>{formattedDate}</Text>
                        </View>
                    </View>

                    <View style={styles.detailRow}>
                        <View style={[styles.iconCircle, { backgroundColor: '#2196F310' }]}>
                            <Text>🕒</Text>
                        </View>
                        <View style={styles.detailTextBox}>
                            <Text style={[styles.detailLabel, { color: theme.textMuted }]}>TIME</Text>
                            <Text style={[styles.detailValue, { color: theme.text }]}>{time}</Text>
                        </View>
                    </View>

                    <View style={styles.detailRow}>
                        <View style={[styles.iconCircle, { backgroundColor: '#FF572210' }]}>
                            <Text>✂️</Text>
                        </View>
                        <View style={styles.detailTextBox}>
                            <Text style={[styles.detailLabel, { color: theme.textMuted }]}>SERVICE</Text>
                            <Text style={[styles.detailValue, { color: theme.text }]}>{serviceName}</Text>
                        </View>
                    </View>

                    <View style={styles.detailRow}>
                        <View style={[styles.iconCircle, { backgroundColor: '#4CAF5010' }]}>
                            <Text>{serviceType === 'home' ? '🏠' : '💈'}</Text>
                        </View>
                        <View style={styles.detailTextBox}>
                            <Text style={[styles.detailLabel, { color: theme.textMuted }]}>TYPE</Text>
                            <Text style={[styles.detailValue, { color: theme.text }]}>
                                {serviceType === 'home' ? 'Home Service' : 'Salon Service'}
                            </Text>
                        </View>
                    </View>

                    {/* Dashed divider */}
                    <View style={styles.dashedLineContainer}>
                        <Text style={[styles.dashedLine, { color: theme.border }]}>
                            - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
                        </Text>
                    </View>

                    <View style={styles.priceRow}>
                        <Text style={[styles.priceLabel, { color: theme.textLight }]}>{serviceName}</Text>
                        <Text style={[styles.priceValue, { color: theme.text }]}>Rs {subtotal.toFixed(2)}</Text>
                    </View>
                    <View style={styles.priceRow}>
                        <Text style={[styles.priceLabel, { color: theme.textLight }]}>Tax (5%)</Text>
                        <Text style={[styles.priceValue, { color: theme.text }]}>Rs {tax.toFixed(2)}</Text>
                    </View>
                    <View style={[styles.priceRow, { marginTop: 15 }]}>
                        <Text style={[styles.totalLabel, { color: theme.text }]}>Total</Text>
                        <Text style={[styles.totalValue, { color: theme.primary }]}>Rs {totalAmount.toFixed(2)}</Text>
                    </View>
                </View>

                <View style={{ height: 120 }} />
            </ScrollView>

            {/* Bottom buttons */}
            <View style={[styles.footer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>

                {/* ✅ FEATURE 2: Get Directions button for salon */}
                {canGetDirectionsToSalon && (
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: '#2196F3', marginBottom: 10 }]}
                        onPress={handleGetDirectionsToSalon}
                    >
                        <Text style={styles.btnText}>🗺️  Get Directions to Salon</Text>
                    </TouchableOpacity>
                )}

                {/* ✅ FEATURE 1: Live location toggle for home service */}
                {serviceType === 'home' && (
                    <TouchableOpacity
                        style={[styles.actionBtn, {
                            backgroundColor: isSharingLocation ? '#F44336' : '#4CAF50',
                            marginBottom: 10
                        }]}
                        onPress={isSharingLocation ? stopLocationSharing : startLocationSharing}
                    >
                        <Text style={styles.btnText}>
                            {isSharingLocation
                                ? '⏹  Stop Sharing Location'
                                : '📍  Share Live Location with Barber'}
                        </Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: theme.primary }]}
                    onPress={() => navigation.navigate('MyBookings', { bookingId })}
                >
                    <Text style={styles.btnText}>View My Bookings</Text>
                </TouchableOpacity>
            </View>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 },
    headerTitle: { fontSize: 18, fontWeight: '600' },
    closeBtn: { padding: 5 },
    scrollContent: { paddingBottom: 20, alignItems: 'center' },

    successIconContainer: { marginTop: 20, marginBottom: 20, elevation: 10 },
    successCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', borderWidth: 4 },
    checkMark: { color: '#FFF', fontSize: 40, fontWeight: 'bold' },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
    subtitle: { fontSize: 14, marginBottom: 20, textAlign: 'center', paddingHorizontal: 20 },

    // ✅ Live location card
    liveLocationCard: {
        width: '90%', borderRadius: 16, padding: 16,
        marginBottom: 16, borderWidth: 1.5,
    },
    liveLocationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    liveLocationIcon: { fontSize: 24, marginRight: 10 },
    liveLocationTitle: { fontSize: 15, fontWeight: 'bold' },
    liveLocationSub: { fontSize: 12, marginTop: 2 },
    liveBadge: { backgroundColor: '#F44336', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    liveBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    locationCoords: { backgroundColor: '#C8E6C9', borderRadius: 8, padding: 8, marginBottom: 10 },
    shareLocationBtn: { borderRadius: 10, padding: 12, alignItems: 'center' },
    shareLocationBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

    // ✅ Directions card
    directionsCard: {
        width: '90%', borderRadius: 16, padding: 16,
        marginBottom: 16, borderWidth: 1.5,
        flexDirection: 'row', alignItems: 'center',
    },
    directionsTitle: { fontSize: 15, fontWeight: 'bold', color: '#1565C0' },
    directionsSub: { fontSize: 12, color: '#1976D2', marginTop: 2 },
    inlineDirections: { color: '#2196F3', fontSize: 12, fontWeight: 'bold', marginTop: 4 },

    receiptCard: { width: '90%', borderRadius: 20, padding: 20, elevation: 3, marginBottom: 16 },
    barberRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    barberAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
    barberName: { fontSize: 18, fontWeight: 'bold' },
    barberLocation: { fontSize: 12, marginTop: 2 },
    divider: { height: 1, marginBottom: 20 },
    detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    detailTextBox: { flex: 1 },
    detailLabel: { fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
    detailValue: { fontSize: 14, fontWeight: 'bold' },
    dashedLineContainer: { height: 20, overflow: 'hidden', marginVertical: 10, justifyContent: 'center', alignItems: 'center' },
    dashedLine: { letterSpacing: 4 },
    priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    priceLabel: { fontSize: 14 },
    priceValue: { fontSize: 14, fontWeight: '600' },
    totalLabel: { fontSize: 16, fontWeight: 'bold' },
    totalValue: { fontSize: 20, fontWeight: 'bold' },

    footer: { padding: 20, borderTopWidth: 1 },
    actionBtn: { paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginBottom: 0 },
    btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});
