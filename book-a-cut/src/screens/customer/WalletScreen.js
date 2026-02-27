import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    RefreshControl,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { THEME } from '../../theme/theme';
import { useTheme } from "../../context/ThemeContext";
import { getWallet, addMoneyToWallet } from '../../services/api';
import { formatDate } from '../../utils/dateUtils';

export default function WalletScreen({ navigation }) {
    const { theme } = useTheme();
    const [balance, setBalance] = useState(0.00);
    const [loyaltyPoints, setLoyaltyPoints] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchWalletData = async () => {
        try {
            const data = await getWallet();
            if (data) {
                setBalance(data.balance);
                setLoyaltyPoints(data.loyalty_points || 0);
                setTransactions(data.transactions || []);
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to load wallet information.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchWalletData();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchWalletData();
    };

    const handleAddMoney = () => {
        Alert.alert(
            "Add Money",
            "Select amount to top-up:",
            [
                { text: "Cancel", style: "cancel" },
                { text: "$10", onPress: () => processTopUp(10) },
                { text: "$50", onPress: () => processTopUp(50) },
                { text: "$100", onPress: () => processTopUp(100) },
            ]
        );
    };

    const processTopUp = async (amount) => {
        try {
            setLoading(true);
            await addMoneyToWallet(amount, 'Bank Card'); // Simulating card source
            Alert.alert("Success", `$${amount} added to your wallet!`);
            fetchWalletData();
        } catch (error) {
            Alert.alert("Error", "Transaction failed.");
        } finally {
            setLoading(false);
        }
    };


    if (loading && !refreshing && transactions.length === 0) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.card }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={[styles.backText, { color: theme.text }]}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>My Wallet</Text>
                <TouchableOpacity style={styles.iconBtn}>
                    <Text style={{ fontSize: 20, color: theme.text }}>⋮</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
            >

                {/* Balance Card */}
                <View style={[styles.balanceCard, { backgroundColor: theme.primary, shadowColor: theme.primary }]}>
                    <Text style={styles.balanceLabel}>Total Balance</Text>
                    <Text style={styles.balanceAmount}>${balance.toFixed(2)}</Text>
                    <View style={styles.balanceActions}>
                        <TouchableOpacity style={styles.actionBtn} onPress={handleAddMoney}>
                            <Text style={styles.actionIcon}>+</Text>
                            <Text style={styles.actionText}>Top Up</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => Alert.alert("Withdraw", "Withdrawal feature coming soon!")}>
                            <Text style={styles.actionIcon}>↗</Text>
                            <Text style={styles.actionText}>Withdraw</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Loyalty Rewards */}
                <View style={[styles.rewardsCard, { backgroundColor: '#333' }]}>
                    {/* Kept dark by default as its a special card, or could use theme.cardSecondary */}
                    <View>
                        <Text style={styles.rewardsTitle}>Loyalty Points</Text>
                        <Text style={styles.rewardsPoints}>{loyaltyPoints} pts</Text>
                        <Text style={styles.rewardsSub}>Get $5 off for every 500 pts</Text>
                    </View>
                    <View style={styles.crownIcon}>
                        <Text style={{ fontSize: 30 }}>👑</Text>
                    </View>
                </View>

                {/* Payment Methods */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Payment Methods</Text>
                    <TouchableOpacity onPress={() => Alert.alert("Manage Cards", "Feature to manage saved cards coming soon.")}>
                        <Text style={[styles.linkText, { color: theme.primary }]}>Manage</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={[styles.methodCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                    onPress={() => Alert.alert("Card Settings", "This is your default payment method.")}
                >
                    <View style={styles.methodRow}>
                        <Text style={{ fontSize: 24, marginRight: 15 }}>💳</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.methodTitle, { color: theme.text }]}>Saved Cards</Text>
                            <Text style={[styles.methodSubtitle, { color: theme.textMuted }]}>Click to manage cards</Text>
                        </View>
                        <Text style={{ color: theme.primary, fontWeight: 'bold' }}>Default</Text>
                    </View>
                </TouchableOpacity>

                {/* Transaction History */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Transactions</Text>
                </View>

                {transactions.length === 0 ? (
                    <View style={[styles.emptyState, { backgroundColor: theme.card }]}>
                        <Text style={{ fontSize: 40, marginBottom: 10 }}>💸</Text>
                        <Text style={[styles.emptyStateText, { color: theme.text }]}>No transactions yet</Text>
                        <Text style={[styles.emptyStateSubtext, { color: theme.textMuted }]}>Top up your wallet to get started!</Text>
                    </View>
                ) : (
                    transactions.map((tx) => (
                        <View key={tx._id} style={[styles.txItem, { backgroundColor: theme.card }]}>
                            <View style={[styles.txIcon, { backgroundColor: tx.type === 'credit' ? theme.success + '20' : theme.error + '20' }]}>
                                <Text style={{ color: tx.type === 'credit' ? theme.success : theme.error }}>{tx.type === 'credit' ? '↓' : '↑'}</Text>
                            </View>
                            <View style={styles.txInfo}>
                                <Text style={[styles.txTitle, { color: theme.text }]}>{tx.title}</Text>
                                <Text style={[styles.txDate, { color: theme.textMuted }]}>{formatDate(tx.created_at)}</Text>
                            </View>
                            <Text style={[styles.txAmount, { color: tx.type === 'credit' ? theme.success : theme.error }]}>
                                {tx.type === 'credit' ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                            </Text>
                        </View>
                    ))
                )}

            </ScrollView>
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
        padding: 20,
    },
    backBtn: {
        padding: 10,
        marginRight: 10,
    },
    backText: {
        fontSize: 32, // Larger arrow
        fontWeight: 'bold',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    scrollContent: {
        padding: 20,
    },
    balanceCard: {
        borderRadius: 20,
        padding: 25,
        alignItems: 'center',
        marginBottom: 30,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    balanceLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        marginBottom: 5,
    },
    balanceAmount: {
        color: '#FFF',
        fontSize: 36,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    balanceActions: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-around',
    },
    actionBtn: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: 'center',
        flexDirection: 'row',
    },
    actionIcon: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginRight: 8,
    },
    actionText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    rewardsCard: {
        borderRadius: 20,
        padding: 20,
        marginBottom: 30,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    rewardsTitle: {
        color: '#FFD700',
        fontSize: 14,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 5,
    },
    rewardsPoints: {
        color: '#FFF',
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    rewardsSub: {
        color: '#AAA',
        fontSize: 12,
    },
    crownIcon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255, 215, 0, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        marginTop: 10,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    linkText: {
        fontWeight: '600',
    },
    methodCard: {
        padding: 15,
        borderRadius: 16,
        marginBottom: 15,
        borderWidth: 1,
    },
    methodRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    methodTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    methodSubtitle: {
        fontSize: 12,
    },
    txItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderRadius: 16,
        marginBottom: 10,
    },
    txIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    txInfo: {
        flex: 1,
    },
    txTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    txDate: {
        fontSize: 12,
    },
    txAmount: {
        fontWeight: 'bold',
        fontSize: 15,
    },
    emptyState: {
        alignItems: 'center',
        padding: 30,
        borderRadius: 20,
        marginTop: 10,
    },
    emptyStateText: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    emptyStateSubtext: {
        fontSize: 12,
    },
});
