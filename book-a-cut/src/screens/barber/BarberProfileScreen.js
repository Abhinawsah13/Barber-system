import React, { useState, useEffect } from "react";
import {
    View, Text, StyleSheet, ScrollView,
    TouchableOpacity, Alert, ActivityIndicator, Image, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageProvider";
import { getProfile, getBarberById, getMyBarberProfile, getBarberRating } from "../../services/api";
import StarRating from "../../components/shared/StarRating";
import { Ionicons } from '@expo/vector-icons';

export default function BarberProfileScreen({ navigation }) {
    const { theme } = useTheme();
    const { t } = useLanguage();
    const [pageLoading, setPageLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    const [barber, setBarber] = useState(null);
    const [ratingData, setRatingData] = useState({ averageRating: 0, totalReviews: 0 });

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            loadProfile();
        });
        return unsubscribe;
    }, [navigation]);

    const loadProfile = async () => {
        try {
            setPageLoading(true);
            const user = await getProfile();
            if (!user?._id) return;
            setProfile(user);

            // ✅ Use getMyBarberProfile — server resolves profile via JWT token
            const [barberData, rating] = await Promise.all([
                getMyBarberProfile(),
                getBarberRating(user._id),
            ]);

            setBarber(barberData);
            if (rating) setRatingData(rating);
        } catch (e) {
            console.log('loadProfile error:', e.message);
        } finally {
            setPageLoading(false);
        }
    };

    if (pageLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            {/* ── Header ─────────────────────────────────────────────────── */}
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>{t('my_profile')}</Text>
                <TouchableOpacity 
                    onPress={() => navigation.navigate('BarberEditProfile')}
                    style={styles.editBtn}
                >
                    <Ionicons name="create-outline" size={20} color={theme.primary} />
                    <Text style={[styles.editBtnText, { color: theme.primary }]}>{t('edit')}</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* ── Profile Hero ────────────────────────────────────────── */}
                <View style={styles.heroSection}>
                    <View style={[styles.photoContainer, { borderColor: theme.primary }]}>
                        {profile?.profile_image ? (
                            <Image source={{ uri: profile.profile_image }} style={styles.photo} />
                        ) : (
                            <Image 
                                source={require("../../../assets/barber.png")} 
                                style={styles.photo} 
                            />
                        )}
                        {barber?.is_verified_barber && (
                            <View style={styles.verifiedBadge}>
                                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                            </View>
                        )}
                    </View>
                    <Text style={[styles.name, { color: theme.text }]}>{profile?.username}</Text>
                    <View style={styles.ratingRow}>
                        <StarRating rating={Math.round(ratingData.averageRating)} readOnly size={18} color="#f59e0b" emptyColor={theme.border} />
                        <Text style={[styles.ratingText, { color: theme.textLight }]}>
                            {ratingData.averageRating.toFixed(1)} ({ratingData.totalReviews} {t('reviews')})
                        </Text>
                    </View>
                    {barber?.subscription_plan === 'premium' && (
                        <View style={styles.premiumBadge}>
                            <Ionicons name="star" size={12} color="#FFF" />
                            <Text style={styles.premiumText}>{t('premium_barber')}</Text>
                        </View>
                    )}
                </View>

                {/* ── Stats Row ───────────────────────────────────────────── */}
                <View style={styles.statsRow}>
                    <View style={[styles.statItem, { borderRightWidth: 1, borderRightColor: theme.border }]}>
                        <Text style={[styles.statVal, { color: theme.text }]}>{barber?.experience_years || 0}+</Text>
                        <Text style={[styles.statLab, { color: theme.textLight }]}>{t('years_exp')}</Text>
                    </View>
                    <View style={[styles.statItem, { borderRightWidth: 1, borderRightColor: theme.border }]}>
                        <Text style={[styles.statVal, { color: theme.text }]}>{barber?.services?.length || 0}</Text>
                        <Text style={[styles.statLab, { color: theme.textLight }]}>{t('services')}</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={[styles.statVal, { color: theme.text }]}>Rs {barber?.pricing?.salonValue || barber?.pricing?.homeValue || 0}</Text>
                        <Text style={[styles.statLab, { color: theme.textLight }]}>{t('starting_price')}</Text>
                    </View>
                </View>

                {/* ── Bio ─────────────────────────────────────────────────── */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('about_me')}</Text>
                    <Text style={[styles.bioText, { color: theme.textLight }]}>
                        {barber?.bio || t('no_bio')}
                    </Text>
                </View>

                {/* ── Services ────────────────────────────────────────────── */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('featured_services')}</Text>
                    <View style={styles.servicesGrid}>
                        {barber?.services?.map((service, index) => (
                            <View key={index} style={[styles.serviceTag, { backgroundColor: theme.primary + '10' }]}>
                                <Text style={[styles.serviceTagText, { color: theme.primary }]}>{service}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* ── Location & Availability ────────────────────────────── */}
                {/* ── Location & Availability ────────────────────────────── */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        {barber?.serviceModes?.salon && barber?.serviceModes?.home 
                            ? t('service_information') 
                            : barber?.serviceModes?.home 
                                ? t('home_service_info') 
                                : t('salon_information')}
                    </Text>
                    <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        
                        {/* SALON SECTION */}
                        {barber?.serviceModes?.salon && (
                            <>
                                <View style={styles.infoLine}>
                                    <Ionicons name="location-sharp" size={18} color={theme.primary} />
                                    <View style={styles.infoContent}>
                                        <Text style={[styles.infoLabel, { color: theme.textLight }]}>{t('salon_location')}</Text>
                                        <Text style={[styles.infoValue, { color: theme.text }]}>
                                            {barber?.location?.fullAddress || barber?.location?.address || t('address_not_specified')}
                                        </Text>
                                    </View>
                                </View>
                                
                                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                                
                                <View style={styles.infoLine}>
                                    <Ionicons name="time" size={18} color={theme.primary} />
                                    <View style={styles.infoContent}>
                                        <Text style={[styles.infoLabel, { color: theme.textLight }]}>{t('salon_hours')}</Text>
                                        <Text style={[styles.infoValue, { color: theme.text }]}>
                                            {barber?.availability?.salon?.openTime} - {barber?.availability?.salon?.closeTime}
                                        </Text>
                                        <Text style={[styles.infoSubValue, { color: theme.textLight }]}>
                                            {barber?.availability?.salon?.workingDays?.join(', ')}
                                        </Text>
                                    </View>
                                </View>
                            </>
                        )}

                        {/* DIVIDER BETWEEN SALON AND HOME IF BOTH EXIST */}
                        {barber?.serviceModes?.salon && barber?.serviceModes?.home && (
                            <View style={[styles.divider, { backgroundColor: theme.primary + '30', marginVertical: 20 }]} />
                        )}

                        {/* HOME SECTION */}
                        {barber?.serviceModes?.home && (
                            <>
                                <View style={styles.infoLine}>
                                    <Ionicons name="map" size={18} color={theme.primary} />
                                    <View style={styles.infoContent}>
                                        <Text style={[styles.infoLabel, { color: theme.textLight }]}>{t('home_service_area')}</Text>
                                        <Text style={[styles.infoValue, { color: theme.text }]}>
                                            {barber?.location?.serviceArea || t('not_specified')}
                                        </Text>
                                    </View>
                                </View>

                                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                                <View style={styles.infoLine}>
                                    <Ionicons name="time-outline" size={18} color={theme.primary} />
                                    <View style={styles.infoContent}>
                                        <Text style={[styles.infoLabel, { color: theme.textLight }]}>{t('home_service_hours')}</Text>
                                        <Text style={[styles.infoValue, { color: theme.text }]}>
                                            {barber?.availability?.home?.openTime} - {barber?.availability?.home?.closeTime}
                                        </Text>
                                        <Text style={[styles.infoSubValue, { color: theme.textLight }]}>
                                            {barber?.availability?.home?.workingDays?.join(', ')}
                                        </Text>
                                    </View>
                                </View>
                            </>
                        )}
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: 'rgba(183, 110, 34, 0.1)' },
    editBtnText: { fontSize: 14, fontWeight: '600' },
    
    content: { paddingBottom: 20 },
    
    heroSection: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 20 },
    photoContainer: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, padding: 4, marginBottom: 16, position: 'relative' },
    photo: { width: '100%', height: '100%', borderRadius: 55 },
    photoPlaceholder: { justifyContent: 'center', alignItems: 'center' },
    verifiedBadge: { position: 'absolute', bottom: 5, right: 5, backgroundColor: '#3b82f6', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
    
    name: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    ratingText: { fontSize: 14, fontWeight: '600' },
    
    premiumBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f59e0b', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    premiumText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
    
    statsRow: { flexDirection: 'row', paddingVertical: 20, marginHorizontal: 20, marginBottom: 20 },
    statItem: { flex: 1, alignItems: 'center' },
    statVal: { fontSize: 18, fontWeight: '700' },
    statLab: { fontSize: 12, fontWeight: '500', marginTop: 2 },
    
    section: { paddingHorizontal: 20, marginBottom: 24 },
    sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
    bioText: { fontSize: 15, lineHeight: 22 },
    
    servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    serviceTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    serviceTagText: { fontSize: 13, fontWeight: '600' },
    
    infoCard: { padding: 20, borderRadius: 20, borderWidth: 1 },
    infoLine: { flexDirection: 'row', gap: 12 },
    infoContent: { flex: 1 },
    infoLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
    infoValue: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
    infoSubValue: { fontSize: 12, marginTop: 2 },
    divider: { height: 1, marginVertical: 15 },
});
