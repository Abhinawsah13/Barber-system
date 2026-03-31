// screens/admin/CommissionTransactionsScreen.js
import React, { useState, useEffect } from 'react';
import {
    View, Text, FlatList, TouchableOpacity,
    StyleSheet, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { API_URL } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

export default function CommissionTransactionsScreen({ navigation }) {
    const { theme } = useTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [transactions, setTransactions] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        fetchTransactions(1);
    }, []);

    const fetchTransactions = async (pageNum, isRefreshing = false) => {
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await fetch(`${API_URL}/admin/commission/transactions?page=${pageNum}&limit=20`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                if (isRefreshing || pageNum === 1) {
                    setTransactions(data.data);
                } else {
                    setTransactions(prev => [...prev, ...data.data]);
                }
                setHasMore(pageNum < data.pages);
                setPage(pageNum);
            }
        } catch (error) {
            console.error('Error fetching transactions:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchTransactions(1, true);
    };

    const onLoadMore = () => {
        if (!loading && hasMore) {
            fetchTransactions(page + 1);
        }
    };

    const formatCurrency = (amount) => {
        return `Rs ${Number(amount || 0).toFixed(2)}`;
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const renderTransactionItem = ({ item }) => (
        <View style={[styles.transactionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
                <View style={styles.barberInfo}>
                    <Text style={[styles.barberName, { color: theme.text }]}>
                        {item.barber?.username || 'Unknown Barber'}
                    </Text>
                    <Text style={[styles.serviceName, { color: theme.textSecondary }]}>
                        {item.booking?.service?.name || 'Service'} • {item.commission_rate}% commission
                    </Text>
                </View>
                <Text style={[styles.amount, { color: '#4CAF50' }]}>
                    +{formatCurrency(item.amount)}
                </Text>
            </View>
            <View style={styles.cardFooter}>
                <Text style={[styles.date, { color: theme.textLight || '#999' }]}>
                    {formatDate(item.createdAt)}
                </Text>
                <Text style={[styles.bookingId, { color: theme.textLight || '#999' }]}>
                    Ref: #{item.booking?._id?.toString().substring(0, 8)}
                </Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Platform Transactions</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading && page === 1 ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            ) : (
                <FlatList
                    data={transactions}
                    keyExtractor={item => item._id}
                    renderItem={renderTransactionItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />
                    }
                    onEndReached={onLoadMore}
                    onEndReachedThreshold={0.5}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No transactions found</Text>
                        </View>
                    }
                    ListFooterComponent={
                        hasMore ? <ActivityIndicator size="small" color={theme.primary} style={{ margin: 20 }} /> : null
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    listContent: { padding: 16 },
    transactionCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        elevation: 1,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    barberInfo: { flex: 1 },
    barberName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
    serviceName: { fontSize: 13 },
    amount: { fontSize: 16, fontWeight: '700' },
    cardFooter: { 
        flexDirection: 'row', 
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        paddingTop: 10
    },
    date: { fontSize: 12 },
    bookingId: { fontSize: 12 },
    emptyText: { fontSize: 16, textAlign: 'center' },
});
