import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList,
    TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageProvider';
import { formatDate } from '../../utils/dateUtils';
import io from 'socket.io-client';
import { SOCKET_BASE_URL } from '../../config/server';
import { getMyBookings, cancelBooking, getReviewByBooking, initiateKhaltiPayment } from '../../services/api';
import { getUserData } from '../../services/TokenManager';

const CANCELLABLE_STATUSES = ['pending', 'confirmed'];

export default function MyBookingsScreen({ navigation, route }) {
    const { theme } = useTheme();
    const { t } = useLanguage();
    
    function getStatusLabel(status) {
        if (status === 'pending') return t('status_pending');
        if (status === 'confirmed') return t('status_confirmed');
        if (status === 'completed') return t('status_completed');
        if (status === 'cancelled_by_customer') return t('status_cancelled_by_customer');
        if (status === 'cancelled_by_barber') return t('status_cancelled_by_barber');
        return status;
    }

    const [bookingList, setBookingList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState(null);
    const [reviewedBookings, setReviewedBookings] = useState({});
    const [cancellingId, setCancellingId] = useState(null);
    const [payingId, setPayingId] = useState(null);
    const [cancelModalVisible, setCancelModalVisible] = useState(false);
    const [pendingCancelBooking, setPendingCancelBooking] = useState(null);
    const [cancelReason, setCancelReason] = useState('');
    const flatListRef = useRef(null);
    const highlightedBookingId = route.params?.bookingId || null;
    const isDetailMode = !!highlightedBookingId;

    useEffect(() => {
        let socket;
        const setupSocket = async () => {
            const userData = await getUserData();
            if (userData?._id && userData?.user_type === 'customer') {
                socket = io(SOCKET_BASE_URL);
                socket.emit('join-user-room', userData._id);

                socket.on('notification_received', (notification) => {
                    if (notification?.message) {
                        Alert.alert('🔔 Notification', notification.message);
                    }
                    loadEverything();
                });

                socket.on('booking-completed', (booking) => {
                    navigation.navigate('RateBarber', {
                        bookingId: booking._id,
                        barberId: booking.barber?._id || booking.barber,
                        barberName: booking.barber?.username || 'Barber',
                        barberImage: booking.barber?.profile_image || null,
                        serviceName: booking.service?.name || null,
                        date: booking.date,
                    });
                });
            }
        };

        loadEverything();
        setupSocket();

        return () => {
            if (socket) {
                socket.disconnect();
            }
        };
    }, []);

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

            if (role === 'customer') {
                const reviewMap = {};
                bookings.forEach(b => {
                    if (b.reviewGiven === true) reviewMap[b._id] = true;
                });

                const needsCheck = bookings.filter(
                    b => b.status === 'completed' && b.reviewGiven !== true
                );

                if (needsCheck.length > 0) {
                    const apiChecks = await Promise.all(
                        needsCheck.map(async (b) => {
                            const result = await getReviewByBooking(b._id);
                            return { bookingId: b._id, exists: result.exists };
                        })
                    );
                    apiChecks.forEach(({ bookingId, exists }) => {
                        if (exists) reviewMap[bookingId] = true;
                    });
                }
                setReviewedBookings(reviewMap);
            }
        } catch (error) {
            console.log('Error loading bookings:', error.message);
            Alert.alert('Error', 'Could not load your bookings. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const getRefundInfo = (booking) => {
        if (booking.payment_status !== 'paid') {
            return { percentage: 0, amount: 0, travelRefund: 0, message: 'No payment was made — no refund needed.' };
        }

        if (booking.barber_on_the_way) {
            const serviceCharge = booking.total_price - (booking.travel_charge || 0);
            const amt = Math.round(serviceCharge * 0.30);
            return {
                percentage: 30,
                amount: amt,
                travelRefund: 0,
                message: t('on_the_way_alert'),
            };
        }

        const now = new Date();
        const bookingDate = new Date(booking.date);
        const [hours, minutes] = booking.time_slot.split(':').map(Number);
        const serviceStart = new Date(bookingDate);
        serviceStart.setHours(hours, minutes, 0, 0);

        const hoursUntil = (serviceStart.getTime() - now.getTime()) / (1000 * 60 * 60);
        const travelCharge = booking.travel_charge || 0;
        const serviceCharge = booking.total_price - travelCharge;

        if (hoursUntil <= 0) {
            return { percentage: 0, amount: 0, travelRefund: 0, message: '⚠️ ' + t('no_refund_late') };
        } else if (hoursUntil < 1) {
            const amt = Math.round(serviceCharge * 0.50);
            return { percentage: 50, amount: amt, travelRefund: 0, message: `50% refund (Rs ${amt})` };
        } else if (hoursUntil < 2) {
            const amt = Math.round(serviceCharge * 0.70);
            return { percentage: 70, amount: amt + travelCharge, travelRefund: travelCharge, message: `70% refund (Rs ${amt + travelCharge})` };
        } else {
            return { percentage: 100, amount: booking.total_price, travelRefund: travelCharge, message: `Full refund (Rs ${booking.total_price})` };
        }
    };

    const handleCancelPress = (booking) => {
        setPendingCancelBooking(booking);
        setCancelReason('');
        setCancelModalVisible(true);
    };

    const proceedWithCancel = () => {
        if (!pendingCancelBooking) return;
        const booking = pendingCancelBooking;
        const refundInfo = getRefundInfo(booking);

        const refundLine = refundInfo.amount > 0
            ? `\n\n💰 ${refundInfo.message}`
            : refundInfo.message ? `\n\n${refundInfo.message}` : '';

        setCancelModalVisible(false);

        Alert.alert(
            t('cancel'),
            `${t('cancel_confirm')} ${booking.service?.name}?${refundLine}`,
            [
                { text: t('keep_it'), style: 'cancel' },
                {
                    text: refundInfo.amount > 0 ? `${t('cancel')} & Refund Rs ${refundInfo.amount}` : t('cancel'),
                    style: 'destructive',
                    onPress: () => confirmCancel(booking._id, cancelReason),
                },
            ]
        );
    };

    const confirmCancel = async (bookingId, reason) => {
        setCancellingId(bookingId);
        try {
            const result = await cancelBooking(bookingId, reason);
            const data = result?.data || {};

            let successMessage = t('status_cancelled');

            if (data.refund_amount > 0) {
                successMessage = `Booking cancelled!\n\n💰 Rs ${data.refund_amount} (${data.refund_percentage}% refund) ${t('refund_to_wallet')}.`;
            } else if (data.refund_message) {
                successMessage += `\n\n${data.refund_message}`;
            }

            Alert.alert('Booking Cancelled', successMessage);

            setBookingList(prev =>
                prev.map(b => b._id === bookingId ? {
                    ...b,
                    status: 'cancelled_by_customer',
                    refund_amount: data.refund_amount || 0,
                    refund_percentage: data.refund_percentage || 0,
                    payment_status: data.refund_amount > 0 ? 'refunded' : b.payment_status,
                } : b)
            );
        } catch (error) {
            Alert.alert('Error', error.message || 'Could not cancel booking.');
        } finally {
            setCancellingId(null);
            setPendingCancelBooking(null);
        }
    };

    const handlePayPress = (booking) => {
        Alert.alert(
            `💳 ${t('choose_payment')}`,
            `${t('pay_now')} Rs ${booking.total_price} for ${booking.service?.name}`,
            [
                { text: '💜 Khalti', onPress: () => payWithKhalti(booking) },
                { text: t('cancel'), style: 'cancel' },
            ]
        );
    };

    const payWithKhalti = async (booking) => {
        setPayingId(booking._id);
        try {
            const result = await initiateKhaltiPayment({
                barberId: booking.barber?._id || booking.barber,
                serviceId: booking.service?._id || booking.service,
                date: new Date(booking.date).toISOString().split('T')[0],
                timeSlot: booking.time_slot,
                serviceType: booking.service_type || 'salon',
                customerAddress: booking.customer_address || '',
                notes: booking.notes || '',
                amount: booking.total_price,
                customerName: '',
                customerEmail: '',
                customerPhone: '',
                existingBookingId: booking._id,
            });

            if (result.success) {
                navigation.navigate('PaymentWebView', {
                    paymentUrl: result.paymentUrl,
                    gateway: 'khalti',
                    pidx: result.pidx,
                    bookingId: result.bookingId || booking._id,
                    amount: booking.total_price,
                    onSuccessRoute: 'MyBookings',
                    successParams: {},
                });
            } else {
                Alert.alert('Error', result.message || 'Could not initiate Khalti payment.');
            }
        } catch (e) {
            Alert.alert('Payment Error', e.message || 'Something went wrong.');
        } finally {
            setPayingId(null);
        }
    };

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
        const isHighlighted = item._id === highlightedBookingId;
        const statusLabel = getStatusLabel(item.status);
        const statusColor = getStatusColor(item.status, theme);

        const canCancel = CANCELLABLE_STATUSES.includes(item.status);
        const canPay =
            userRole === 'customer' &&
            item.payment_status === 'pending' &&
            item.status !== 'cancelled_by_customer' &&
            item.status !== 'cancelled_by_barber' &&
            item.service_type !== 'home'; // Hide pay button for home service

        const isHomeServicePendingPayment = 
            item.service_type === 'home' && 
            item.payment_status === 'pending' &&
            item.status !== 'cancelled_by_customer' &&
            item.status !== 'cancelled_by_barber';

        const canRate = item.status === 'completed' && userRole === 'customer';
        const alreadyReviewed = !!reviewedBookings[item._id];
        const isCancelling = cancellingId === item._id;
        const isPaying = payingId === item._id;
        const isCancelled = item.status === 'cancelled_by_customer' || item.status === 'cancelled_by_barber';
        const hasRefund = isCancelled && item.refund_amount > 0;

        return (
            <View style={[
                styles.card,
                { backgroundColor: theme.card, shadowColor: theme.shadow },
                isHighlighted && { borderColor: theme.primary, borderWidth: 2, backgroundColor: theme.primary + '08' }
            ]}>
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={[styles.serviceName, { color: theme.text }]}>
                            {item.service?.name || 'Service'}
                        </Text>
                        <Text style={[styles.barberName, { color: theme.textLight }]}>
                            {userRole === 'barber' ? `${t('profile')}: ${item.customer?.username || 'Client'}` : `with ${item.barber?.username || 'Barber'}`}
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
                        <Text style={[styles.detailLabel, { color: theme.textMuted }]}>{t('date')}</Text>
                        <Text style={[styles.detailValue, { color: theme.text }]}>{formatDate(item.date)}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Text style={[styles.detailLabel, { color: theme.textMuted }]}>{t('time')}</Text>
                        <Text style={[styles.detailValue, { color: theme.text }]}>{item.time_slot}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Text style={[styles.detailLabel, { color: theme.textMuted }]}>{t('price')}</Text>
                        <Text style={[styles.detailValue, { color: theme.text }]}>Rs {item.total_price}</Text>
                    </View>
                </View>

                <View style={styles.paymentStatusRow}>
                    <Text style={[styles.paymentLabel, { color: theme.textMuted }]}>{t('payment')}:</Text>
                    <Text style={[styles.paymentValue, {
                        color: item.payment_status === 'paid' ? '#22c55e'
                            : item.payment_status === 'refunded' ? '#3b82f6'
                            : '#f59e0b'
                    }]}>
                        {item.payment_status === 'paid' ? `✓ ${t('paid')}`
                            : item.payment_status === 'refunded' ? `↩ ${t('status_refunded')}`
                            : t('status_pending')}
                    </Text>
                </View>

                {item.barber_on_the_way && !isCancelled && (
                    <View style={styles.onTheWayBadge}>
                        <Text style={styles.onTheWayText}>🚨 {t('on_the_way_alert')}</Text>
                    </View>
                )}
                {hasRefund && (
                    <View style={styles.refundBadge}>
                        <Text style={styles.refundBadgeText}>
                            💰 Rs {item.refund_amount} {t('refund_to_wallet')}
                        </Text>
                    </View>
                )}

                {isCancelled && item.payment_status === 'paid' && !hasRefund && (
                    <View style={[styles.refundBadge, { backgroundColor: '#FEF2F2' }]}>
                        <Text style={[styles.refundBadgeText, { color: '#DC2626' }]}>
                            ⚠️ {t('no_refund_late')}
                        </Text>
                    </View>
                )}

                <View style={styles.actionRow}>
                    {canPay && (
                        <TouchableOpacity
                            style={[styles.payBtn, { backgroundColor: theme.primary }]}
                            onPress={() => handlePayPress(item)}
                            disabled={isPaying}
                        >
                            {isPaying
                                ? <ActivityIndicator color="#FFF" size="small" />
                                : <Text style={styles.btnText}>💳 {t('pay_now')}</Text>}
                        </TouchableOpacity>
                    )}

                    {isHomeServicePendingPayment && userRole === 'customer' && (
                        <View style={[styles.payBtn, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}>
                             <Text style={[styles.btnText, { color: theme.text, fontWeight: '600' }]}>
                                🏠 {t('status_pending')} (Pay After Service)
                             </Text>
                        </View>
                    )}

                    {canCancel && (
                        <TouchableOpacity
                            style={[styles.cancelBtn, { borderColor: '#ef4444' }]}
                            onPress={() => handleCancelPress(item)}
                            disabled={isCancelling}
                        >
                            {isCancelling
                                ? <ActivityIndicator color="#ef4444" size="small" />
                                : <Text style={[styles.cancelBtnText, { color: '#ef4444' }]}>{t('cancel')}</Text>}
                        </TouchableOpacity>
                    )}
                </View>

                {canRate && (
                    alreadyReviewed ? (
                        <View style={styles.reviewedBadge}>
                            <Text style={styles.reviewedText}>⭐ {t('review_submitted')}</Text>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={[styles.rateBtn, { backgroundColor: '#f59e0b' }]}
                            onPress={() => handleRatePress(item)}
                        >
                            <Text style={styles.rateBtnText}>⭐ {t('rate_barber')}</Text>
                        </TouchableOpacity>
                    )
                )}

                {item.status === 'confirmed' && userRole === 'customer' && (
                    <View style={styles.pendingReviewNote}>
                        <Text style={styles.pendingReviewText}>⏳ {t('rate_available_after')}</Text>
                    </View>
                )}
            </View>
        );
    };

    const displayList = isDetailMode
        ? bookingList.filter(b => b._id === highlightedBookingId)
        : bookingList;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={[styles.backText, { color: theme.text }]}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>
                    {isDetailMode ? t('booking_detail') : t('my_bookings')}
                </Text>
                <TouchableOpacity onPress={loadEverything} style={styles.refreshBtn}>
                    <Text style={{ color: theme.primary, fontSize: 14 }}>{t('refresh')}</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.centerView}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            ) : displayList.length === 0 ? (
                <View style={styles.centerView}>
                    <Text style={{ fontSize: 40, marginBottom: 12 }}>📋</Text>
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t('no_bookings')}</Text>
                    {userRole === 'customer' && (
                        <TouchableOpacity
                            style={[styles.bookNowBtn, { backgroundColor: theme.primary }]}
                            onPress={() => navigation.navigate('Home')}
                        >
                            <Text style={styles.btnText}>{t('book_barber')}</Text>
                        </TouchableOpacity>
                    )}
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={displayList}
                    renderItem={renderBookingCard}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}

            <Modal
                visible={cancelModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setCancelModalVisible(false)}
            >
                <KeyboardAvoidingView 
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View style={[styles.modalBox, { backgroundColor: theme.card }]}>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>❌ {t('cancel')}</Text>
                        <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>{t('cancel_reason')}</Text>
                        <TextInput
                            style={[styles.reasonInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                            placeholder="..."
                            placeholderTextColor={theme.textMuted}
                            value={cancelReason}
                            onChangeText={setCancelReason}
                            multiline
                            maxLength={200}
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: theme.border }]}
                                onPress={() => setCancelModalVisible(false)}
                            >
                                <Text style={[styles.modalBtnText, { color: theme.text }]}>{t('keep_it')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: '#ef4444' }]}
                                onPress={proceedWithCancel}
                            >
                                <Text style={[styles.modalBtnText, { color: '#FFF' }]}>{t('cancel')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

function getStatusColor(status, theme) {
    if (status === 'completed') return '#22c55e';
    if (status === 'confirmed') return theme.primary;
    if (status === 'pending') return '#f59e0b';
    if (status === 'cancelled_by_customer' || status === 'cancelled_by_barber') return '#ef4444';
    return theme.textMuted;
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
    viewAllBtn: { margin: 16, marginTop: 0, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
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

    // ✅ Progress indicator styles
    progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, paddingHorizontal: 10 },
    progressDot: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    progressDotText: { fontSize: 12 },
    progressLine: { flex: 1, height: 3, marginHorizontal: 4 },

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

    // ✅ Pending review note
    pendingReviewNote: { paddingVertical: 8, borderRadius: 8, alignItems: 'center', marginTop: 4, backgroundColor: '#FFF3E0' },
    pendingReviewText: { color: '#E65100', fontSize: 12, fontWeight: '600' },

    // ✅ Refund badge styles
    refundBadge: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 12,
        backgroundColor: '#EFF6FF',
    },
    refundBadgeText: {
        color: '#2563EB',
        fontSize: 12,
        fontWeight: '600',
    },

    // ✅ Notification highlight banner
    notifHighlightBanner: {
        backgroundColor: '#F3E8FF',
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 10,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    notifHighlightText: {
        color: '#7C3AED',
        fontWeight: '700',
        fontSize: 12,
    },

    // ✅ On-the-way warning badge
    onTheWayBadge: {
        backgroundColor: '#FFF7ED',
        borderWidth: 1,
        borderColor: '#F97316',
        borderRadius: 8,
        paddingVertical: 7,
        paddingHorizontal: 12,
        marginBottom: 12,
        alignItems: 'center',
    },
    onTheWayText: {
        color: '#C2410C',
        fontSize: 12,
        fontWeight: '700',
    },

    // ✅ Cancel reason modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalBox: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 36,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    modalSubtitle: {
        fontSize: 13,
        marginBottom: 8,
        marginTop: 4,
    },
    refundPreviewBox: {
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 14,
        marginBottom: 14,
    },
    refundPreviewText: {
        fontSize: 13,
        fontWeight: '700',
    },
    reasonInput: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        fontSize: 14,
        minHeight: 70,
        textAlignVertical: 'top',
        marginBottom: 20,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 10,
    },
    modalBtn: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 12,
        alignItems: 'center',
    },
    modalBtnText: {
        fontWeight: '700',
        fontSize: 15,
    },
});
