// screens/customer/BookingSuccessScreen.js
// Shows a confirmation receipt after a booking is made
// Navigating here should pass barber info, date, time, service, price etc.

import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { formatDate } from '../../utils/dateUtils';

// Tax rate — 5% for now, can change later
const TAX_RATE = 0.05;

// Placeholder barber logo used when there's no actual barber image
const FALLBACK_BARBER_IMAGE = 'https://img.freepik.com/free-vector/barber-shop-logo-design_1308-46672.jpg?w=200';

export default function BookingSuccessScreen({ navigation, route }) {
    const { theme } = useTheme();

    // Get all the booking details passed from the booking screen
    // Using defaults so the screen doesn't crash if something is missing
    const {
        barberName = 'Mike the Barber',
        location = '123 Main St, Downtown',
        date = new Date().toISOString(),
        time = '10:00 AM',
        serviceName = 'Precision Haircut & Beard',
        price = 40.00,
        serviceType = 'salon',
        bookingId,
        barberId,
        barberImage,
    } = route.params || {};

    // Format the date — uses device locale and local timezone automatically
    const formattedDate = formatDate(date);

    // Calculate price breakdown
    const subtotal = parseFloat(price);
    const tax = subtotal * TAX_RATE;
    const totalAmount = subtotal + tax;

    // Figure out what location to show depending on service type
    const displayLocation = serviceType === 'home' ? 'Home Service' : location;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>

            {/* Top header with close button */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.closeBtn}>
                    <Text style={{ fontSize: 20, color: theme.text }}>✕</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Confirmation</Text>
                {/* Empty view to push title to center */}
                <View style={{ width: 30 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Big green checkmark icon */}
                <View style={[styles.successIconContainer, { shadowColor: theme.primary }]}>
                    <View style={[styles.successCircle, { backgroundColor: theme.primary, borderColor: theme.primaryLight }]}>
                        <Text style={styles.checkMark}>✓</Text>
                    </View>
                </View>

                <Text style={[styles.title, { color: theme.text }]}>Booking Confirmed!</Text>
                <Text style={[styles.subtitle, { color: theme.textLight }]}>
                    We've sent a receipt to your email address.
                </Text>

                {/* Receipt card with all booking details */}
                <View style={[styles.receiptCard, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>

                    {/* Barber name and location row */}
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
                        </View>
                    </View>

                    <View style={[styles.divider, { backgroundColor: theme.border }]} />

                    {/* Date detail row */}
                    <View style={styles.detailRow}>
                        <View style={[styles.iconCircle, { backgroundColor: theme.primary + '10' }]}>
                            <Text>📅</Text>
                        </View>
                        <View style={styles.detailTextBox}>
                            <Text style={[styles.detailLabel, { color: theme.textMuted }]}>DATE</Text>
                            <Text style={[styles.detailValue, { color: theme.text }]}>{formattedDate}</Text>
                        </View>
                        {/* TODO: Actually hook this up to device calendar later */}
                        <TouchableOpacity>
                            <Text style={[styles.calendarLink, { color: theme.primary }]}>Add to Calendar</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Time detail row */}
                    <View style={styles.detailRow}>
                        <View style={[styles.iconCircle, { backgroundColor: theme.info + '10' }]}>
                            <Text>🕒</Text>
                        </View>
                        <View style={styles.detailTextBox}>
                            <Text style={[styles.detailLabel, { color: theme.textMuted }]}>TIME</Text>
                            <Text style={[styles.detailValue, { color: theme.text }]}>{time}</Text>
                        </View>
                    </View>

                    {/* Service detail row */}
                    <View style={styles.detailRow}>
                        <View style={[styles.iconCircle, { backgroundColor: theme.error + '10' }]}>
                            <Text>✂️</Text>
                        </View>
                        <View style={styles.detailTextBox}>
                            <Text style={[styles.detailLabel, { color: theme.textMuted }]}>SERVICE</Text>
                            <Text style={[styles.detailValue, { color: theme.text }]}>{serviceName}</Text>
                        </View>
                    </View>

                    {/* Visual separator (dashed receipt line) */}
                    <View style={styles.dashedLineContainer}>
                        <Text style={[styles.dashedLine, { color: theme.border }]}>
                            - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
                        </Text>
                    </View>

                    {/* Pricing breakdown */}
                    <View style={styles.priceRow}>
                        <Text style={[styles.priceLabel, { color: theme.textLight }]}>Subtotal</Text>
                        <Text style={[styles.priceValue, { color: theme.text }]}>Rs {subtotal.toFixed(2)}</Text>
                    </View>

                    <View style={styles.priceRow}>
                        <Text style={[styles.priceLabel, { color: theme.textLight }]}>Tax (5%)</Text>
                        <Text style={[styles.priceValue, { color: theme.text }]}>Rs {tax.toFixed(2)}</Text>
                    </View>

                    <View style={[styles.priceRow, { marginTop: 15 }]}>
                        <Text style={[styles.totalLabel, { color: theme.text }]}>Total Paid</Text>
                        <Text style={[styles.totalValue, { color: theme.primary }]}>Rs {totalAmount.toFixed(2)}</Text>
                    </View>

                </View>

            </ScrollView>

            {/* Bottom buttons */}
            <View style={[styles.footer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>

                {/* Only show "Rate Your Barber" if we have the needed IDs */}
                {bookingId && barberId ? (
                    <TouchableOpacity
                        style={[styles.rateBarberBtn, { backgroundColor: '#f59e0b', marginBottom: 10 }]}
                        onPress={() => navigation.navigate('RateBarber', {
                            bookingId,
                            barberId,
                            barberName,
                            barberImage,
                            serviceName,
                            date,
                        })}
                    >
                        <Text style={styles.btnText}>⭐  Rate Your Barber</Text>
                    </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                    style={[styles.viewBookingsBtn, { backgroundColor: theme.primary }]}
                    onPress={() => navigation.navigate('UserProfile')}
                >
                    <Text style={styles.btnText}>View My Bookings</Text>
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    closeBtn: {
        padding: 5,
    },
    scrollContent: {
        paddingBottom: 100,
        alignItems: 'center',
    },
    successIconContainer: {
        marginTop: 20,
        marginBottom: 20,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    successCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
    },
    checkMark: {
        color: '#FFF',
        fontSize: 40,
        fontWeight: 'bold',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 14,
        marginBottom: 30,
        textAlign: 'center',
    },
    receiptCard: {
        width: '90%',
        borderRadius: 20,
        padding: 20,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    barberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    barberAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 15,
    },
    barberName: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    barberLocation: {
        fontSize: 12,
        marginTop: 2,
    },
    divider: {
        height: 1,
        marginBottom: 20,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    detailTextBox: {
        flex: 1,
    },
    detailLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    detailValue: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    calendarLink: {
        fontWeight: 'bold',
        fontSize: 12,
    },
    dashedLineContainer: {
        height: 20,
        overflow: 'hidden',
        marginVertical: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dashedLine: {
        letterSpacing: 4,
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
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
        fontWeight: 'bold',
    },
    totalValue: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
    },
    rateBarberBtn: {
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    viewBookingsBtn: {
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    btnText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
