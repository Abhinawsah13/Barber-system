import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList,
    TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { formatDate } from '../../utils/dateUtils';
import { getMyBookings, cancelBooking, payBooking, getReviewByBooking } from '../../services/api';
import { getUserData } from '../../services/TokenManager';

const CANCELLABLE_STATUSES = ['pending', 'confirmed'];

function getStatusLabel(status) {
    if (status === 'pending') return 'Pending';
    if (status === 'confirmed') return 'Confirmed';
    if (status === 'completed') return 'Completed';
    if (status === 'cancelled_by_customer') return 'Cancelled';
    if (status === 'cancelled_by_barber') return 'Cancelled by Barber';
    return status;
}

function getStatusColor(status, theme) {
    if (status === 'completed') return '#22c55e';
    if (status === 'confirmed') return theme.primary;
    if (status === 'pending') return '#f59e0b';
    if (status === 'cancelled_by_customer') return '#ef4444';
    if (status === 'cancelled_by_barber') return '#ef4444';
    return theme.textMuted;
}


export default function MyBookingsScreen({ navigation, route }) {
    const { theme } = useTheme();

    const [bookingList, setBookingList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState(null);
    const [reviewedBookings, setReviewedBookings] = useState({});
    const [cancellingId, setCancellingId] = useState(null);
    const [payingId, setPayingId] = useState(null);

    useEffect(() => {
        loadEverything();
    }, []);

    // reload when returning from RateBarberScreen so badge updates instantly
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            loadEverything();
        });
        return unsubscribe;
    }, [navigation]);

    const loadEverything = async () => {
        setLoading(true);
        try {
            const userData = await getUserData();
            const role = userData?.user_type || 'customer';
            setUserRole(role);

            const data = await getMyBookings();
            const bookings = data || [];
            setBookingList(bookings);

            // check which completed bookings already have a review
            if (role === 'customer') {
                const completedBookings = bookings.filter(b => b.status === 'completed');
                const reviewChecks = await Promise.all(
                    completedBookings.map(async (b) => {
                        const result = await getReviewByBooking(b._id);
                        return { bookingId: b._id, exists: result.exists };
                    })
                );

                const reviewMap = {};
                reviewChecks.forEach(({ bookingId, exists }) => {
                    if (exists) reviewMap[bookingId] = true;
                });
                setReviewedBookings(reviewMap);
            }
        } catch (error) {
            console.log('Error loading bookings:', error.message);
            Alert.alert('Error', 'Could not load your bookings. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelPress = (booking) => {
        Alert.alert(
            'Cancel Booking',
            `Are you sure you want to cancel your ${booking.service?.name} appointment?`,
            [
                { text: 'No', style: 'cancel' },
                { text: 'Yes, Cancel', style: 'destructive', onPress: () => confirmCancel(booking._id) },
            ]
        );
    };

    const confirmCancel = async (bookingId) => {
        setCancellingId(bookingId);
        try {
            await cancelBooking(bookingId);
            Alert.alert('Cancelled', 'Your booking has been cancelled.');
            setBookingList(prev =>
                prev.map(b => b._id === bookingId ? { ...b, status: 'cancelled_by_customer' } : b)
            );
        } catch (error) {
            Alert.alert('Error', error.message || 'Could not cancel booking. Please try again.');
        } finally {
            setCancellingId(null);
        }
    };

    const handlePayPress = async (bookingId) => {
        setPayingId(bookingId);
        try {
            await payBooking(bookingId);
            Alert.alert('Payment Successful!', 'Your booking has been marked as paid.');
            setBookingList(prev =>
                prev.map(b => b._id === bookingId ? { ...b, payment_status: 'paid' } : b)
            );
        } catch (error) {
            Alert.alert('Payment Failed', error.message || 'Something went wrong. Please try again.');
        } finally {
            setPayingId(null);
        }
    };

    // pass all booking data to the review screen
    const handleRatePress = (booking) => {
        navigation.navigate('RateBarber', {
            bookingId: booking._id,
            barberId: booking.barber?._id || booking.barber,
            barberName: booking.barber?.username || 'Barber',
            barberImage: booking.barber?.profile_image || null,
            serviceName: booking.service?.name || null,
            date: booking.date,
        });
    };

    const renderBookingCard = ({ item }) => {
        const isHighlighted = item._id === route.params?.bookingId;
        const statusLabel = getStatusLabel(item.status);
        const statusColor = getStatusColor(item.status, theme);

        const canCancel = CANCELLABLE_STATUSES.includes(item.status);
        const canPay =
            item.payment_status === 'pending' &&
            item.status !== 'cancelled_by_customer' &&
            item.status !== 'cancelled_by_barber';

        // only show rate button for customers on completed bookings
        const canRate = item.status === 'completed' && userRole === 'customer';
        const alreadyReviewed = !!reviewedBookings[item._id];

        const isCancelling = cancellingId === item._id;
        const isPaying = payingId === item._id;

        return (
            <View style={[
                styles.card,
                { backgroundColor: theme.card, shadowColor: theme.shadow },
                isHighlighted && { borderColor: theme.primary, borderWidth: 2, backgroundColor: theme.primary + '05' }
            ]}>

                <View style={styles.cardHeader}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={[styles.serviceName, { color: theme.text }]}>
                            {item.service?.name || 'Service'}
                        </Text>
                        <Text style={[styles.barberName, { color: theme.textLight }]}>
                            with {item.barber?.username || 'Barber'}
                        </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>
                            {statusLabel.toUpperCase()}
                        </Text>
                    </View>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                        <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Date</Text>
                        <Text style={[styles.detailValue, { color: theme.text }]}>{formatDate(item.date)}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Time</Text>
                        <Text style={[styles.detailValue, { color: theme.text }]}>{item.time_slot}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Price</Text>
                        <Text style={[styles.detailValue, { color: theme.text }]}>Rs {item.total_price}</Text>
                    </View>
                </View>

                <View style={styles.paymentStatusRow}>
                    <Text style={[styles.paymentLabel, { color: theme.textMuted }]}>Payment:</Text>
                    <Text style={[styles.paymentValue, { color: item.payment_status === 'paid' ? '#22c55e' : '#f59e0b' }]}>
                        {item.payment_status === 'paid' ? '✓ Paid' : 'Pending'}
                    </Text>
                </View>

                {(canCancel || canPay) ? (
                    <View style={styles.actionRow}>
                        {canPay ? (
                            <TouchableOpacity
                                style={[styles.payBtn, { backgroundColor: theme.primary }]}
                                onPress={() => handlePayPress(item._id)}
                                disabled={isPaying}
                                activeOpacity={0.8}
                            >
                                {isPaying
                                    ? <ActivityIndicator color="#FFF" size="small" />
                                    : <Text style={styles.btnText}>💳 Pay Now</Text>}
                            </TouchableOpacity>
                        ) : null}

                        {canCancel ? (
                            <TouchableOpacity
                                style={[styles.cancelBtn, { borderColor: '#ef4444' }]}
                                onPress={() => handleCancelPress(item)}
                                disabled={isCancelling}
                                activeOpacity={0.8}
                            >
                                {isCancelling
                                    ? <ActivityIndicator color="#ef4444" size="small" />
                                    : <Text style={[styles.cancelBtnText, { color: '#ef4444' }]}>Cancel</Text>}
                            </TouchableOpacity>
                        ) : null}
                    </View>
                ) : null}

                {canRate ? (
                    alreadyReviewed ? (
                        <View style={styles.reviewedBadge}>
                            <Text style={styles.reviewedText}>⭐ Review Submitted</Text>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={[styles.rateBtn, { backgroundColor: '#f59e0b' }]}
                            onPress={() => handleRatePress(item)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.rateBtnText}>⭐ Rate Your Barber</Text>
                        </TouchableOpacity>
                    )
                ) : null}

            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>

            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={[styles.backText, { color: theme.text }]}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>My Bookings</Text>
                <TouchableOpacity onPress={loadEverything} style={styles.refreshBtn}>
                    <Text style={{ color: theme.primary, fontSize: 14 }}>Refresh</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.centerView}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            ) : bookingList.length === 0 ? (
                <View style={styles.centerView}>
                    <Text style={{ fontSize: 40, marginBottom: 12 }}>📋</Text>
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>No bookings yet.</Text>
                    <TouchableOpacity
                        style={[styles.bookNowBtn, { backgroundColor: theme.primary }]}
                        onPress={() => navigation.navigate('Home')}
                    >
                        <Text style={styles.btnText}>Book a Barber</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={bookingList}
                    renderItem={renderBookingCard}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1 },
    backBtn: { marginRight: 10 },
    backText: { fontSize: 24, fontWeight: 'bold' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    refreshBtn: { padding: 4 },
    centerView: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyText: { fontSize: 16, marginBottom: 20 },
    listContent: { padding: 20 },
    card: { borderRadius: 14, padding: 18, marginBottom: 15, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
    serviceName: { fontSize: 17, fontWeight: 'bold', marginBottom: 3 },
    barberName: { fontSize: 13 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    statusText: { fontWeight: 'bold', fontSize: 11 },
    divider: { height: 1, marginBottom: 14 },
    detailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    detailItem: { alignItems: 'center' },
    detailLabel: { fontSize: 11, marginBottom: 3 },
    detailValue: { fontSize: 13, fontWeight: 'bold' },
    paymentStatusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 6 },
    paymentLabel: { fontSize: 13 },
    paymentValue: { fontSize: 13, fontWeight: '600' },
    actionRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    payBtn: { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    cancelBtn: { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, backgroundColor: 'transparent' },
    btnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
    cancelBtnText: { fontWeight: '700', fontSize: 14 },
    bookNowBtn: { paddingHorizontal: 28, paddingVertical: 13, borderRadius: 12 },
    rateBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 4 },
    rateBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
    reviewedBadge: { paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginTop: 4, backgroundColor: '#22c55e18' },
    reviewedText: { color: '#22c55e', fontWeight: '700', fontSize: 14 },
});
