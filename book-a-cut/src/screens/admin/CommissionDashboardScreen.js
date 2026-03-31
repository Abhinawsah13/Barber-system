// screens/admin/CommissionDashboardScreen.js
import React, { useState, useEffect } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    StyleSheet, ActivityIndicator, RefreshControl, TextInput, Button, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { API_URL, getAdminSettings, updateAdminSettings } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken } from '../../services/TokenManager';
import { Ionicons } from '@expo/vector-icons';

export default function CommissionDashboardScreen({ navigation }) {
    const { theme } = useTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [overview, setOverview] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [projections, setProjections] = useState(null);
    const [settings, setSettings] = useState(null);
    const [basicRate, setBasicRate] = useState('');
    const [premiumRate, setPremiumRate] = useState('');
    const [refund2h, setRefund2h] = useState('');
    const [refund1h2h, setRefund1h2h] = useState('');
    const [refundLess1h, setRefundLess1h] = useState('');
    const [refundOnWay, setRefundOnWay] = useState('');
    const [savingSettings, setSavingSettings] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const token = await getToken();

            // Fetch overview
            const overviewRes = await fetch(`${API_URL}/admin/commission/overview`, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'bypass-tunnel-reminder': 'true'
                }
            });
            const overviewData = await overviewRes.json();
            if (!overviewData.success) {
                console.error("[Overview Error]", overviewData.message);
                Alert.alert("Dashboard Error", overviewData.message || "Failed to load overview");
            } else {
                setOverview(overviewData.data);
            }

            // Fetch recent transactions
            const txRes = await fetch(`${API_URL}/admin/commission/transactions?limit=10`, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'bypass-tunnel-reminder': 'true'
                }
            });
            const txData = await txRes.json();
            if (txData.success) setTransactions(txData.data);

            // Fetch projections
            const projRes = await fetch(`${API_URL}/admin/commission/projections`, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'bypass-tunnel-reminder': 'true'
                }
            });
            const projData = await projRes.json();
            if (projData.success) setProjections(projData.data);

            const settingsData = await getAdminSettings();
            if (settingsData.success) {
                setSettings(settingsData.settings);
                setBasicRate(settingsData.settings.basic_commission.toString());
                setPremiumRate(settingsData.settings.premium_commission.toString());
                setRefund2h((settingsData.settings.refund_2h_more ?? 100).toString());
                setRefund1h2h((settingsData.settings.refund_1h_to_2h ?? 70).toString());
                setRefundLess1h((settingsData.settings.refund_less_than_1h ?? 50).toString());
                setRefundOnWay((settingsData.settings.refund_barber_on_way ?? 30).toString());
            }
        } catch (error) {
            console.error('Error fetching commission data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleSaveSettings = async () => {
        try {
            setSavingSettings(true);
            const res = await updateAdminSettings({
                basic_commission: Number(basicRate),
                premium_commission: Number(premiumRate),
                refund_2h_more: Number(refund2h),
                refund_1h_to_2h: Number(refund1h2h),
                refund_less_than_1h: Number(refundLess1h),
                refund_barber_on_way: Number(refundOnWay)
            });
            if (res.success) {
                Alert.alert('Success', 'Commission rates updated globally!');
                fetchData();
            }
        } catch (error) {
            Alert.alert('Error', error.message || 'Failed to update settings');
        } finally {
            setSavingSettings(false);
        }
    };

    const formatCurrency = (amount) => {
        return `Rs ${Number(amount || 0).toFixed(2)}`;
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Commission Dashboard</Text>
                    <TouchableOpacity onPress={onRefresh}>
                        <Ionicons name="refresh" size={24} color={theme.primary} />
                    </TouchableOpacity>
                </View>

                {/* Revenue Overview */}
                <View style={[styles.overviewCard, { backgroundColor: theme.primary }]}>
                    <Text style={styles.overviewTitle}>💰 Total Platform Revenue</Text>
                    <Text style={styles.overviewAmount}>
                        {formatCurrency(overview?.total_revenue || 0)}
                    </Text>
                    <View style={styles.overviewBreakdown}>
                        <View style={styles.breakdownItem}>
                            <Text style={styles.breakdownLabel}>Commissions</Text>
                            <Text style={styles.breakdownValue}>
                                {formatCurrency(overview?.total_platform_earnings || 0)}
                            </Text>
                        </View>
                        <View style={styles.breakdownItem}>
                            <Text style={styles.breakdownLabel}>Subscriptions</Text>
                            <Text style={styles.breakdownValue}>
                                {formatCurrency(overview?.subscription_revenue || 0)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Booking Volume Overview */}
                <View style={[styles.volumeCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <View style={styles.volumeRow}>
                        <View style={styles.volumeItem}>
                            <Text style={[styles.volumeLabel, { color: theme.textSecondary }]}>Gross Booking Volume</Text>
                            <Text style={[styles.volumeValue, { color: theme.text }]}>
                                {formatCurrency(overview?.total_booking_volume || 0)}
                            </Text>
                        </View>
                        <View style={styles.volumeItem}>
                            <Text style={[styles.volumeLabel, { color: theme.textSecondary }]}>Net for Barbers</Text>
                            <Text style={[styles.volumeValue, { color: '#2E7D32' }]}>
                                {formatCurrency(overview?.total_barber_payouts || 0)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Today & Monthly Stats */}
                <View style={styles.statsRow}>
                    <View style={[styles.statCard, { backgroundColor: theme.card }]}>
                        <Ionicons name="today" size={28} color="#4CAF50" />
                        <Text style={[styles.statValue, { color: theme.text }]}>
                            {formatCurrency(overview?.today_earnings || 0)}
                        </Text>
                        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Today</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: theme.card }]}>
                        <Ionicons name="calendar" size={28} color="#2196F3" />
                        <Text style={[styles.statValue, { color: theme.text }]}>
                            {formatCurrency(overview?.monthly_earnings || 0)}
                        </Text>
                        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>This Month</Text>
                    </View>
                </View>

                {/* Commission Rate Breakdown */}
                {overview?.commission_by_rate && overview.commission_by_rate.length > 0 && (
                    <View style={[styles.section, { backgroundColor: theme.card }]}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>📊 Commission by Rate</Text>
                        {overview.commission_by_rate.map((item, index) => (
                            <View key={index} style={styles.rateRow}>
                                <View style={styles.rateInfo}>
                                    <Text style={[styles.rateLabel, { color: theme.text }]}>
                                        {item._id}% Rate
                                    </Text>
                                    <Text style={[styles.rateCount, { color: theme.textSecondary }]}>
                                        {item.count} bookings
                                    </Text>
                                </View>
                                <Text style={[styles.rateAmount, { color: theme.primary }]}>
                                    {formatCurrency(item.total)}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Subscription Stats */}
                <View style={[styles.section, { backgroundColor: theme.card }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>⭐ Subscription Stats</Text>
                    <View style={styles.subscriptionStatsRow}>
                        <View style={styles.subscriptionStatBox}>
                            <Text style={[styles.subscriptionStatValue, { color: theme.primary }]}>
                                {overview?.active_premium_subscribers || 0}
                            </Text>
                            <Text style={[styles.subscriptionStatLabel, { color: theme.textSecondary }]}>
                                Premium Barbers
                            </Text>
                        </View>
                        <View style={styles.subscriptionStatBox}>
                            <Text style={[styles.subscriptionStatValue, { color: theme.primary }]}>
                                {formatCurrency(overview?.subscription_revenue || 0)}
                            </Text>
                            <Text style={[styles.subscriptionStatLabel, { color: theme.textSecondary }]}>
                                Sub Revenue
                            </Text>
                        </View>
                    </View>
                </View>

                {/* ADMIN CONFIGURATION PANEL */}
                {settings && (
                    <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.primary, borderWidth: 1 }]}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>⚙️ System Configuration</Text>
                        </View>
                        <Text style={{color: theme.textSecondary, marginBottom: 15, fontSize: 13}}>
                            Update global platform settings. Rates & refund policies apply to all future bookings.
                        </Text>
                        
                        {/* Commission Rates */}
                        <Text style={{color: theme.primary, marginBottom: 10, fontWeight: 'bold', fontSize: 14}}>Commission Rates (%)</Text>
                        <View style={{flexDirection: 'row', gap: 15, marginBottom: 20}}>
                            <View style={{flex: 1}}>
                                <Text style={{color: theme.text, marginBottom: 5, fontSize: 12}}>Basic Rate</Text>
                                <TextInput 
                                    style={[styles.input, {color: theme.text, borderColor: theme.border}]}
                                    value={basicRate}
                                    onChangeText={setBasicRate}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={{flex: 1}}>
                                <Text style={{color: theme.text, marginBottom: 5, fontSize: 12}}>Premium Rate</Text>
                                <TextInput 
                                    style={[styles.input, {color: theme.text, borderColor: theme.border}]}
                                    value={premiumRate}
                                    onChangeText={setPremiumRate}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        {/* Refund Policies */}
                        <Text style={{color: theme.primary, marginBottom: 10, fontWeight: 'bold', fontSize: 14}}>Refund Policy (%)</Text>
                        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginBottom: 20}}>
                            <View style={{width: '45%'}}>
                                <Text style={{color: theme.text, marginBottom: 5, fontSize: 12}}>2h+ Early</Text>
                                <TextInput 
                                    style={[styles.input, {color: theme.text, borderColor: theme.border}]}
                                    value={refund2h}
                                    onChangeText={setRefund2h}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={{width: '45%'}}>
                                <Text style={{color: theme.text, marginBottom: 5, fontSize: 12}}>1-2h Early</Text>
                                <TextInput 
                                    style={[styles.input, {color: theme.text, borderColor: theme.border}]}
                                    value={refund1h2h}
                                    onChangeText={setRefund1h2h}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={{width: '45%'}}>
                                <Text style={{color: theme.text, marginBottom: 5, fontSize: 12}}> Late (&lt;1h)</Text>
                                <TextInput 
                                    style={[styles.input, {color: theme.text, borderColor: theme.border}]}
                                    value={refundLess1h}
                                    onChangeText={setRefundLess1h}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={{width: '45%'}}>
                                <Text style={{color: theme.text, marginBottom: 5, fontSize: 12}}>On The Way</Text>
                                <TextInput 
                                    style={[styles.input, {color: theme.text, borderColor: theme.border}]}
                                    value={refundOnWay}
                                    onChangeText={setRefundOnWay}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <TouchableOpacity 
                            style={[styles.saveBtn, {backgroundColor: theme.primary}]}
                            onPress={handleSaveSettings}
                            disabled={savingSettings}
                        >
                            {savingSettings ? <ActivityIndicator size="small" color="#fff"/> : <Text style={{color: '#fff', fontWeight: 'bold', textAlign: 'center'}}>Save All Settings</Text>}
                        </TouchableOpacity>
                    </View>
                )}

                {/* Projections */}
                {projections && (
                    <View style={[styles.section, { backgroundColor: theme.card }]}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>🔮 Revenue Projections</Text>
                        <View style={styles.projectionRow}>
                            <View style={styles.projectionItem}>
                                <Text style={[styles.projectionLabel, { color: theme.textSecondary }]}>
                                    Avg Daily
                                </Text>
                                <Text style={[styles.projectionValue, { color: theme.text }]}>
                                    {formatCurrency(projections.last_30_days?.avg_daily_revenue || 0)}
                                </Text>
                            </View>
                            <View style={styles.projectionItem}>
                                <Text style={[styles.projectionLabel, { color: theme.textSecondary }]}>
                                    Projected Monthly
                                </Text>
                                <Text style={[styles.projectionValue, { color: theme.text }]}>
                                    {formatCurrency(projections.projections?.projected_monthly || 0)}
                                </Text>
                            </View>
                            <View style={styles.projectionItem}>
                                <Text style={[styles.projectionLabel, { color: theme.textSecondary }]}>
                                    Projected Yearly
                                </Text>
                                <Text style={[styles.projectionValue, { color: theme.text }]}>
                                    {formatCurrency(projections.projections?.projected_yearly || 0)}
                                </Text>
                            </View>
                        </View>

                        {/* Insight */}
                        {projections.insights?.message && (
                            <View style={[styles.insightBox, { backgroundColor: theme.background }]}>
                                <Ionicons name="bulb" size={20} color="#FFC107" />
                                <Text style={[styles.insightText, { color: theme.textSecondary }]}>
                                    {projections.insights.message}
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Top Earning Barbers */}
                {overview?.top_earning_barbers && overview.top_earning_barbers.length > 0 && (
                    <View style={[styles.section, { backgroundColor: theme.card }]}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>🏆 Top Earning Barbers</Text>
                        {overview.top_earning_barbers.slice(0, 5).map((barber, index) => (
                            <TouchableOpacity
                                key={barber.barberId}
                                style={styles.barberRow}
                                onPress={() => navigation.navigate('BarberCommissionDetails', { barberId: barber.barberId })}
                            >
                                <View style={styles.barberRank}>
                                    <Text style={[styles.barberRankText, { color: theme.primary }]}>
                                        #{index + 1}
                                    </Text>
                                </View>
                                <View style={styles.barberInfo}>
                                    <Text style={[styles.barberName, { color: theme.text }]}>
                                        {barber.barberName}
                                    </Text>
                                    <Text style={[styles.barberCount, { color: theme.textSecondary }]}>
                                        {barber.bookingCount} bookings
                                    </Text>
                                </View>
                                <Text style={[styles.barberAmount, { color: theme.primary }]}>
                                    {formatCurrency(barber.totalCommission)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Recent Transactions */}
                <View style={[styles.section, { backgroundColor: theme.card }]}>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>📝 Recent Transactions</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('AllTransactions')}>
                            <Text style={[styles.viewAllText, { color: theme.primary }]}>View All</Text>
                        </TouchableOpacity>
                    </View>
                    {transactions.length === 0 ? (
                        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                            No transactions yet
                        </Text>
                    ) : (
                        transactions.map((tx) => (
                            <View key={tx._id} style={styles.transactionRow}>
                                <View style={styles.transactionInfo}>
                                    <Text style={[styles.transactionBarber, { color: theme.text }]}>
                                        {tx.barber?.username || 'Unknown Barber'}
                                    </Text>
                                    <Text style={[styles.transactionDate, { color: theme.textSecondary }]}>
                                        {formatDate(tx.createdAt)} • {tx.commission_rate}% commission
                                    </Text>
                                </View>
                                <Text style={[styles.transactionAmount, { color: '#4CAF50' }]}>
                                    +{formatCurrency(tx.amount)}
                                </Text>
                            </View>
                        ))
                    )}
                </View>

                {/* Barber Stats Summary */}
                {projections?.barber_stats && (
                    <View style={[styles.section, { backgroundColor: theme.card }]}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>👥 Barber Breakdown</Text>
                        <View style={styles.barberStatsGrid}>
                            <View style={styles.barberStatBox}>
                                <Text style={[styles.barberStatValue, { color: theme.text }]}>
                                    {projections.barber_stats.total_active_barbers}
                                </Text>
                                <Text style={[styles.barberStatLabel, { color: theme.textSecondary }]}>
                                    Total Barbers
                                </Text>
                            </View>
                            <View style={styles.barberStatBox}>
                                <Text style={[styles.barberStatValue, { color: '#5C2D91' }]}>
                                    {projections.barber_stats.premium_barbers}
                                </Text>
                                <Text style={[styles.barberStatLabel, { color: theme.textSecondary }]}>
                                    Premium
                                </Text>
                            </View>
                            <View style={styles.barberStatBox}>
                                <Text style={[styles.barberStatValue, { color: theme.text }]}>
                                    {projections.barber_stats.basic_barbers}
                                </Text>
                                <Text style={[styles.barberStatLabel, { color: theme.textSecondary }]}>
                                    Basic
                                </Text>
                            </View>
                            <View style={styles.barberStatBox}>
                                <Text style={[styles.barberStatValue, { color: theme.primary }]}>
                                    {projections.barber_stats.premium_conversion_rate}
                                </Text>
                                <Text style={[styles.barberStatLabel, { color: theme.textSecondary }]}>
                                    Premium %
                                </Text>
                            </View>
                        </View>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 16 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    headerTitle: { fontSize: 20, fontWeight: '700' },

    overviewCard: {
        borderRadius: 16,
        padding: 24,
        marginBottom: 16,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    overviewTitle: { fontSize: 14, color: '#FFF', opacity: 0.9, marginBottom: 8 },
    overviewAmount: { fontSize: 36, fontWeight: '700', color: '#FFF', marginBottom: 16 },
    overviewBreakdown: { flexDirection: 'row', justifyContent: 'space-around' },
    breakdownItem: { alignItems: 'center' },
    breakdownLabel: { fontSize: 12, color: '#FFF', opacity: 0.8, marginBottom: 4 },
    breakdownValue: { fontSize: 18, fontWeight: '700', color: '#FFF' },
    
    volumeCard: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        elevation: 1,
    },
    volumeRow: { flexDirection: 'row', justifyContent: 'space-between' },
    volumeItem: { flex: 1, alignItems: 'center' },
    volumeLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
    volumeValue: { fontSize: 18, fontWeight: '700' },

    statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    statCard: {
        flex: 1,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        elevation: 2,
    },
    statValue: { fontSize: 18, fontWeight: '700', marginTop: 8 },
    statLabel: { fontSize: 12, marginTop: 4 },

    section: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        elevation: 2,
    },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
    viewAllText: { fontSize: 14, fontWeight: '600' },

    rateRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    rateInfo: { flex: 1 },
    rateLabel: { fontSize: 15, fontWeight: '600' },
    rateCount: { fontSize: 13, marginTop: 2 },
    rateAmount: { fontSize: 16, fontWeight: '700' },

    subscriptionStatsRow: { flexDirection: 'row', gap: 12 },
    subscriptionStatBox: { flex: 1, alignItems: 'center', paddingVertical: 12 },
    subscriptionStatValue: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
    subscriptionStatLabel: { fontSize: 12, textAlign: 'center' },

    projectionRow: { marginBottom: 12 },
    projectionItem: { marginBottom: 12 },
    projectionLabel: { fontSize: 13, marginBottom: 4 },
    projectionValue: { fontSize: 18, fontWeight: '700' },

    insightBox: {
        flexDirection: 'row',
        padding: 12,
        borderRadius: 8,
        marginTop: 8,
    },
    insightText: { flex: 1, fontSize: 13, marginLeft: 8, lineHeight: 18 },

    barberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    barberRank: { width: 40, alignItems: 'center' },
    barberRankText: { fontSize: 16, fontWeight: '700' },
    barberInfo: { flex: 1, marginLeft: 12 },
    barberName: { fontSize: 15, fontWeight: '600' },
    barberCount: { fontSize: 13, marginTop: 2 },
    barberAmount: { fontSize: 16, fontWeight: '700' },

    transactionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    transactionInfo: { flex: 1 },
    transactionBarber: { fontSize: 15, fontWeight: '600' },
    transactionDate: { fontSize: 13, marginTop: 2 },
    transactionAmount: { fontSize: 16, fontWeight: '700' },

    emptyText: { fontSize: 14, textAlign: 'center', paddingVertical: 20 },

    barberStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    barberStatBox: { flex: 1, minWidth: '45%', alignItems: 'center', paddingVertical: 12 },
    barberStatValue: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
    barberStatLabel: { fontSize: 12, textAlign: 'center' },
    
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        fontSize: 16,
    },
    saveBtn: {
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 5,
    }
});
