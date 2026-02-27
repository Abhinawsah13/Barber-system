import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Linking, Alert } from "react-native";
import * as Location from 'expo-location';
import io from 'socket.io-client';

import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { SOCKET_BASE_URL } from '../../config/server';

import { getMyBookings, toggleBarberOnlineStatus, updateBookingStatus } from "../../services/api";

export default function BarberHomeScreen({ navigation, route }) {
    const { theme } = useTheme();
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({
        todayBookings: 0,
        pendingLabel: "0 Pending",
        totalEarnings: "$0.00"
    });
    const [schedule, setSchedule] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [myLat, setMyLat] = useState(null);
    const [myLng, setMyLng] = useState(null);
    const [isOnline, setIsOnline] = useState(false);

    // Socket URL comes from the central config — no hardcoded IPs here

    const loadData = async () => {
        try {
            const bookings = await getMyBookings();

            // simple logic for today's bookings
            const today = new Date().toISOString().split('T')[0];
            const todaysBookings = bookings.filter(b => b.date.startsWith(today) && b.status !== 'cancelled');

            // Calculate earnings (mock logic: assuming price is available or fixed)
            // Ideally backend sends aggregated stats, but we can sum simplistic prices here if available
            // Let's assume average $30 per completed booking for now if price isn't in booking object
            const completed = bookings.filter(b => b.status === 'completed');
            const earnings = completed.reduce((acc, curr) => acc + (curr.total_price || 30), 0);

            setStats({
                todayBookings: todaysBookings.length,
                pendingLabel: `${bookings.filter(b => b.status === 'pending').length} Pending`,
                totalEarnings: `$${earnings.toFixed(2)}`
            });

            // Sort by date/time ascending and take top 5 upcoming
            const upcoming = bookings
                .filter(b => b.status === 'pending' || b.status === 'confirmed')
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .slice(0, 5);

            setSchedule(upcoming);

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
        loadData();

        // Toggle online with location
        toggleOnlineStatus(true);

        const socket = io(SOCKET_BASE_URL);

        // 🔥 Real-time booking notifications
        socket.on('new-booking', (booking) => {
            Alert.alert(
                '🔔 New Booking!',
                `From ${booking.customer?.username || 'Customer'}\n${booking.service?.name || 'Service'} @ ${booking.time_slot}`,
                [
                    { text: 'View', onPress: () => loadData() },
                    { text: 'OK' }
                ]
            );
            loadData(); // Refresh list
        });

        return () => {
            socket.off('new-booking');
            socket.disconnect();
        };
    }, []);

    const toggleOnlineStatus = async (online) => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        let location = await Location.getCurrentPositionAsync({});
        setMyLat(location.coords.latitude);
        setMyLng(location.coords.longitude);
        setIsOnline(online);

        try {
            await toggleBarberOnlineStatus({
                isOnline: online,
                lat: location.coords.latitude,
                lng: location.coords.longitude,
                address: 'My Location', // Ideally reverse geocode this
                city: 'Kathmandu' // Static for now, or get from address
            });
        } catch (error) {
            console.error("Failed to toggle online status", error);
        }
    };

    const handleLogout = () => {
        // Clear token logic here
        navigation.reset({
            index: 0,
            routes: [{ name: "Login" }],
        });
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Helper to get AM/PM
    const getAmPm = (dateString) => {
        const date = new Date(dateString);
        return date.getHours() >= 12 ? 'PM' : 'AM';
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
            >
                {/* HeaderAndOtherContent... */}
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={[styles.greeting, { color: theme.text }]}>Hello, Barber!</Text>
                        <Text style={[styles.subGreeting, { color: theme.textLight }]}>Manage your shop</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('BarberSettings')}
                        style={[styles.settingsBtn, { backgroundColor: theme.card }]}
                    >
                        <Text style={{ fontSize: 20 }}>⚙️</Text>
                    </TouchableOpacity>
                </View>

                {/* Stats Row */}
                <View style={styles.statsContainer}>
                    <View style={[styles.statCard, { backgroundColor: '#E3F2FD' }]}>
                        <Text style={[styles.statValue, { color: '#1565C0' }]}>{stats.todayBookings}</Text>
                        <Text style={[styles.statLabel, { color: '#1565C0' }]}>Today's Clients</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: '#E8F5E9' }]}>
                        <Text style={[styles.statValue, { color: '#2E7D32' }]}>{stats.totalEarnings}</Text>
                        <Text style={[styles.statLabel, { color: '#2E7D32' }]}>Revenue</Text>
                    </View>
                </View>

                {/* Quick Actions */}
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Manage Shop</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.actionRow}>
                    <TouchableOpacity style={[styles.actionPill, { backgroundColor: theme.card }]} onPress={() => navigation.navigate('BarberProfile')}>
                        <Text style={styles.actionEmoji}>💈</Text>
                        <Text style={[styles.actionText, { color: theme.text }]}>Profile</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionPill, { backgroundColor: theme.card }]} onPress={() => navigation.navigate('BarberServices')}>
                        <Text style={styles.actionEmoji}>✂️</Text>
                        <Text style={[styles.actionText, { color: theme.text }]}>Services</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionPill, { backgroundColor: theme.card }]}>
                        <Text style={styles.actionEmoji}>💰</Text>
                        <Text style={[styles.actionText, { color: theme.text }]}>Finance</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionPill, { backgroundColor: theme.card }]}>
                        <Text style={styles.actionEmoji}>⚙️</Text>
                        <Text style={[styles.actionText, { color: theme.text }]}>Settings</Text>
                    </TouchableOpacity>
                </ScrollView>

                {/* Upcoming Schedule Preview */}
                <View style={styles.scheduleHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Upcoming Schedule</Text>
                    <TouchableOpacity><Text style={[styles.seeAll, { color: theme.primary }]}>View Calendar</Text></TouchableOpacity>
                </View>

                {schedule.length === 0 ? (
                    <View style={styles.emptySlot}>
                        <Text style={styles.emptyText}>No upcoming appointments.</Text>
                    </View>
                ) : (
                    schedule.map((item) => {
                        const isHighlighted = item._id === route.params?.bookingId;
                        return (
                            <View key={item._id} style={[
                                styles.apptCard,
                                { backgroundColor: theme.card },
                                isHighlighted && { borderColor: theme.primary, borderWidth: 2, backgroundColor: theme.primary + '05' }
                            ]}>
                                <View style={styles.startTime}>
                                    <Text style={styles.timeText}>{formatTime(item.date).replace(/ AM| PM/g, '')}</Text>
                                    <Text style={styles.ampm}>{getAmPm(item.date)}</Text>
                                </View>
                                <View style={styles.apptDetails}>
                                    <Text style={[styles.clientName, { color: theme.text }]}>{item.customer?.username || "Client"}</Text>
                                    <Text style={[styles.serviceName, { color: theme.textLight }]}>{item.service?.name || "Service"} • 45m</Text>
                                    {item.service_type === 'home' && item.customer_address && (
                                        <TouchableOpacity onPress={() => {
                                            const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.customer_address)}`;
                                            Linking.openURL(url);
                                        }} style={{ marginTop: 5 }}>
                                            <Text style={{ color: '#2196F3', fontWeight: 'bold' }}>🗺️ Navigate</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                                <TouchableOpacity
                                    style={[styles.checkBtn, { backgroundColor: item.status === 'confirmed' ? '#4CAF50' : '#FF9800' }]}
                                    onPress={async () => {
                                        if (item.status === 'pending') {
                                            try {
                                                // Use the shared API service — no hardcoded URLs
                                                await updateBookingStatus(item._id, 'confirmed');
                                                Alert.alert('Success', 'Booking confirmed!');
                                                loadData();
                                            } catch (error) {
                                                Alert.alert('Error', 'Failed to confirm booking');
                                            }
                                        }
                                    }}
                                >
                                    <Text style={{ color: '#FFF' }}>{item.status === 'confirmed' ? '✓' : 'Accept'}</Text>
                                </TouchableOpacity>
                            </View>
                        );
                    })
                )}

                <View style={styles.emptySlot}>
                    <Text style={styles.emptyText}>Tap + to add a walk-in</Text>
                    <TouchableOpacity style={styles.addBtn}>
                        <Text style={styles.addBtnText}>+ Book</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
    },
    greeting: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    subGreeting: {
        fontSize: 16,
    },
    logoutBtn: {
        padding: 8,
    },
    settingsBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
    },
    statCard: {
        width: '48%',
        padding: 20,
        borderRadius: 15,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    statLabel: {
        fontSize: 14,
        fontWeight: '500',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    actionRow: {
        flexDirection: 'row',
        marginBottom: 30,
    },
    actionPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 20,
        marginRight: 10,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    actionEmoji: {
        fontSize: 18,
        marginRight: 5,
    },
    actionText: {
        fontWeight: 'bold',
        color: '#333',
    },
    scheduleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    seeAll: {
        // color: THEME.primary, // Moved to inline for dynamic theme
        fontWeight: '600',
    },
    apptCard: {
        backgroundColor: '#FFF',
        borderRadius: 15,
        padding: 15,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 1,
    },
    startTime: {
        backgroundColor: '#F5F5F5',
        padding: 10,
        borderRadius: 10,
        alignItems: 'center',
        marginRight: 15,
        minWidth: 60,
    },
    timeText: {
        fontWeight: 'bold',
        fontSize: 16,
        color: '#333',
    },
    ampm: {
        fontSize: 10,
        color: '#666',
        fontWeight: 'bold',
    },
    apptDetails: {
        flex: 1,
    },
    clientName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    serviceName: {
        fontSize: 12,
        color: '#666',
    },
    checkBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#4CAF50',
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptySlot: {
        borderWidth: 1,
        borderColor: '#DDD',
        borderStyle: 'dashed',
        borderRadius: 15,
        padding: 15,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 5,
    },
    emptyText: {
        color: '#888',
        fontSize: 14,
    },
    addBtn: {
        backgroundColor: '#E3F2FD',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    addBtnText: {
        color: '#1565C0',
        fontWeight: 'bold',
        fontSize: 12,
    },
});
