import React, { useState, useEffect, useRef } from "react";
import {
    View, Text, StyleSheet, TouchableOpacity,
    ScrollView, RefreshControl, Linking, Alert, Image
} from "react-native";
import * as Location from 'expo-location';
import io from 'socket.io-client';
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageProvider";
import { SOCKET_BASE_URL } from '../../config/server';
import { getMyBookings, toggleBarberOnlineStatus, updateBookingStatus, getProfile, getBarberById, getMyBarberProfile, markBarberOnTheWay, getUnreadNotificationCount } from "../../services/api";
import { getUserData } from "../../services/TokenManager";
import { Ionicons } from '@expo/vector-icons';

export default function BarberHomeScreen({ navigation, route }) {
    const { theme } = useTheme();
    const { t } = useLanguage();
    const [refreshing, setRefreshing] = useState(false);
    // ... rest of state ...
    const [stats, setStats] = useState({ todayBookings: 0, totalEarnings: "Rs 0" });
    const [schedule, setSchedule] = useState([]);
    const [isOnline, setIsOnline] = useState(false);
    const [userRole, setUserRole] = useState('barber');
    const [barberId, setBarberId] = useState(null);
    const [subscriptionPlan, setSubscriptionPlan] = useState('basic');

    const [liveLocations, setLiveLocations] = useState({});
    const [profileMissing, setProfileMissing] = useState([]);
    const [userData, setUserData] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const socketRef = useRef(null);

    const loadData = async () => {
        try {
            const ud = await getUserData();
            setUserData(ud);
            setUserRole(ud?.user_type || 'barber');
            setBarberId(ud?._id);

            const bookings = await getMyBookings();
            const today = new Date().toISOString().split('T')[0];
            const todaysBookings = bookings.filter(b =>
                b.date?.startsWith(today) &&
                b.status !== 'cancelled_by_customer' &&
                b.status !== 'cancelled_by_barber'
            );

            const completed = bookings.filter(b => b.status === 'completed');
            const earnings = completed.reduce((acc, curr) => acc + (curr.total_price || 0), 0);

            setStats({
                todayBookings: todaysBookings.length,
                totalEarnings: `Rs ${earnings}`
            });

            const upcoming = bookings
                .filter(b => b.status === 'pending' || b.status === 'confirmed')
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .slice(0, 5);

            setSchedule(upcoming);

            try {
                const userProfile = await getProfile();
                const missing = [];
                if (!userProfile?.phone) missing.push('phone number');
                if (!userProfile?.profile_image) missing.push('profile photo');

                // ✅ Use getMyBarberProfile() — server resolves via JWT, no ID needed
                const bp = await getMyBarberProfile().catch(() => null);
                if (bp) {
                    setSubscriptionPlan(bp.subscription_plan || 'basic');
                    if (!bp.bio || bp.bio === 'Welcome to my barber profile!') missing.push('bio');
                    if (!bp.location?.address) missing.push('salon address');
                    if (!bp.services || bp.services.length === 0) missing.push('at least 1 service');
                }

                setProfileMissing(missing);
            } catch (_) {
                console.log("Profile completeness check failed (soft failure)");
            }

            const count = await getUnreadNotificationCount();
            setUnreadCount(count);
        } catch (error) {
            console.error("Failed to load dashboard data", error);
        }
    };

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    }, []);

    useEffect(() => {
        const init = async () => {
            const userData = await getUserData();
            if (userData?.user_type === 'admin') {
                navigation.replace('AdminDashboard');
                return;
            }

            await loadData();
            await toggleOnlineStatus(true);

            socketRef.current = io(SOCKET_BASE_URL);

            if (userData?._id) {
                socketRef.current.emit('join-user-room', { userId: userData._id, role: 'barber' });
            }

            socketRef.current.on('notification_received', (notification) => {
                if (notification?.message) {
                    Alert.alert('🔔 Management Alert', notification.message);
                }
                loadData();
            });

            socketRef.current.on('unread_count_update', ({ count }) => {
                setUnreadCount(count);
            });

            socketRef.current.on('customer-location-update', (data) => {
                const { bookingId, lat, lng } = data;
                setLiveLocations(prev => ({
                    ...prev,
                    [bookingId]: { lat, lng, isLive: true, updatedAt: new Date() }
                }));
            });

            socketRef.current.on('customer-location-stopped', (data) => {
                const { bookingId } = data;
                setLiveLocations(prev => ({
                    ...prev,
                    [bookingId]: { ...prev[bookingId], isLive: false }
                }));
            });

            socketRef.current.on('new-booking', (booking) => {
                Alert.alert(
                    '🔔 New Booking!',
                    `From ${booking.customer?.username || 'Customer'}\n${booking.service?.name || 'Service'} @ ${booking.time_slot}`,
                    [
                        { text: 'View', onPress: () => loadData() },
                        { text: 'OK' }
                    ]
                );
                loadData();
            });

            socketRef.current.on('booking-cancelled-by-customer', (data) => {
                Alert.alert(
                    '❌ Booking Cancelled',
                    `${data.customerName || 'Customer'} cancelled their ${data.serviceName || 'service'} booking (${data.timeSlot || ''}).`,
                    [{ text: 'OK' }]
                );
                setSchedule(prev => prev.filter(b => b._id?.toString() !== data.bookingId?.toString()));
            });
        };

        init();

        const unsubscribeFocus = navigation.addListener('focus', () => {
            loadData();
        });

        return () => {
            unsubscribeFocus();
            if (socketRef.current) {
                socketRef.current.off('unread_count_update');
                socketRef.current.off('customer-location-update');
                socketRef.current.off('customer-location-stopped');
                socketRef.current.off('new-booking');
                socketRef.current.off('booking-cancelled-by-customer');
                socketRef.current.disconnect();
            }
        };
    }, [navigation]);

    const toggleOnlineStatus = async (online) => {
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;

            let location = await Location.getCurrentPositionAsync({});
            setIsOnline(online);

            await toggleBarberOnlineStatus({
                isOnline: online,
                lat: location.coords.latitude,
                lng: location.coords.longitude
            });
        } catch (error) {
            if (!error?.message?.includes("Profile not found")) { console.error("Failed to toggle online status", error); }
        }
    };

    const formatTime = (timeSlot) => timeSlot || '--:--';

    const handleNavigateToCustomer = (item) => {
        const liveData = liveLocations[item._id];

        if (liveData?.isLive && liveData.lat && liveData.lng) {
            const url = `https://www.google.com/maps/dir/?api=1&destination=${liveData.lat},${liveData.lng}`;
            Linking.openURL(url);
            return;
        }

        const coords = item.customer_location?.coordinates;
        const hasGps = coords && coords.length === 2 &&
            !(coords[0] === 85.3240 && coords[1] === 27.7172);

        if (hasGps) {
            const [lng, lat] = coords;
            const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
            Linking.openURL(url);
            return;
        }

        if (item.customer_address) {
            const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.customer_address)}`;
            Linking.openURL(url);
            return;
        }

        Alert.alert('No Location', 'Customer location is not available for this booking.');
    };

    const handleSubscriptionPress = () => {
        navigation.navigate('Subscription');
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={[styles.greeting, { color: theme.text }]}>{t('home')}! ✂️</Text>
                        <Text style={[styles.subGreeting, { color: theme.textLight }]}>{t('manage_shop')}</Text>
                    </View>
                    <View style={styles.headerRight}>
                        <TouchableOpacity
                            onPress={() => navigation.navigate('Notifications')}
                            style={[styles.headerBtn, { backgroundColor: theme.card, marginRight: 10, position: 'relative' }]}
                        >
                            <Text style={{ fontSize: 20 }}>🔔</Text>
                            {unreadCount > 0 && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => navigation.navigate('BarberSettings')}
                            style={[styles.headerBtn, { backgroundColor: theme.card }]}
                        >
                            <Text style={{ fontSize: 20 }}>⚙️</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── Incomplete Profile Banner ────── */}
                {profileMissing.length > 0 && (
                    <TouchableOpacity
                        style={styles.profileBanner}
                        onPress={() => navigation.navigate('BarberProfile')}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.profileBannerIcon}>⚠️</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.profileBannerTitle}>{t('complete_profile')}</Text>
                            <Text style={styles.profileBannerMsg} numberOfLines={2}>
                                Missing: {profileMissing.join(', ')}. Tap to complete →
                            </Text>
                        </View>
                    </TouchableOpacity>
                )}

                {/* ── Premium Subscription Banner ────── */}
                {subscriptionPlan === 'basic' && (
                    <TouchableOpacity
                        style={[styles.premiumBanner, { backgroundColor: '#5C2D91' }]}
                        onPress={handleSubscriptionPress}
                        activeOpacity={0.9}
                    >
                        <View style={styles.premiumIconContainer}>
                            <Text style={{ fontSize: 24 }}>⭐</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.premiumTitle}>{t('upgrade_plan')}</Text>
                            <Text style={styles.premiumMsg}>
                                Save 50% on commission (10% → 5%) & get unlimited services!
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#FFF" />
                    </TouchableOpacity>
                )}

                {/* Stats */}
                <View style={styles.statsContainer}>
                    <View style={[styles.statCard, { backgroundColor: '#E3F2FD' }]}>
                        <Text style={[styles.statValue, { color: '#1565C0' }]}>{stats.todayBookings}</Text>
                        <Text style={[styles.statLabel, { color: '#1565C0' }]}>{t('active_bookings')}</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: '#E8F5E9' }]}>
                        <Text style={[styles.statValue, { color: '#2E7D32' }]}>{stats.totalEarnings}</Text>
                        <Text style={[styles.statLabel, { color: '#2E7D32' }]}>{t('total_earnings')}</Text>
                    </View>
                </View>

                {/* Quick Actions */}
                <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('manage_shop')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.actionRow}>
                    {[
                        { label: t('wallet'), emoji: '💰', screen: 'Wallet' },
                        { label: t('my_profile'), emoji: '👤', screen: 'BarberProfile' },
                        { label: t('my_services') || 'Services', emoji: '✂️', screen: 'BarberServices' },
                        { label: t('appointment'), emoji: '📅', screen: 'Appointments' },
                        { label: t('premium'), emoji: '⭐', screen: 'Subscription' },
                        { label: t('settings'), emoji: '⚙️', screen: 'BarberSettings' },
                    ].map(action => (
                        <TouchableOpacity
                            key={action.label}
                            style={[styles.actionPill, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}
                            onPress={() => {
                                if (action.screen) {
                                    console.log(`[BarberHome] Navigating to ${action.screen}...`);
                                    navigation.navigate(action.screen);
                                }
                            }}
                        >
                            <Text style={styles.actionEmoji}>{action.emoji}</Text>
                            <Text style={[styles.actionText, { color: theme.text }]}>{action.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Schedule */}
                <View style={styles.scheduleHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('upcoming')}</Text>
                </View>

                {schedule.length === 0 ? (
                    <View style={styles.emptySlot}>
                        <Text style={styles.emptyText}>No upcoming appointments.</Text>
                    </View>
                ) : (
                    schedule.map((item) => {
                        const isHighlighted = item._id === route.params?.bookingId;
                        const isHomeService = item.service_type === 'home';
                        const liveData = liveLocations[item._id];
                        const hasLiveLocation = liveData?.isLive;

                        return (
                            <View key={item._id}>
                                <View style={[
                                    styles.apptCard,
                                    { backgroundColor: theme.card },
                                    isHighlighted && { borderColor: theme.primary, borderWidth: 2 },
                                    isHomeService && { borderLeftWidth: 4, borderLeftColor: '#4CAF50' }
                                ]}>
                                    {/* Service type badge */}
                                    <View style={[
                                        styles.serviceTypeBadge,
                                        { backgroundColor: isHomeService ? '#E8F5E9' : '#E3F2FD' }
                                    ]}>
                                        <Text style={{
                                            fontSize: 10, fontWeight: 'bold',
                                            color: isHomeService ? '#2E7D32' : '#1565C0'
                                        }}>
                                            {isHomeService ? '🏠 HOME' : '💈 SALON'}
                                        </Text>
                                    </View>

                                    <View style={styles.apptMain}>
                                        <View style={styles.startTime}>
                                            <Text style={styles.timeText}>{formatTime(item.time_slot)}</Text>
                                        </View>

                                        <View style={styles.apptDetails}>
                                            <Text style={[styles.clientName, { color: theme.text }]}>
                                                {item.customer?.username || "Client"}
                                            </Text>
                                            <Text style={[styles.serviceName, { color: theme.textLight }]}>
                                                {item.service?.name || "Service"} • Rs {item.total_price || 0}
                                            </Text>

                                            {(item.status === 'confirmed' || item.status === 'completed' || item.status === 'on_the_way') && item.customer?.phone && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.primary }}>📞 {item.customer.phone}</Text>
                                                </View>
                                            )}

                                            {/* ✅ Navigate button — barber + home only */}
                                            {userRole === 'barber' && isHomeService && (
                                                <View>
                                                    {/* ✅ Live location indicator */}
                                                    {hasLiveLocation && (
                                                        <View style={styles.liveIndicator}>
                                                            <Text style={styles.liveIndicatorText}>
                                                                🟢 Customer is sharing live location
                                                            </Text>
                                                        </View>
                                                    )}

                                                    <TouchableOpacity
                                                        onPress={() => handleNavigateToCustomer(item)}
                                                        style={[
                                                            styles.navigateBtn,
                                                            { backgroundColor: hasLiveLocation ? '#4CAF50' : '#E3F2FD' }
                                                        ]}
                                                    >
                                                        <Text style={[
                                                            styles.navigateBtnText,
                                                            { color: hasLiveLocation ? '#fff' : '#1565C0' }
                                                        ]}>
                                                            {hasLiveLocation
                                                                ? '🟢 Navigate (Live Location)'
                                                                : '🗺️ Navigate to Customer'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>
                                            )}

                                            {isHomeService && item.customer_address ? (
                                                <Text style={styles.addressText}>
                                                    📍 {item.customer_address}
                                                </Text>
                                            ) : null}
                                        </View>

                                        {/* ── Accept / Decline buttons (pending) or status badge ── */}
                                        <View style={styles.actionBtnCol}>
                                            {item.status === 'pending' ? (
                                                <>
                                                    {/* ACCEPT */}
                                                    <TouchableOpacity
                                                        style={styles.acceptBtn}
                                                        onPress={async () => {
                                                            try {
                                                                await updateBookingStatus(item._id, 'confirmed');
                                                                Alert.alert('✓ Accepted', `Booking for ${item.customer?.username || 'customer'} confirmed!`);
                                                                loadData();
                                                            } catch (error) {
                                                                Alert.alert('Error', 'Failed to confirm booking');
                                                            }
                                                        }}
                                                    >
                                                        <Text style={styles.acceptBtnText}>✓</Text>
                                                        <Text style={styles.acceptBtnLabel}>{t('confirmed')}</Text>
                                                    </TouchableOpacity>

                                                    {/* DECLINE */}
                                                    <TouchableOpacity
                                                        style={styles.declineBtn}
                                                        onPress={() => {
                                                            Alert.alert(
                                                                '❌ Decline Booking?',
                                                                `Decline ${item.customer?.username || 'customer'}'s booking for ${item.service?.name || 'service'} at ${item.time_slot}?\n\nThe customer will be notified and refunded.`,
                                                                [
                                                                    { text: 'Keep It', style: 'cancel' },
                                                                    {
                                                                        text: 'Yes, Decline',
                                                                        style: 'destructive',
                                                                        onPress: async () => {
                                                                            try {
                                                                                await updateBookingStatus(item._id, 'cancelled_by_barber');
                                                                                Alert.alert('Declined', 'Booking has been declined. Customer will be notified.');
                                                                                loadData();
                                                                            } catch (err) {
                                                                                Alert.alert('Error', 'Could not decline booking.');
                                                                            }
                                                                        }
                                                                    }
                                                                ]
                                                            );
                                                        }}
                                                    >
                                                        <Text style={styles.declineBtnText}>✗</Text>
                                                        <Text style={styles.declineBtnLabel}>{t('cancelled')}</Text>
                                                    </TouchableOpacity>
                                                </>
                                            ) : item.status === 'confirmed' ? (
                                                <View style={styles.confirmedBadge}>
                                                    <Text style={styles.confirmedBadgeText}>✓</Text>
                                                    <Text style={styles.confirmedBadgeLabel}>{t('confirmed')}</Text>
                                                </View>
                                            ) : item.status === 'completed' ? (
                                                <View style={[styles.confirmedBadge, { backgroundColor: '#DCFCE7' }]}>
                                                    <Text style={[styles.confirmedBadgeText, { color: '#166534' }]}>✓✓</Text>
                                                    <Text style={[styles.confirmedBadgeLabel, { color: '#166534' }]}>{t('completed')}</Text>
                                                </View>
                                            ) : null}
                                        </View>
                                    </View>
                                </View>

                                {/* ✅ On The Way button — home service confirmed only */}
                                {item.status === 'confirmed' && isHomeService && !item.barber_on_the_way && (
                                    <TouchableOpacity
                                        style={styles.onTheWayBtn}
                                        onPress={() => {
                                            Alert.alert(
                                                '🛵 Mark On The Way?',
                                                `This will notify ${item.customer?.username || 'the customer'} that you are on your way.\n\n⚠️ After this, if the customer cancels, they will only receive a 30% refund.`,
                                                [
                                                    { text: 'Not Yet', style: 'cancel' },
                                                    {
                                                        text: "Yes, I'm On My Way",
                                                        onPress: async () => {
                                                            try {
                                                                await markBarberOnTheWay(item._id);
                                                                Alert.alert('✓ Notified!', 'Customer has been notified you are on the way.');
                                                                loadData();
                                                            } catch (err) {
                                                                Alert.alert('Error', 'Could not update status.');
                                                            }
                                                        }
                                                    },
                                                ]
                                            );
                                        }}
                                    >
                                        <Text style={styles.onTheWayBtnText}>🛵 I'm On The Way</Text>
                                    </TouchableOpacity>
                                )}

                                {/* Already on the way badge */}
                                {item.barber_on_the_way && item.status === 'confirmed' && (
                                    <View style={styles.onTheWayActiveBadge}>
                                        <Text style={styles.onTheWayActiveText}>🟢 You are on the way to customer</Text>
                                    </View>
                                )}

                                {/* Mark as Completed */}
                                {item.status === 'confirmed' && (

                                    <TouchableOpacity
                                        style={styles.completeBtn}
                                        onPress={() => {
                                            Alert.alert(
                                                'Mark as Completed?',
                                                `Service for ${item.customer?.username || 'customer'} is done?\n\nCustomer will be able to rate you.`,
                                                [
                                                    { text: 'Not yet', style: 'cancel' },
                                                    {
                                                        text: 'Yes, Completed ✓',
                                                        onPress: async () => {
                                                            try {
                                                                await updateBookingStatus(item._id, 'completed');
                                                                Alert.alert('✓ Done!', 'Booking marked as completed.');
                                                                loadData();
                                                            } catch (err) {
                                                                Alert.alert('Error', 'Could not mark as completed.');
                                                            }
                                                        }
                                                    },
                                                ]
                                            );
                                        }}
                                    >
                                        <Text style={styles.completeBtnText}>✓ Mark as Completed</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    })
                )}


            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
    greeting: { fontSize: 24, fontWeight: 'bold' },
    subGreeting: { fontSize: 16 },
    headerRight: { flexDirection: 'row', alignItems: 'center' },
    headerBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    badge: {
        position: 'absolute',
        top: -5,
        right: -5,
        backgroundColor: '#EF4444',
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 1.5,
        borderColor: '#FFF',
    },
    badgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '900',
    },
    profileContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#FFF',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    profileIcon: {
        width: '100%',
        height: '100%',
    },
    statsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
    statCard: { width: '48%', padding: 20, borderRadius: 15, alignItems: 'center' },
    statValue: { fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
    statLabel: { fontSize: 14, fontWeight: '500' },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
    actionRow: { flexDirection: 'row', marginBottom: 30 },
    actionPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20, marginRight: 10 },
    actionEmoji: { fontSize: 18, marginRight: 5 },
    actionText: { fontWeight: 'bold' },
    scheduleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },

    apptCard: { backgroundColor: '#FFF', borderRadius: 15, padding: 15, marginBottom: 4, elevation: 1 },
    serviceTypeBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 8 },
    apptMain: { flexDirection: 'row', alignItems: 'center' },
    startTime: { backgroundColor: '#F5F5F5', padding: 10, borderRadius: 10, alignItems: 'center', marginRight: 15, minWidth: 70 },
    timeText: { fontWeight: 'bold', fontSize: 14, color: '#333' },
    apptDetails: { flex: 1 },
    clientName: { fontSize: 16, fontWeight: 'bold' },
    serviceName: { fontSize: 12, color: '#666', marginTop: 2 },

    // ✅ Live location indicator
    liveIndicator: { backgroundColor: '#E8F5E9', borderRadius: 6, padding: 4, marginTop: 6, marginBottom: 4 },
    liveIndicatorText: { color: '#2E7D32', fontSize: 11, fontWeight: '600' },

    navigateBtn: { marginTop: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
    navigateBtnText: { fontWeight: 'bold', fontSize: 12 },
    addressText: { fontSize: 11, color: '#888', marginTop: 4 },

    // ── Accept / Decline button column
    actionBtnCol: { flexDirection: 'column', alignItems: 'center', gap: 6, marginLeft: 8 },

    acceptBtn: {
        backgroundColor: '#16A34A',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 7,
        alignItems: 'center',
        minWidth: 58,
    },
    acceptBtnText: { color: '#FFF', fontSize: 14, fontWeight: '900', lineHeight: 16 },
    acceptBtnLabel: { color: '#FFF', fontSize: 9, fontWeight: '700', marginTop: 1 },

    declineBtn: {
        backgroundColor: '#DC2626',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 7,
        alignItems: 'center',
        minWidth: 58,
    },
    declineBtnText: { color: '#FFF', fontSize: 14, fontWeight: '900', lineHeight: 16 },
    declineBtnLabel: { color: '#FFF', fontSize: 9, fontWeight: '700', marginTop: 1 },

    confirmedBadge: {
        backgroundColor: '#DCFCE7',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        alignItems: 'center',
        minWidth: 58,
    },
    confirmedBadgeText: { color: '#16A34A', fontSize: 14, fontWeight: '900' },
    confirmedBadgeLabel: { color: '#16A34A', fontSize: 9, fontWeight: '700', marginTop: 1 },

    completeBtn: { backgroundColor: '#1D4ED8', borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginBottom: 10 },
    completeBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
    emptySlot: { borderWidth: 1, borderColor: '#DDD', borderStyle: 'dashed', borderRadius: 15, padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
    emptyText: { color: '#888', fontSize: 14 },
    addBtn: { backgroundColor: '#E3F2FD', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    addBtnText: { color: '#1565C0', fontWeight: 'bold', fontSize: 12 },

    // ✅ On The Way button
    onTheWayBtn: {
        backgroundColor: '#F97316',
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: 'center',
        marginBottom: 8,
    },
    onTheWayBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },

    // ✅ Already on-the-way badge
    onTheWayActiveBadge: {
        backgroundColor: '#DCFCE7',
        borderRadius: 8,
        paddingVertical: 7,
        paddingHorizontal: 10,
        alignItems: 'center',
        marginBottom: 8,
    },
    onTheWayActiveText: { color: '#166534', fontWeight: '700', fontSize: 12 },

    // ── Profile incomplete banner
    profileBanner: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FFF7ED', borderWidth: 1.5, borderColor: '#F97316',
        borderRadius: 12, padding: 12, marginBottom: 20, gap: 10,
    },
    profileBannerIcon: { fontSize: 22 },
    profileBannerTitle: { fontSize: 14, fontWeight: '700', color: '#C2410C', marginBottom: 2 },
    profileBannerMsg: { fontSize: 12, color: '#9A3412' },

    // ── Premium Subscription Banner
    premiumBanner: {
        flexDirection: 'row', alignItems: 'center',
        padding: 16, borderRadius: 16, marginBottom: 24,
        elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2, shadowRadius: 4,
    },
    premiumIconContainer: {
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center', justifyContent: 'center',
    },
    premiumTitle: { color: '#FFF', fontSize: 16, fontWeight: '700', marginBottom: 2 },
    premiumMsg: { color: 'rgba(255,255,255,0.9)', fontSize: 12, lineHeight: 16 },
});

