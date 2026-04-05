// screens/customer/BookingConfirmationScreen.js
import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ScrollView, ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { createBookingV2, initiateKhaltiPayment } from '../../services/api';
import { formatDate } from '../../utils/dateUtils';
import * as Location from 'expo-location';

function InfoRow({ icon, label, value, theme }) {
    return (
        <View style={styles.infoRow}>
            <View style={[styles.iconWrap, { backgroundColor: theme.primary + '18' }]}>
                <Text style={styles.infoIcon}>{icon}</Text>
            </View>
            <View style={styles.infoText}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>{label}</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{value}</Text>
            </View>
        </View>
    );
}

// ✅ FIX 1: Calculate distance between two GPS points (Haversine formula)
const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
};

// ✅ FIX 2: Calculate travel charge — Rs 100 per 5km
const calculateTravelCharge = (distanceKm) => {
    return Math.ceil(distanceKm / 5) * 100;
};

export default function BookingConfirmationScreen({ navigation, route }) {
    const { theme } = useTheme();

    const {
        service,
        barber,
        barberId,
        barberName,
        date,
        timeSlot,
        timeSlotISO,
        serviceType = 'salon',
        customerAddress = '',
        notes = '',
    } = route.params || {};

    const barberCoords = barber?.location?.coordinates;
    const barberLat = barberCoords?.[1] ?? null;
    const barberLng = barberCoords?.[0] ?? null;

    const [loading, setLoading] = useState(false);
    const [customerLat, setCustomerLat] = useState(null);
    const [customerLng, setCustomerLng] = useState(null);
    const [travelCharge, setTravelCharge] = useState(0);
    const [distanceKm, setDistanceKm] = useState(null);
    const [paymentLoading, setPaymentLoading] = useState(false);
    // ✅ Tracks a server-side "slot already booked" error
    const [slotBookedError, setSlotBookedError] = useState(false);

    const displayDate = formatDate(date);
    const servicePrice = service?.price || 0;
    const totalPrice = servicePrice + travelCharge;

    const barberProfileImage = barber?.user?.profile_image || null;
    const finalImageSource = barberProfileImage ? { uri: barberProfileImage } : require('../../../assets/barber.png');

    // ✅ FIX 1: Validate booking time is in the future
    const isTimeValid = () => {
        if (!date || !timeSlot) return false;

        const now = new Date();
        const [hours, minutes] = timeSlot.split(':').map(Number);
        const bookingDateTime = new Date(date);
        bookingDateTime.setHours(hours, minutes, 0, 0);

        // If today, check time is in the future
        const today = new Date().toISOString().split('T')[0];
        if (date === today && bookingDateTime <= now) {
            return false;
        }
        return true;
    };

    // ✅ FIX 2: Get customer location & calculate travel charge for home service
    useEffect(() => {
        if (serviceType === 'home') {
            getCustomerLocationAndCalculateCharge();
        }
    }, [serviceType]);

    const getCustomerLocationAndCalculateCharge = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const loc = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
                const cLat = loc.coords.latitude;
                const cLng = loc.coords.longitude;
                setCustomerLat(cLat);
                setCustomerLng(cLng);

                // Calculate travel charge if barber coords are available
                if (barberLat && barberLng) {
                    const dist = calculateDistance(cLat, cLng, barberLat, barberLng);
                    const charge = calculateTravelCharge(dist);
                    setDistanceKm(dist.toFixed(1));
                    setTravelCharge(charge);
                }
            }
        } catch (err) {
            console.warn('Could not get customer location:', err.message);
        }
    };

    const handleKhaltiPay = async () => {
        if (!isTimeValid()) {
            Alert.alert('Invalid Time', 'This time slot has already passed.');
            return;
        }

        setSlotBookedError(false);
        setPaymentLoading(true);
        try {
            const result = await initiateKhaltiPayment({
                barberId,
                serviceId: service?._id,
                date,
                timeSlot,
                serviceType,
                customerAddress,
                notes,
                customerLat: serviceType === 'home' ? customerLat : null,
                customerLng: serviceType === 'home' ? customerLng : null,
                travelCharge: serviceType === 'home' ? travelCharge : 0,
                amount: totalPrice,
            });

            if (result.success) {
                // ✅ bookingIntent comes back from the updated backend initiate endpoint
                // Pass it along so verifyKhaltiPayment can create the booking after payment
                const bookingIntentToPass = result.bookingIntent || {
                    barberId, serviceId: service?._id, date, timeSlot,
                    serviceType, customerAddress, notes, amount: totalPrice,
                };

                navigation.navigate('PaymentWebView', {
                    paymentUrl: result.paymentUrl,
                    gateway: 'khalti',
                    pidx: result.pidx,
                    bookingIntent: bookingIntentToPass, // ✅ pass instead of bookingId
                    amount: totalPrice,
                    onSuccessRoute: 'BookingSuccess',
                    successParams: {
                        barberId, barberName, barberImage: barber?.user?.profile_image || '',
                        serviceName: service?.name, date: displayDate, time: timeSlot,
                        price: totalPrice, serviceType, customerLat, customerLng, barberLat, barberLng,
                        barberAddress: barber?.location?.address || barber?.location?.city || '',
                    },
                });
            } else {
                // ✅ Handle slot already booked (409) from initiate
                const msg = result.message || '';
                if (msg.toLowerCase().includes('already booked') || result.statusCode === 409) {
                    setSlotBookedError(true);
                } else {
                    Alert.alert('Error', msg || 'Could not initiate Khalti payment.');
                }
            }
        } catch (e) {
            const msg = e.message || '';
            if (msg.toLowerCase().includes('already booked')) {
                setSlotBookedError(true);
            } else {
                Alert.alert('Error', msg || 'Payment initiation failed.');
            }
        } finally {
            setPaymentLoading(false);
        }
    };



    const handleConfirm = async () => {
        // ✅ Block past time booking
        if (!isTimeValid()) {
            Alert.alert(
                'Invalid Time',
                'This time slot has already passed. Please go back and select a future time slot.',
                [{ text: 'Go Back', onPress: () => navigation.goBack() }]
            );
            return;
        }

        setSlotBookedError(false);
        setLoading(true);

        try {
            const bookingPayload = {
                barberId,
                serviceId: service?._id,
                date,
                time_slot: timeSlot,
                serviceType,
                customerAddress,
                notes,
                customerLat: serviceType === 'home' ? customerLat : null,
                customerLng: serviceType === 'home' ? customerLng : null,
                // ✅ Send travel charge to backend
                travelCharge: serviceType === 'home' ? travelCharge : 0,
                totalPrice,
            };

            const result = await createBookingV2(bookingPayload);

            if (result.success) {
                navigation.replace('BookingSuccess', {
                    bookingId: result.data?._id,
                    barberId,
                    barberName,
                    barberImage: barber?.user?.profile_image || '',
                    serviceName: service?.name,
                    date: displayDate,
                    time: timeSlot,
                    price: totalPrice,
                    serviceType,
                    customerLat,
                    customerLng,
                    barberLat,
                    barberLng,
                    barberAddress: barber?.location?.address || barber?.location?.city || '',
                });
            } else {
                // ✅ Backend returned success:false with a message
                const msg = result.message || '';
                if (msg.toLowerCase().includes('already booked')) {
                    setSlotBookedError(true);
                } else {
                    Alert.alert('Booking Failed', msg || 'Something went wrong.');
                }
            }
        } catch (error) {
            const msg = error.message || '';
            // ✅ 409 / duplicate booking — stay on screen, show inline error
            if (msg.toLowerCase().includes('already booked') || error.statusCode === 409) {
                setSlotBookedError(true);
            } else {
                Alert.alert(
                    'Booking Failed',
                    msg || 'Booking failed. Please try again.',
                    [
                        { text: 'Try Another Time', onPress: () => navigation.goBack() },
                        { text: 'OK' },
                    ]
                );
            }
        } finally {
            setLoading(false);
        }
    };

    // ✅ Show warning if time already passed
    const timeWarning = !isTimeValid();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { backgroundColor: theme.background }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={{ fontSize: 24, color: theme.text }}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Confirm Booking</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* ✅ Slot already booked error banner */}
                {slotBookedError && (
                    <View style={styles.slotBookedBanner}>
                        <Text style={styles.slotBookedBannerIcon}>🚫</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.slotBookedBannerTitle}>Time Slot Already Booked</Text>
                            <Text style={styles.slotBookedBannerMsg}>
                                This time slot ({timeSlot}) is already taken. Please go back and select a different time.
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.slotBookedBannerBtn}>
                            <Text style={styles.slotBookedBannerBtnText}>Change
