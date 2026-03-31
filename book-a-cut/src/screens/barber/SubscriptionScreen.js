// screens/barber/SubscriptionScreen.js
import React, { useState, useEffect } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    StyleSheet, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageProvider';
import { getSubscriptionPlans, getMySubscription, subscribeToPlan, renewPlan, cancelSubscription as cancelSubscriptionAPI } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

export default function SubscriptionScreen({ navigation }) {
    const { theme } = useTheme();
    const { t } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [plans, setPlans] = useState(null);
    const [currentSubscription, setCurrentSubscription] = useState(null);
    const [planDetails, setPlanDetails] = useState(null);
    const [daysRemaining, setDaysRemaining] = useState(0);
    const [subscribing, setSubscribing] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // Fetch available plans
            const plansData = await getSubscriptionPlans();
            if (plansData.success) setPlans(plansData.plans);

            // Fetch my current subscription
            const subData = await getMySubscription();
            if (subData.success) {
                setCurrentSubscription(subData.subscription);
                setPlanDetails(subData.planDetails);
                setDaysRemaining(subData.daysRemaining || 0);
            }
        } catch (error) {
            console.error('Error fetching subscription data:', error);
            Alert.alert('Error', 'Failed to load subscription data');
        } finally {
            setLoading(false);
        }
    };

    const handleSubscribe = async (plan) => {
        if (plan === 'basic') {
            Alert.alert(t('already_on_basic'), t('already_on_basic_desc') || 'Basic plan is active.');
            return;
        }

        Alert.alert(
            t('upgrade_premium_confirm'),
            t('upgrade_premium_desc'),
            [
                { text: t('cancel'), style: 'cancel' },
                { text: t('upgrade_plan'), onPress: () => subscribe(plan) }
            ]
        );
    };

    const subscribe = async (plan) => {
        setSubscribing(true);
        try {
            const data = await subscribeToPlan(plan);
            Alert.alert('🎉 Success!', data.message);
            fetchData(); // Refresh
        } catch (error) {
            console.error('Error subscribing:', error);
            Alert.alert('Error', error.message || 'Something went wrong');
        } finally {
            setSubscribing(false);
        }
    };

    const handleRenew = async () => {
        Alert.alert(
            t('renew_subscription'),
            `${t('renew_subscription')} ${planDetails?.name} Rs ${planDetails?.price}?`,
            [
                { text: t('cancel'), style: 'cancel' },
                { text: t('renew'), onPress: renew }
            ]
        );
    };

    const renew = async () => {
        setSubscribing(true);
        try {
            const data = await renewPlan();
            Alert.alert('🎉 Renewed!', data.message);
            fetchData();
        } catch (error) {
            Alert.alert('Error', error.message || 'Something went wrong');
        } finally {
            setSubscribing(false);
        }
    };

    const handleCancel = async () => {
        Alert.alert(
            t('cancel_premium'),
            t('cancel_premium_desc'),
            [
                { text: t('no'), style: 'cancel' },
                { text: `${t('yes')}, ${t('cancel')}`, style: 'destructive', onPress: cancelSubscription }
            ]
        );
    };

    const cancelSubscription = async () => {
        setSubscribing(true);
        try {
            const data = await cancelSubscriptionAPI();
            Alert.alert('Cancelled', data.message);
            fetchData();
        } catch (error) {
            Alert.alert('Error', error.message || 'Something went wrong');
        } finally {
            setSubscribing(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    const isPremium = currentSubscription?.plan === 'premium' && currentSubscription?.status === 'active';

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>{t('subscription_plans')}</Text>
                    <View style={{ width: 24 }} />
                </View>

                {/* Current Plan Card */}
                {currentSubscription && (
                    <View style={[styles.currentPlanCard, { backgroundColor: isPremium ? '#5C2D91' : theme.card }]}>
                        <Text style={[styles.currentPlanBadge, { color: '#FFF' }]}>
                            {isPremium ? `⭐ ${t('premium').toUpperCase()}` : `🆓 ${t('basic').toUpperCase()}`}
                        </Text>
                        <Text style={[styles.currentPlanTitle, { color: '#FFF' }]}>
                            {planDetails?.name || t('active_plan')}
                        </Text>
                        <Text style={[styles.currentPlanDescription, { color: '#E0E0E0' }]}>
                            {planDetails?.description || ''}
                        </Text>
                        
                        <View style={styles.statsRow}>
                            <View style={styles.statBox}>
                                <Text style={styles.statValue}>{currentSubscription.commission_rate}%</Text>
                                <Text style={styles.statLabel}>{t('commission')}</Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={styles.statValue}>{daysRemaining}</Text>
                                <Text style={styles.statLabel}>{t('days_left')}</Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={styles.statValue}>
                                    {currentSubscription.features?.max_services === -1 
                                        ? '∞' 
                                        : currentSubscription.features?.max_services || 10}
                                </Text>
                                <Text style={styles.statLabel}>{t('services_limit')}</Text>
                            </View>
                        </View>

                        {isPremium && (
                            <View style={styles.renewButtonsRow}>
                                <TouchableOpacity 
                                    style={[styles.renewButton, { backgroundColor: '#FFF' }]}
                                    onPress={handleRenew}
                                    disabled={subscribing}
                                >
                                    <Text style={[styles.renewButtonText, { color: '#5C2D91' }]}>
                                        {subscribing ? t('processing') : t('renew')}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.cancelButton, { borderColor: '#FFF' }]}
                                    onPress={handleCancel}
                                    disabled={subscribing}
                                >
                                    <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}

                {/* Available Plans */}
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    {isPremium ? t('other_plans') : t('upgrade_plan')}
                </Text>

                {plans && Object.entries(plans).map(([key, plan]) => (
                    <View 
                        key={key} 
                        style={[
                            styles.planCard, 
                            { 
                                backgroundColor: theme.card,
                                borderColor: key === 'premium' ? '#5C2D91' : theme.border,
                                borderWidth: key === 'premium' ? 2 : 1
                            }
                        ]}
                    >
                        <View style={styles.planHeader}>
                            <Text style={[styles.planBadge, { color: theme.text }]}>{plan.badge} {key === 'premium' ? t('premium') : t('basic')}</Text>
                            <Text style={[styles.planPrice, { color: theme.primary }]}>
                                {plan.price === 0 ? t('free') : `Rs ${plan.price}/mo`}
                            </Text>
                        </View>

                        <Text style={[styles.planDescription, { color: theme.textSecondary }]}>
                            {plan.description}
                        </Text>

                        {/* Features */}
                        <View style={styles.featuresContainer}>
                            <View style={styles.featureRow}>
                                <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                                <Text style={[styles.featureText, { color: theme.text }]}>
                                    {plan.commission_rate}% {t('commission_rate_label')}
                                </Text>
                            </View>
                            <View style={styles.featureRow}>
                                <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                                <Text style={[styles.featureText, { color: theme.text }]}>
                                    {plan.features.max_services === -1 ? t('unlimited') : plan.features.max_services} {t('services_limit')}
                                </Text>
                            </View>
                            {plan.features.priority_listing && (
                                <View style={styles.featureRow}>
                                    <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                                    <Text style={[styles.featureText, { color: theme.text }]}>
                                        {t('priority_listing')}
                                    </Text>
                                </View>
                            )}
                            {plan.features.analytics_access && (
                                <View style={styles.featureRow}>
                                    <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                                    <Text style={[styles.featureText, { color: theme.text }]}>
                                        {t('advanced_analytics')}
                                    </Text>
                                </View>
                            )}
                            {plan.features.promotional_boost && (
                                <View style={styles.featureRow}>
                                    <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                                    <Text style={[styles.featureText, { color: theme.text }]}>
                                        {t('promotional_badges')}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Subscribe Button */}
                        {currentSubscription?.plan !== key && (
                            <TouchableOpacity
                                style={[
                                    styles.subscribeButton,
                                    { 
                                        backgroundColor: key === 'premium' ? '#5C2D91' : theme.primary,
                                        opacity: subscribing ? 0.6 : 1
                                    }
                                ]}
                                onPress={() => handleSubscribe(key)}
                                disabled={subscribing}
                            >
                                <Text style={styles.subscribeButtonText}>
                                    {subscribing ? t('processing') : key === 'premium' ? t('upgrade_premium') || 'Upgrade to Premium' : t('switch_to_basic')}
                                </Text>
                            </TouchableOpacity>
                        )}

                        {currentSubscription?.plan === key && (
                            <View style={[styles.activeBadge, { backgroundColor: '#4CAF50' }]}>
                                <Text style={styles.activeBadgeText}>✓ {t('active_plan')}</Text>
                            </View>
                        )}
                    </View>
                ))}

                {/* Info Box */}
                <View style={[styles.infoBox, { backgroundColor: theme.card }]}>
                    <Ionicons name="information-circle" size={24} color={theme.primary} />
                    <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                        {t('subscription_info')}
                    </Text>
                </View>
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
    
    currentPlanCard: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    currentPlanBadge: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
    currentPlanTitle: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
    currentPlanDescription: { fontSize: 14, marginBottom: 16 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
    statBox: { alignItems: 'center' },
    statValue: { fontSize: 28, fontWeight: '700', color: '#FFF' },
    statLabel: { fontSize: 12, color: '#E0E0E0', marginTop: 4 },
    renewButtonsRow: { flexDirection: 'row', gap: 12 },
    renewButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
    renewButtonText: { fontWeight: '700', fontSize: 14 },
    cancelButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1 },
    cancelButtonText: { fontWeight: '700', fontSize: 14, color: '#FFF' },

    sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
    planCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    planBadge: { fontSize: 18, fontWeight: '700' },
    planPrice: { fontSize: 20, fontWeight: '700' },
    planDescription: { fontSize: 14, marginBottom: 12 },
    featuresContainer: { marginBottom: 16 },
    featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    featureText: { fontSize: 14, marginLeft: 8 },
    subscribeButton: {
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    subscribeButtonText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
    activeBadge: {
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    activeBadgeText: { color: '#FFF', fontWeight: '700' },

    infoBox: {
        flexDirection: 'row',
        padding: 16,
        borderRadius: 12,
        marginTop: 8,
    },
    infoText: { flex: 1, fontSize: 13, marginLeft: 12, lineHeight: 18 },
});
