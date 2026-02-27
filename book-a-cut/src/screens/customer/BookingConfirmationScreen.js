// screens/customer/BookingConfirmationScreen.js
// Final confirmation screen before the booking is actually created
// Shows a summary of what the customer picked: barber, service, date, time, price
// When they press "Confirm Booking", it sends the request to the backend

import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Alert,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { createBookingV2 } from '../../services/api';
import { formatDate } from '../../utils/dateUtils';

// Small helper component: one row in the booking details card
// Keeps the JSX in the main screen cleaner
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

export default function BookingConfirmationScreen({ navigation, route }) {
    const { theme } = useTheme();

    // Unpack everything passed from the previous screen (BookingScreen or DateTimePicker)
    const {
        service,
        barber,
        barberId,
        barberName,
        date,           // "YYYY-MM-DD" format
        timeSlot,       // "HH:MM" 24-hour
        timeSlotISO,    // full ISO string (not used for display, just for the payload)
        serviceType = 'salon',       // 'salon', 'home', or 'both' — passed from booking screen
        customerAddress = '',        // address needed for home service
        notes = '',                  // extra instructions for home visit
    } = route.params || {};

    const [loading, setLoading] = useState(false);

    // Make the date readable: "24 Feb 2026"
    const displayDate = formatDate(date);

    // Use barber's actual profile image if available, otherwise use a placeholder
    const barberProfileImage = barber?.user?.profile_image
        || `https://i.pravatar.cc/150?u=${barberId}`;

    // Called when the user presses "Confirm Booking"
    const handleConfirm = async () => {
        setLoading(true);

        try {
            // Build the booking request body to send to the backend
            // serviceType and customerAddress are passed from the previous screen
            const bookingPayload = {
                barberId,
                serviceId: service?._id,
                date,
                time_slot: timeSlot,
                serviceType: serviceType,           // 'salon', 'home', or 'both'
                customerAddress: customerAddress,   // used when serviceType is 'home'
                notes: notes,                       // extra notes for home service
            };

            const result = await createBookingV2(bookingPayload);

            if (result.success) {
                // Booking created successfully — go to the success screen
                navigation.replace('BookingSuccess', {
                    bookingId: result.data?._id,
                    barberId,
                    barberName,
                    barberImage: barber?.user?.profile_image || '',
                    serviceName: service?.name,
                    date: displayDate,
                    time: timeSlot,
                    price: service?.price,
                });
            } else {
                Alert.alert('Booking Failed', result.message || 'Something went wrong. Please try again.');
            }

        } catch (error) {
            // Show the backend error message so the user knows what went wrong
            const message = error.message || 'Booking failed. Please try again.';
            Alert.alert(
                'Booking Failed',
                message,
                [
                    { text: 'Try Another Time', onPress: () => navigation.goBack() },
                    { text: 'OK' },
                ]
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>

            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.background }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={{ fontSize: 24, color: theme.text }}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Confirm Booking</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* Barber info card */}
                <View style={[styles.barberCard, { backgroundColor: theme.card }]}>
                    <Image source={{ uri: barberProfileImage }} style={styles.barberAvatar} />
                    <View style={styles.barberInfo}>
                        <Text style={[styles.barberName, { color: theme.text }]}>
                            {barberName || 'Your Barber'}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {barber?.rating?.count > 0 ? (
                                <>
                                    <Text style={{ color: '#FFD700' }}>⭐ </Text>
                                    <Text style={[styles.barberRating, { color: theme.textMuted, marginBottom: 0 }]}>
                                        {barber.rating.average.toFixed(1)}
                                    </Text>
                                </>
                            ) : (
                                <Text style={[styles.barberRating, { color: theme.primary, fontWeight: 'bold', marginBottom: 0 }]}>
                                    New Barber
                                </Text>
                            )}
                            <Text style={[styles.barberRating, { color: theme.textMuted, marginBottom: 0 }]}>
                                {'  ·  '}
                                {barber?.experience_years || 0} yrs exp
                            </Text>
                        </View>
                        {/* Show services if there are any */}
                        {barber?.services && barber.services.length > 0 ? (
                            <Text style={[styles.barberSpec, { color: theme.primary }]}>
                                {barber.services.slice(0, 3).join(' · ')}
                            </Text>
                        ) : null}
                    </View>
                </View>

                {/* Booking details card */}
                <View style={[styles.detailCard, { backgroundColor: theme.card }]}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>Booking Details</Text>

                    <InfoRow icon="✂️" label="Service" value={service?.name || '—'} theme={theme} />
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />

                    <InfoRow icon="📅" label="Date" value={displayDate} theme={theme} />
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />

                    <InfoRow icon="⏰" label="Time" value={timeSlot} theme={theme} />
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />

                    <InfoRow
                        icon="⏱"
                        label="Duration"
                        value={`${service?.duration_minutes || 30} minutes`}
                        theme={theme}
                    />

                    {serviceType === 'home' && (
                        <>
                            <View style={[styles.divider, { backgroundColor: theme.border }]} />
                            <InfoRow icon="🏠" label="Location" value="Home Visit" theme={theme} />
                            <View style={[styles.divider, { backgroundColor: theme.border }]} />
                            <InfoRow icon="📍" label="Address" value={customerAddress || 'Not provided'} theme={theme} />
                            {notes ? (
                                <>
                                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                                    <InfoRow icon="📝" label="Notes" value={notes} theme={theme} />
                                </>
                            ) : null}
                        </>
                    )}
                </View>

                {/* Price breakdown card */}
                <View style={[styles.priceCard, { backgroundColor: theme.card }]}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>Price Summary</Text>

                    <View style={styles.priceRow}>
                        <Text style={[styles.priceLabel, { color: theme.textLight }]}>{service?.name}</Text>
                        <Text style={[styles.priceValue, { color: theme.text }]}>Rs {service?.price}</Text>
                    </View>

                    <View style={styles.priceRow}>
                        <Text style={[styles.priceLabel, { color: theme.textLight }]}>Service Fee</Text>
                        <Text style={[styles.priceValue, { color: theme.text }]}>Rs 0</Text>
                    </View>

                    <View style={[styles.divider, { backgroundColor: theme.border }]} />

                    <View style={styles.priceRow}>
                        <Text style={[styles.totalLabel, { color: theme.text }]}>Total</Text>
                        <Text style={[styles.totalValue, { color: theme.primary }]}>Rs {service?.price}</Text>
                    </View>
                </View>

                {/* Note: no upfront payment needed */}
                <View style={[styles.noteBox, { backgroundColor: theme.primary + '12', borderColor: theme.primary + '30' }]}>
                    <Text style={styles.noteIcon}>{serviceType === 'home' ? '🏠' : '💳'}</Text>
                    <Text style={[styles.noteText, { color: theme.textLight }]}>
                        {serviceType === 'home'
                            ? "Cash/Digital payment after service at your doorstep."
                            : "Payment is collected at the salon. No card required to confirm."}
                    </Text>
                </View>

                {/* Bottom padding so content isn't hidden behind the sticky button */}
                <View style={{ height: 120 }} />

            </ScrollView>

            {/* Sticky confirm button at the bottom */}
            <View style={[styles.bottomBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
                <TouchableOpacity
                    style={[
                        styles.confirmBtn,
                        { backgroundColor: loading ? theme.border : theme.primary },
                    ]}
                    onPress={handleConfirm}
                    disabled={loading}
                    activeOpacity={0.85}
                >
                    {loading ? (
                        <View style={styles.loadingRow}>
                            <ActivityIndicator color="#FFF" size="small" />
                            <Text style={styles.confirmBtnText}>  Booking...</Text>
                        </View>
                    ) : (
                        <Text style={styles.confirmBtnText}>✓  Confirm Booking</Text>
                    )}
                </TouchableOpacity>
            </View>

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
        paddingVertical: 14,
    },
    backBtn: {
        padding: 6,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 6,
    },

    // Barber card
    barberCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 6,
        elevation: 3,
    },
    barberAvatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        marginRight: 14,
    },
    barberInfo: {
        flex: 1,
    },
    barberName: {
        fontSize: 17,
        fontWeight: '700',
        marginBottom: 4,
    },
    barberRating: {
        fontSize: 13,
        marginBottom: 4,
    },
    barberSpec: {
        fontSize: 12,
        fontWeight: '600',
    },

    // Booking details card
    detailCard: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 14,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
    },
    iconWrap: {
        width: 38,
        height: 38,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    infoIcon: {
        fontSize: 18,
    },
    infoText: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 12,
        marginBottom: 2,
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        marginVertical: 2,
    },

    // Price card
    priceCard: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    priceLabel: {
        fontSize: 14,
    },
    priceValue: {
        fontSize: 14,
        fontWeight: '600',
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '700',
    },
    totalValue: {
        fontSize: 20,
        fontWeight: '800',
    },

    // Payment note box
    noteBox: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        marginBottom: 16,
        gap: 10,
    },
    noteIcon: {
        fontSize: 20,
    },
    noteText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
    },

    // Bottom confirm button bar
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        borderTopWidth: 1,
    },
    confirmBtn: {
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    loadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    confirmBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
});
