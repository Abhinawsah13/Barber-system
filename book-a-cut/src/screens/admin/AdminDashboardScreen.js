import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from "../../context/ThemeContext";

const API_URL = 'http://192.168.1.79:3000/api/admin'; // Base URL

export default function AdminDashboardScreen({ navigation }) {
    const { theme } = useTheme();
    const [stats, setStats] = useState(null);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('stats'); // 'stats' | 'bookings'

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            // In a real app, we'd get the token from TokenManager
            // For now, let's assume the user is logged in as admin
            const response = await fetch(`${API_URL}/stats`);
            const data = await response.json();
            if (data.success) setStats(data.data);

            const bResponse = await fetch(`${API_URL}/bookings`);
            const bData = await bResponse.json();
            if (bData.success) setBookings(bData.data);

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefund = (bookingId) => {
        Alert.alert(
            "Confirm Refund",
            "Are you sure you want to manually refund this booking?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Refund",
                    onPress: async () => {
                        try {
                            const res = await fetch(`${API_URL}/refund`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ bookingId })
                            });
                            const result = await res.json();
                            if (result.success) {
                                Alert.alert("Success", "Refund processed!");
                                fetchStats();
                            } else {
                                Alert.alert("Error", result.message);
                            }
                        } catch (err) {
                            Alert.alert("Error", "Action failed");
                        }
                    }
                }
            ]
        );
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" /></View>;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.text }]}>Admin Panel</Text>
            </View>

            <View style={styles.tabs}>
                <TouchableOpacity onPress={() => setTab('stats')} style={[styles.tab, tab === 'stats' && styles.activeTab]}>
                    <Text style={{ color: tab === 'stats' ? theme.primary : theme.textMuted }}>Stats</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setTab('bookings')} style={[styles.tab, tab === 'bookings' && styles.activeTab]}>
                    <Text style={{ color: tab === 'bookings' ? theme.primary : theme.textMuted }}>Bookings</Text>
                </TouchableOpacity>
            </View>

            {tab === 'stats' ? (
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>Platform Earnings</Text>
                        <Text style={styles.cardValue}>${stats?.platform_earnings.toFixed(2)}</Text>
                    </View>
                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>Total Users</Text>
                        <Text style={styles.cardValue}>{stats?.users}</Text>
                    </View>
                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>Total Bookings</Text>
                        <Text style={styles.cardValue}>{stats?.bookings}</Text>
                    </View>
                </ScrollView>
            ) : (
                <FlatList
                    data={bookings}
                    keyExtractor={item => item._id}
                    renderItem={({ item }) => (
                        <View style={styles.bookingItem}>
                            <View>
                                <Text style={{ fontWeight: 'bold' }}>{item.service?.name}</Text>
                                <Text>Customer: {item.customer?.username}</Text>
                                <Text>Barber: {item.barber?.username}</Text>
                                <Text>Status: {item.status}</Text>
                                <Text>Payment: {item.payment_status}</Text>
                            </View>
                            {item.payment_status === 'paid' && (
                                <TouchableOpacity
                                    style={styles.refundBtn}
                                    onPress={() => handleRefund(item._id)}
                                >
                                    <Text style={{ color: '#FFF', fontSize: 12 }}>Refund</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#EEE' },
    title: { fontSize: 24, fontWeight: 'bold' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    tabs: { flexDirection: 'row', padding: 10 },
    tab: { flex: 1, padding: 10, alignItems: 'center' },
    activeTab: { borderBottomWidth: 2, borderBottomColor: '#B76E22' },
    content: { padding: 20 },
    card: { backgroundColor: '#FFF', padding: 20, borderRadius: 12, marginBottom: 15, elevation: 2 },
    cardLabel: { fontSize: 14, color: '#666' },
    cardValue: { fontSize: 28, fontWeight: 'bold', marginTop: 5 },
    bookingItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#EEE', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    refundBtn: { backgroundColor: '#FF5252', padding: 8, borderRadius: 5 }
});