Time</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ✅ Past time warning banner */}
                {timeWarning && (
                    <View style={styles.warningBox}>
                        <Text style={styles.warningText}>
                            ⚠️ This time slot ({timeSlot}) has already passed today. Please go back and select a future time.
                        </Text>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.warningBtn}>
                            <Text style={styles.warningBtnText}>Change Time</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Barber card */}
                <View style={[styles.barberCard, { backgroundColor: theme.card }]}>
                    <Image source={finalImageSource} style={styles.barberAvatar} />
                    <View style={styles.barberInfo}>
                        <Text style={[styles.barberName, { color: theme.text }]}>
                            {barberName || 'Your Barber'}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {barber?.rating?.count > 0 ? (
                                <>
                                    <Text style={{ color: '#FFD700' }}>⭐ </Text>
                                    <Text style={[styles.barberRating, { color: theme.textMuted }]}>
                                        {barber.rating.average.toFixed(1)}
                                    </Text>
                                </>
                            ) : (
                                <Text style={[styles.barberRating, { color: theme.primary, fontWeight: 'bold' }]}>
                                    New Barber
                                </Text>
                            )}
                            <Text style={[styles.barberRating, { color: theme.textMuted }]}>
                                {'  ·  '}{barber?.experience_years || 0} yrs exp
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Booking details */}
                <View style={[styles.detailCard, { backgroundColor: theme.card }]}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>Booking Details</Text>
                    <InfoRow icon="✂️" label="Service" value={service?.name || '—'} theme={theme} />
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    <InfoRow icon="📅" label="Date" value={displayDate} theme={theme} />
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    {/* ✅ FIX 1: Show red time if past */}
                    <View style={styles.infoRow}>
                        <View style={[styles.iconWrap, { backgroundColor: theme.primary + '18' }]}>
                            <Text style={styles.infoIcon}>⏰</Text>
                        </View>
                        <View style={styles.infoText}>
                            <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Time</Text>
                            <Text style={[styles.infoValue, {
                                color: timeWarning ? '#ef4444' : theme.text,
                                fontWeight: timeWarning ? 'bold' : '600'
                            }]}>
                                {timeSlot} {timeWarning ? '⚠️ Past time' : ''}
                            </Text>
                        </View>
                    </View>
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    <InfoRow icon="⏱" label="Duration" value={`${service?.duration_minutes || 30} minutes`} theme={theme} />
                    {serviceType === 'home' && (
                        <>
                            <View style={[styles.divider, { backgroundColor: theme.border }]} />
                            <InfoRow icon="🏠" label="Location" value="Home Visit" theme={theme} />
                            <View style={[styles.divider, { backgroundColor: theme.border }]} />
                            <InfoRow icon="📍" label="Address" value={customerAddress || 'Not provided'} theme={theme} />
                            {/* ✅ FIX 2: Show distance */}
                            {distanceKm && (
                                <>
                                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                                    <InfoRow icon="📏" label="Distance" value={`${distanceKm} km from barber`} theme={theme} />
                                </>
                            )}
                            {notes ? (
                                <>
                                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                                    <InfoRow icon="📝" label="Notes" value={notes} theme={theme} />
                                </>
                            ) : null}
                        </>
                    )}
                </View>

                {/* ✅ FIX 2: Price breakdown with travel charge */}
                <View style={[styles.priceCard, { backgroundColor: theme.card }]}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>Price Summary</Text>

                    <View style={styles.priceRow}>
                        <Text style={[styles.priceLabel, { color: theme.textLight }]}>{service?.name}</Text>
                        <Text style={[styles.priceValue, { color: theme.text }]}>Rs {servicePrice}</Text>
                    </View>

                    {serviceType === 'home' && (
                        <View style={styles.priceRow}>
                            <View>
                                <Text style={[styles.priceLabel, { color: theme.textLight }]}>
                                    Travel Charge {distanceKm ? `(${distanceKm} km)` : ''}
                                </Text>
                                <Text style={{ fontSize: 11, color: theme.textMuted }}>
                                    Rs 100 per 5 km
                                </Text>
                            </View>
                            <Text style={[styles.priceValue, { color: theme.text }]}>
                                Rs {travelCharge}
                            </Text>
                        </View>
                    )}

                    {serviceType === 'salon' && (
                        <View style={styles.priceRow}>
                            <Text style={[styles.priceLabel, { color: theme.textLight }]}>Service Fee</Text>
                            <Text style={[styles.priceValue, { color: '#22c55e' }]}>Free</Text>
                        </View>
                    )}

                    <View style={[styles.divider, { backgroundColor: theme.border }]} />

                    <View style={styles.priceRow}>
                        <Text style={[styles.totalLabel, { color: theme.text }]}>Total</Text>
                        <Text style={[styles.totalValue, { color: theme.primary }]}>Rs {totalPrice}</Text>
                    </View>
                </View>

                <View style={[styles.noteBox, { backgroundColor: theme.primary + '12', borderColor: theme.primary + '30' }]}>
                    <Text style={styles.noteIcon}>{serviceType === 'home' ? '🏠' : '💳'}</Text>
                    <Text style={[styles.noteText, { color: theme.textLight }]}>
                        {serviceType === 'home'
                            ? "Cash/Digital payment after service at your doorstep."
                            : "Payment is collected at the salon. No card required to confirm."}
                    </Text>
                </View>

                <View style={{ height: 120 }} />
            </ScrollView>

            <View style={[styles.bottomBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
                <Text style={{ textAlign: 'center', color: theme.textLight, marginBottom: 10, fontSize: 13, fontWeight: '600' }}>
                    Choose Payment Method
                </Text>
                
                <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity
                        style={[styles.payBtn, { backgroundColor: '#5C2D91', opacity: (paymentLoading || loading || timeWarning) ? 0.6 : 1 }]}
                        onPress={handleKhaltiPay}
                        disabled={paymentLoading || loading || timeWarning}
                    >
                        {paymentLoading ? <ActivityIndicator color="#FFF" size="small" /> :
                            <Text style={styles.payBtnText}>💜 Pay with Khalti</Text>}
                    </TouchableOpacity>
                </View>

                {/* Cash/After-service option */}
                <TouchableOpacity
                    style={[
                        styles.cashBtn, 
                        { borderColor: theme.border, opacity: (paymentLoading || loading || timeWarning) ? 0.6 : 1 }
                    ]}
                    onPress={handleConfirm}
                    disabled={paymentLoading || loading || timeWarning}
                >
                    {loading ? (
                        <View style={styles.loadingRow}>
                            <ActivityIndicator color={theme.text} size="small" />
                            <Text style={[styles.cashBtnText, { color: theme.text }]}>   Booking...</Text>
                        </View>
                    ) : (
                        <Text style={[styles.cashBtnText, { color: theme.text }]}>
                            {serviceType === 'home' ? '🏠 Pay After Service' : '💵 Pay Cash at Salon'}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
    backBtn: { padding: 6 },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    scrollContent: { paddingHorizontal: 20, paddingTop: 6 },

    // ✅ Warning box styles
    warningBox: { backgroundColor: '#FFF3CD', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#FFC107' },
    warningText: { color: '#856404', fontSize: 13, lineHeight: 20, marginBottom: 10 },
    warningBtn: { backgroundColor: '#FFC107', borderRadius: 8, padding: 10, alignItems: 'center' },
    warningBtnText: { color: '#333', fontWeight: 'bold' },

    // ✅ Slot already booked banner styles
    slotBookedBanner: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FFEBEE', borderRadius: 12,
        padding: 14, marginBottom: 16,
        borderWidth: 1, borderColor: '#FFCDD2', gap: 10,
    },
    slotBookedBannerIcon: { fontSize: 22 },
    slotBookedBannerTitle: { color: '#B71C1C', fontWeight: '700', fontSize: 14, marginBottom: 4 },
    slotBookedBannerMsg: { color: '#C62828', fontSize: 12, lineHeight: 17 },
    slotBookedBannerBtn: {
        backgroundColor: '#EF5350', borderRadius: 8,
        paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center',
    },
    slotBookedBannerBtnText: { color: '#FFF', fontWeight: '700', fontSize: 11, textAlign: 'center' },

    barberCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 3 },
    barberAvatar: { width: 64, height: 64, borderRadius: 32, marginRight: 14 },
    barberInfo: { flex: 1 },
    barberName: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
    barberRating: { fontSize: 13, marginBottom: 4 },
    detailCard: { borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2 },
    cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 14 },
    infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
    iconWrap: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    infoIcon: { fontSize: 18 },
    infoText: { flex: 1 },
    infoLabel: { fontSize: 12, marginBottom: 2 },
    infoValue: { fontSize: 14, fontWeight: '600' },
    divider: { height: 1, marginVertical: 2 },
    priceCard: { borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2 },
    priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
    priceLabel: { fontSize: 14 },
    priceValue: { fontSize: 14, fontWeight: '600' },
    totalLabel: { fontSize: 16, fontWeight: '700' },
    totalValue: { fontSize: 20, fontWeight: '800' },
    noteBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 16, gap: 10 },
    noteIcon: { fontSize: 20 },
    noteText: { flex: 1, fontSize: 13, lineHeight: 18 },
    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingTop: 16, borderTopWidth: 1 },
    payBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    payBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
    cashBtn: { marginTop: 12, paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, backgroundColor: 'transparent' },
    cashBtnText: { fontWeight: '700', fontSize: 15 },
    loadingRow: { flexDirection: 'row', alignItems: 'center' },
});
