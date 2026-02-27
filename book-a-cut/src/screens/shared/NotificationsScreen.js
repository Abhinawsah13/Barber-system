import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { getNotifications, markNotificationAsRead } from '../../services/api';
import { formatDateTime } from '../../utils/dateUtils';
import { getUserData } from '../../services/TokenManager';

export default function NotificationsScreen({ navigation }) {
    const { theme } = useTheme();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const data = await getNotifications();
            setNotifications(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleNotificationClick = async (item) => {
        // Mark as read in background
        if (!item.is_read) {
            markNotificationAsRead(item._id);
            // Optimistic update
            setNotifications(prev => prev.map(n => n._id === item._id ? { ...n, is_read: true } : n));
        }

        // Navigate based on user role
        try {
            const userData = await getUserData();
            const bookingId = item.metadata?.bookingId;

            if (bookingId) {
                if (userData?.user_type === 'barber') {
                    // Barbers manage bookings on their home dashboard
                    navigation.navigate('BarberHome', { bookingId });
                } else {
                    // Customers view their bookings in MyBookings
                    navigation.navigate('MyBookings', { bookingId });
                }
            }
        } catch (error) {
            console.error('Error in notification click:', error);
        }
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity
            onPress={() => handleNotificationClick(item)}
            style={[
                styles.card,
                { backgroundColor: theme.card, shadowColor: theme.shadow },
                !item.is_read && { borderLeftWidth: 4, borderLeftColor: theme.primary, backgroundColor: theme.primary + '10' }
            ]}
        >
            <View style={[styles.iconBox, { backgroundColor: item.is_read ? theme.inputBg : theme.primary + '20' }]}>
                <Text style={{ fontSize: 20 }}>{item.type === 'wallet_status' ? '💰' : '🔔'}</Text>
            </View>
            <View style={styles.textContainer}>
                <Text style={[styles.title, { color: theme.text, fontWeight: item.is_read ? '500' : 'bold' }]}>{item.title}</Text>
                <Text style={[styles.message, { color: theme.textLight }]} numberOfLines={2}>{item.message}</Text>
                <Text style={[styles.time, { color: theme.textMuted }]}>{item.createdAt ? formatDateTime(item.createdAt) : ''}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={[styles.backText, { color: theme.text }]}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Notifications</Text>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            ) : notifications.length === 0 ? (
                <View style={styles.center}>
                    <View style={[styles.emptyIconBox, { backgroundColor: theme.inputBg }]}>
                        <Text style={{ fontSize: 40 }}>📭</Text>
                    </View>
                    <Text style={[styles.headerTitle, { color: theme.text, marginTop: 10 }]}>No notifications yet</Text>
                    <Text style={[styles.emptyText, { color: theme.textMuted, textAlign: 'center', paddingHorizontal: 40, marginTop: 5 }]}>
                        When you book a service or receive an update, it will appear here.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    renderItem={renderItem}
                    keyExtractor={item => item._id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                loadData();
                            }}
                            colors={[theme.primary]}
                        />
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
    backBtn: { marginRight: 20 },
    backText: { fontSize: 24, fontWeight: 'bold' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: 20 },
    card: {
        flexDirection: 'row',
        borderRadius: 12,
        padding: 15,
        marginBottom: 10,
        elevation: 2,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    emptyIconBox: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    textContainer: { flex: 1 },
    title: { fontSize: 16, marginBottom: 4 },
    message: { fontSize: 14, marginBottom: 6 },
    time: { fontSize: 12 },
    emptyText: { fontSize: 14 },
});
