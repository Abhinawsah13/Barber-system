import React, { useState, useEffect } from "react";
import {
    View, Text, StyleSheet, ScrollView, TextInput,
    TouchableOpacity, Alert, ActivityIndicator, Image, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from "../../context/ThemeContext";
import {
    updateBarberProfile, getProfile, getBarberById, getBarberRating,
} from "../../services/api";
import StarRating from "../../components/shared/StarRating";

// ── Constants ─────────────────────────────────────────────────────────────────
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SERVICES_LIST = [
    'Haircut', 'Beard Trim', 'Hair Color', 'Facial', 'Kids Cut', 'Shave', 'Others'
];

const EXP_OPTIONS = [
    { label: '< 1 yr', value: 0 },
    { label: '1-3 yrs', value: 1 },
    { label: '3-6 yrs', value: 3 },
    { label: '6+ yrs', value: 6 },
];

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function BarberEditProfileScreen({ navigation }) {
    const { theme } = useTheme();
    const [pageLoading, setPageLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [ratingData, setRatingData] = useState({ averageRating: 0, totalReviews: 0 });

    // Service modes
    const [serviceModeSelection, setServiceModeSelection] = useState('salon'); // 'salon', 'home', 'both'
    const [salonEnabled, setSalonEnabled] = useState(true);
    const [homeEnabled, setHomeEnabled] = useState(false);

    // Personal info
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [profileImage, setProfileImage] = useState('');

    // Salon / Location details
    const [shopName, setShopName] = useState('');
    const [city, setCity] = useState('');
    const [fullAddress, setFullAddress] = useState('');

    // Working schedule (Salon)
    const [salonDays, setSalonDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    const [salonOpen, setSalonOpen] = useState('09:00');
    const [salonClose, setSalonClose] = useState('19:00');

    // Working schedule (Home)
    const [homeDays, setHomeDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    const [homeOpen, setHomeOpen] = useState('09:00');
    const [homeClose, setHomeClose] = useState('19:00');

    // Home / service area
    const [serviceArea, setServiceArea] = useState('');

    // Common
    const [selectedServices, setSelectedServices] = useState([]);
    const [otherService, setOtherService] = useState('');
    const [expValue, setExpValue] = useState(1);
    const [salonPrice, setSalonPrice] = useState('');
    const [homePrice, setHomePrice] = useState('');
    const [homeTravelFee, setHomeTravelFee] = useState('');
    const [subscriptionPlan, setSubscriptionPlan] = useState('free');

    useEffect(() => { loadProfile(); }, []);

    // ── Load ─────────────────────────────────────────────────────────────────
    const loadProfile = async () => {
        try {
            setPageLoading(true);
            const user = await getProfile();
            if (!user?._id) return;

            setFullName(user.username || '');
            setPhone(user.phone || '');
            if (user.profile_image) setProfileImage(user.profile_image);

            const [barber, rating] = await Promise.all([
                getBarberById(user._id),
                getBarberRating(user._id),
            ]);

            if (barber) {
                if (barber.serviceModes) {
                    const isSalon = !!barber.serviceModes.salon;
                    const isHome = !!barber.serviceModes.home;
                    if (isSalon && isHome) setServiceModeSelection('both');
                    else if (isHome) setServiceModeSelection('home');
                    else setServiceModeSelection('salon');

                    setSalonEnabled(isSalon);
                    setHomeEnabled(isHome);
                } else if (barber.service_type) {
                    // Legacy fallback
                    const type = barber.service_type;
                    setServiceModeSelection(type);
                    setSalonEnabled(type === 'salon' || type === 'both');
                    setHomeEnabled(type === 'home' || type === 'both');
                }

                if (barber.services?.length) {
                    const known = barber.services.filter(s => SERVICES_LIST.includes(s));
                    const others = barber.services.filter(s => !SERVICES_LIST.includes(s));
                    setSelectedServices(known);
                    if (others.length > 0) {
                        setSelectedServices(prev => [...prev, 'Others']);
                        setOtherService(others.join(', '));
                    }
                }
                if (barber.experience_years != null) setExpValue(barber.experience_years);
                if (barber.location) {
                    setShopName(barber.location.address || '');
                    setCity(barber.location.city || '');
                    setFullAddress(barber.location.fullAddress || '');
                    setServiceArea(barber.location.serviceArea || '');
                }

                if (barber.availability) {
                    if (barber.availability.salon) {
                        const s = barber.availability.salon;
                        if (s.workingDays) setSalonDays(s.workingDays);
                        if (s.openTime) setSalonOpen(s.openTime);
                        if (s.closeTime) setSalonClose(s.closeTime);
                    }
                    if (barber.availability.home) {
                        const h = barber.availability.home;
                        if (h.workingDays) setHomeDays(h.workingDays);
                        if (h.openTime) setHomeOpen(h.openTime);
                        if (h.closeTime) setHomeClose(h.closeTime);
                    }
                }
                if (barber.subscription_plan) setSubscriptionPlan(barber.subscription_plan);
            }
            if (rating) setRatingData(rating);
        } catch (e) {
            console.log('loadProfile error:', e.message);
        } finally {
            setPageLoading(false);
        }
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission Denied', 'Camera roll access is needed.'); return; }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.2,     // ⬇ reduced from 0.5 — keeps base64 small enough for API
            base64: true,
        });
        if (!result.canceled) setProfileImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    };

    const toggleSalonDay = d => setSalonDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]);
    const toggleHomeDay = d => setHomeDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]);
    const toggleService = s => setSelectedServices(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

    const showSalon = serviceModeSelection === 'salon' || serviceModeSelection === 'both';
    const showHome = serviceModeSelection === 'home' || serviceModeSelection === 'both';
    const showBoth = serviceModeSelection === 'both';

    // ── Save ──────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!fullName.trim()) { Alert.alert('Error', 'Full name is required'); return; }

        let finalServices = selectedServices.filter(s => s !== 'Others');
        if (selectedServices.includes('Others') && otherService.trim()) {
            finalServices.push(...otherService.split(',').map(s => s.trim()));
        }

        if (finalServices.length === 0) { Alert.alert('Error', 'Select at least one service'); return; }
        if (showSalon && !shopName.trim()) { Alert.alert('Error', 'Shop name / address is required'); return; }
        if (showHome && !serviceArea.trim()) { Alert.alert('Error', 'Service area is required for Home service'); return; }

        setSaving(true);
        try {
            await updateBarberProfile({
                services: finalServices,
                experience_years: expValue,
                serviceModes: {
                    salon: showSalon,
                    home: showHome
                },
                location: {
                    address: shopName,
                    city,
                    fullAddress,
                    serviceArea,
                },
                availability: {
                    salon: {
                        workingDays: salonDays,
                        openTime: salonOpen,
                        closeTime: salonClose,
                        isActive: salonEnabled
                    },
                    home: {
                        workingDays: homeDays,
                        openTime: homeOpen,
                        closeTime: homeClose,
                        isActive: homeEnabled
                    }
                },
                profile_image: profileImage,
                is_verified_barber: true,
                subscription_plan: subscriptionPlan,
            });
            Alert.alert('Saved!', 'Your profile is live and visible to customers.');
            navigation.goBack();
        } catch (e) {
            Alert.alert('Error', e.message || 'Failed to save profile');
        } finally {
            setSaving(false);
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
                    <Text style={[styles.backText, { color: theme.text }]}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Barber Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* ── SERVICE MODES ────────────────────────────────────────── */}
                <Card theme={theme}>
                    <SectionTitle theme={theme}>Service Modes</SectionTitle>
                    <View style={styles.modeToggleRow}>
                        {[
                            { id: 'salon', label: 'Salon Only', icon: '💈' },
                            { id: 'home', label: 'Home Only', icon: '🏠' },
                            { id: 'both', label: 'Both', icon: '✨' }
                        ].map(mode => (
                            <TouchableOpacity
                                key={mode.id}
                                style={[
                                    styles.modeToggleBtn,
                                    { borderColor: theme.border, backgroundColor: theme.card },
                                    serviceModeSelection === mode.id && { backgroundColor: theme.primary + '15', borderColor: theme.primary }
                                ]}
                                onPress={() => {
                                    setServiceModeSelection(mode.id);
                                    setSalonEnabled(mode.id === 'salon' || mode.id === 'both');
                                    setHomeEnabled(mode.id === 'home' || mode.id === 'both');
                                }}
                            >
                                <Text style={{ fontSize: 24 }}>{mode.icon}</Text>
                                <Text style={[styles.modeToggleTxt, { color: theme.text }, serviceModeSelection === mode.id && { color: theme.primary, fontWeight: '700' }]}>{mode.label}</Text>
                                <View style={[styles.checkbox, { borderColor: theme.border }, serviceModeSelection === mode.id && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
                                    {serviceModeSelection === mode.id && <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>}
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </Card>

                {/* ── SUBSCRIPTION PLAN ────────────────────────────────────── */}
                <Card theme={theme}>
                    <SectionTitle theme={theme}>Subscription Plan</SectionTitle>
                    <View style={styles.typeRow}>
                        {[
                            { id: 'free', label: 'Basic (10%)', sub: 'Standard Commission' },
                            { id: 'premium', label: 'Premium (5%)', sub: 'Reduced Commission' }
                        ].map(plan => (
                            <TouchableOpacity
                                key={plan.id}
                                style={[
                                    styles.planCard,
                                    { borderColor: theme.border, backgroundColor: theme.card },
                                    subscriptionPlan === plan.id && { borderColor: theme.primary, backgroundColor: theme.primary + '10' },
                                ]}
                                onPress={() => setSubscriptionPlan(plan.id)}
                            >
                                <Text style={[
                                    styles.planLabel, { color: theme.text },
                                    subscriptionPlan === plan.id && { color: theme.primary, fontWeight: 'bold' }
                                ]}>
                                    {plan.label}
                                </Text>
                                <Text style={[styles.planSub, { color: theme.textMuted }]}>{plan.sub}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </Card>

                {/* ── PERSONAL INFO ────────────────────────────────────────── */}
                <Card theme={theme}>
                    <SectionTitle theme={theme}>Personal Info</SectionTitle>

                    <TouchableOpacity style={styles.photoWrap} onPress={pickImage}>
                        {profileImage ? (
                            <Image source={{ uri: profileImage }} style={styles.photo} />
                        ) : (
                            <View style={[styles.photo, styles.photoPlaceholder, { borderColor: theme.primary }]}>
                                <Text style={{ fontSize: 34, color: theme.primary }}>✂</Text>
                                <View style={[styles.photoBadge, { backgroundColor: theme.primary }]}>
                                    <Text style={{ color: '#fff', fontSize: 14, lineHeight: 18 }}>−</Text>
                                </View>
                            </View>
                        )}
                        <Text style={[styles.tapPhoto, { color: theme.textMuted }]}>Tap to upload photo</Text>
                    </TouchableOpacity>

                    <FieldLabel theme={theme}>Full Name</FieldLabel>
                    <FieldInput theme={theme} value={fullName} onChangeText={setFullName}
                        placeholder={showSalon ? 'e.g. Bikash Thapa' : 'e.g. Aarav Sharma'} />

                    <FieldLabel theme={theme}>Phone Number</FieldLabel>
                    <FieldInput theme={theme} value={phone} onChangeText={setPhone}
                        placeholder="e.g. 98XXXXXXXX" keyboardType="phone-pad" />
                </Card>

                {/* ── LOCATION DETAILS (Salon / Both) ─────────────────────── */}
                {showSalon && (
                    <Card theme={theme}>
                        <SectionTitle theme={theme}>Location Details</SectionTitle>

                        <FieldLabel theme={theme}>Shop Name / Address</FieldLabel>
                        <FieldInput theme={theme} value={shopName} onChangeText={setShopName}
                            placeholder="e.g. 123 Main St, Kathmandu" />

                        <FieldLabel theme={theme}>City</FieldLabel>
                        <FieldInput theme={theme} value={city} onChangeText={setCity}
                            placeholder="e.g. Kathmandu" />

                        <FieldLabel theme={theme}>Full Address</FieldLabel>
                        <FieldInput theme={theme} value={fullAddress} onChangeText={setFullAddress}
                            placeholder="e.g. Near Ratna Park, Kathmandu" />
                    </Card>
                )}

                {/* ── HOME SERVICE AREA (Home / Both) ─────────────────────── */}
                {showHome && (
                    <Card theme={theme}>
                        <SectionTitle theme={theme} accent={showBoth}>
                            {showBoth ? 'Home Service Area' : 'Service Area'}
                        </SectionTitle>

                        {!showBoth && (
                            <>
                                <FieldLabel theme={theme}>City</FieldLabel>
                                <FieldInput theme={theme} value={city} onChangeText={setCity}
                                    placeholder="e.g. Kathmandu" />
                            </>
                        )}

                        <FieldLabel theme={theme}>Area / Neighbourhood</FieldLabel>
                        <FieldInput theme={theme} value={serviceArea} onChangeText={setServiceArea}
                            placeholder="e.g. Thamel, Baneshwor" />

                        <View style={[styles.infoBox, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '40' }]}>
                            <Text style={{ color: theme.primary, fontSize: 12, lineHeight: 17 }}>
                                {showBoth
                                    ? 'Clients can book you at your salon or request home visits.'
                                    : "You travel to clients' homes. Make sure your coverage area is accurate."}
                            </Text>
                        </View>
                    </Card>
                )}

                {/* ── SERVICES ───────────────────────────────────────────── */}
                <Card theme={theme}>
                    <RowLabel theme={theme}>Services</RowLabel>
                    <View style={styles.chipsWrap}>
                        {SERVICES_LIST.map(s => (
                            <TouchableOpacity
                                key={s}
                                style={[
                                    styles.chip,
                                    { borderColor: theme.border, backgroundColor: theme.background },
                                    selectedServices.includes(s) && { borderColor: theme.primary, backgroundColor: theme.primary + '15' },
                                ]}
                                onPress={() => toggleService(s)}
                            >
                                <Text style={[
                                    styles.chipTxt, { color: theme.text },
                                    selectedServices.includes(s) && { color: theme.primary, fontWeight: '600' },
                                ]}>{s}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {selectedServices.includes('Others') && (
                        <View style={{ marginTop: 12 }}>
                            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Custom Services (comma separated)</Text>
                            <TextInput
                                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                                value={otherService}
                                onChangeText={setOtherService}
                                placeholder="Head Massage, Beard Wash..."
                                placeholderTextColor={theme.textMuted}
                            />
                        </View>
                    )}
                </Card>

                {/* ── WORKING DAYS + HOURS (Salon) ─────────────────────────── */}
                {showSalon && (
                    <Card theme={theme}>
                        <SectionTitle theme={theme} accent={showBoth}>Salon Working Hours</SectionTitle>
                        <View style={styles.daysRow}>
                            {DAYS.map(day => (
                                <TouchableOpacity
                                    key={day}
                                    style={[
                                        styles.dayChip,
                                        { borderColor: theme.border, backgroundColor: theme.background },
                                        salonDays.includes(day) && { backgroundColor: theme.primary, borderColor: theme.primary },
                                    ]}
                                    onPress={() => toggleSalonDay(day)}
                                >
                                    <Text style={[
                                        styles.dayTxt, { color: theme.textMuted },
                                        salonDays.includes(day) && { color: '#fff' },
                                    ]}>{day}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.hoursRow}>
                            <View style={styles.hourBox}>
                                <Text style={[styles.hourLabel, { color: theme.textMuted }]}>Open</Text>
                                <TextInput
                                    style={[styles.hourInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                                    value={salonOpen}
                                    onChangeText={setSalonOpen}
                                    placeholder="09:00"
                                    placeholderTextColor={theme.textMuted}
                                />
                            </View>
                            <Text style={[styles.hourDash, { color: theme.textMuted }]}>—</Text>
                            <View style={styles.hourBox}>
                                <Text style={[styles.hourLabel, { color: theme.textMuted }]}>Close</Text>
                                <TextInput
                                    style={[styles.hourInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                                    value={salonClose}
                                    onChangeText={setSalonClose}
                                    placeholder="19:00"
                                    placeholderTextColor={theme.textMuted}
                                />
                            </View>
                        </View>
                    </Card>
                )}

                {/* ── WORKING DAYS + HOURS (Home) ──────────────────────────── */}
                {showHome && (
                    <Card theme={theme}>
                        <SectionTitle theme={theme} accent={showBoth}>Home Service Hours</SectionTitle>
                        <View style={styles.daysRow}>
                            {DAYS.map(day => (
                                <TouchableOpacity
                                    key={day}
                                    style={[
                                        styles.dayChip,
                                        { borderColor: theme.border, backgroundColor: theme.background },
                                        homeDays.includes(day) && { backgroundColor: theme.primary, borderColor: theme.primary },
                                    ]}
                                    onPress={() => toggleHomeDay(day)}
                                >
                                    <Text style={[
                                        styles.dayTxt, { color: theme.textMuted },
                                        homeDays.includes(day) && { color: '#fff' },
                                    ]}>{day}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.hoursRow}>
                            <View style={styles.hourBox}>
                                <Text style={[styles.hourLabel, { color: theme.textMuted }]}>Open</Text>
                                <TextInput
                                    style={[styles.hourInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                                    value={homeOpen}
                                    onChangeText={setHomeOpen}
                                    placeholder="10:00"
                                    placeholderTextColor={theme.textMuted}
                                />
                            </View>
                            <Text style={[styles.hourDash, { color: theme.textMuted }]}>—</Text>
                            <View style={styles.hourBox}>
                                <Text style={[styles.hourLabel, { color: theme.textMuted }]}>Close</Text>
                                <TextInput
                                    style={[styles.hourInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                                    value={homeClose}
                                    onChangeText={setHomeClose}
                                    placeholder="18:00"
                                    placeholderTextColor={theme.textMuted}
                                />
                            </View>
                        </View>
                    </Card>
                )}

                {/* ── EXPERIENCE (Home only) ───────────────────────────────── */}
                {!showSalon && (
                    <Card theme={theme}>
                        <RowLabel theme={theme}>Experience</RowLabel>
                        <View style={styles.expRow}>
                            {EXP_OPTIONS.map(({ label, value }) => (
                                <TouchableOpacity
                                    key={value}
                                    style={[
                                        styles.expBtn,
                                        { borderColor: theme.border, backgroundColor: theme.background },
                                        expValue === value && { backgroundColor: theme.primary, borderColor: theme.primary },
                                    ]}
                                    onPress={() => setExpValue(value)}
                                >
                                    <Text style={[
                                        styles.expTxt, { color: theme.textMuted },
                                        expValue === value && { color: '#fff', fontWeight: '700' },
                                    ]}>{label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </Card>
                )}

                {/* ── PRICING ────────────────────────────────────────────── */}
                {(salonEnabled || homeEnabled) && (
                    <Card theme={theme}>
                        <SectionTitle theme={theme}>Pricing Configuration</SectionTitle>

                        {salonEnabled && (
                            <View style={{ marginBottom: homeEnabled ? 20 : 0 }}>
                                <RowLabel theme={theme} style={{ fontSize: 12, marginBottom: 4, opacity: 0.7 }}>💈 Salon Starting Price</RowLabel>
                                <View style={styles.priceInputRow}>
                                    <Text style={[styles.priceCurrLarge, { color: theme.primary }]}>Rs.</Text>
                                    <TextInput
                                        style={[styles.priceInputLarge, { color: theme.primary, borderBottomColor: theme.primary }]}
                                        value={salonPrice} onChangeText={setSalonPrice}
                                        placeholder="300" placeholderTextColor={theme.primary + '60'}
                                        keyboardType="numeric"
                                    />
                                    <Text style={[styles.perUnit, { color: theme.textMuted }]}>/ service</Text>
                                </View>
                            </View>
                        )}

                        {homeEnabled && (
                            <View style={{ marginTop: salonEnabled ? 10 : 0 }}>
                                <RowLabel theme={theme} style={{ fontSize: 12, marginBottom: 4, opacity: 0.7 }}>🏠 Home Base Price</RowLabel>
                                <View style={styles.priceInputRow}>
                                    <Text style={[styles.priceCurrLarge, { color: theme.primary }]}>Rs.</Text>
                                    <TextInput
                                        style={[styles.priceInputLarge, { color: theme.primary, borderBottomColor: theme.primary }]}
                                        value={homePrice} onChangeText={setHomePrice}
                                        placeholder="500" placeholderTextColor={theme.primary + '60'}
                                        keyboardType="numeric"
                                    />
                                    <Text style={[styles.perUnit, { color: theme.textMuted }]}>/ visit</Text>
                                </View>

                                <RowLabel theme={theme} style={{ fontSize: 12, marginTop: 16, marginBottom: 4, opacity: 0.7 }}>📍 Home Travel Surcharge</RowLabel>
                                <View style={styles.priceInputRow}>
                                    <Text style={[styles.priceCurrLarge, { color: theme.primary }]}>+ Rs.</Text>
                                    <TextInput
                                        style={[styles.priceInputLarge, { color: theme.primary, borderBottomColor: theme.primary }]}
                                        value={homeTravelFee} onChangeText={setHomeTravelFee}
                                        placeholder="100" placeholderTextColor={theme.primary + '60'}
                                        keyboardType="numeric"
                                    />
                                    <Text style={[styles.perUnit, { color: theme.textMuted }]}>travel fee</Text>
                                </View>
                            </View>
                        )}

                        <Text style={[styles.priceNote, { color: theme.textMuted, marginTop: 12 }]}>
                            {homeEnabled ? "Customer's total = Home Base Price + Service Price + Travel Fee" : "Customers pay the price of the services they book."}
                        </Text>
                    </Card>
                )}

                {/* ── RATING (read-only) ───────────────────────────────────── */}
                {ratingData.averageRating > 0 && (
                    <Card theme={theme}>
                        <SectionTitle theme={theme}>Your Rating</SectionTitle>
                        <View style={styles.ratingRow}>
                            <Text style={[styles.ratingBig, { color: theme.primary }]}>
                                {ratingData.averageRating.toFixed(1)}
                            </Text>
                            <View>
                                <StarRating rating={Math.round(ratingData.averageRating)} readOnly size={22} color="#f59e0b" emptyColor={theme.border} />
                                <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 4 }}>
                                    {ratingData.totalReviews} {ratingData.totalReviews === 1 ? 'review' : 'reviews'}
                                </Text>
                            </View>
                        </View>
                    </Card>
                )}

                {/* ── SAVE ─────────────────────────────────────────────────── */}
                <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: theme.primary }, saving && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.saveTxt}>Save & Continue →</Text>
                    }
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// ── Helper components ─────────────────────────────────────────────────────────
function Card({ theme, children, style }) {
    return <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, style]}>{children}</View>;
}
function SectionTitle({ theme, children, accent }) {
    return <Text style={[styles.sectionTitle, { color: accent ? theme.primary : theme.text }]}>{children}</Text>;
}
function RowLabel({ theme, children, style }) {
    return <Text style={[styles.rowLabel, { color: theme.text }, style]}>{children}</Text>;
}
function FieldLabel({ theme, children }) {
    return <Text style={[styles.fieldLabel, { color: theme.text }]}>{children}</Text>;
}
function FieldInput({ theme, ...props }) {
    return (
        <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
            placeholderTextColor={theme.textMuted}
            {...props}
        />
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
    },
    backBtn: { padding: 4 },
    backText: { fontSize: 24, fontWeight: 'bold' },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    content: { padding: 16 },

    card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14 },
    sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
    rowLabel: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
    fieldLabel: { fontSize: 13, fontWeight: '600', marginTop: 10, marginBottom: 6, color: '#888' },
    input: {
        borderWidth: 1, borderRadius: 10,
        paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 9,
        fontSize: 15, marginBottom: 4,
    },

    // Service modes
    modeToggleRow: { flexDirection: 'row', gap: 12 },
    modeToggleBtn: {
        flex: 1, padding: 16, borderRadius: 14, borderWidth: 1.5,
        alignItems: 'center', position: 'relative'
    },
    modeToggleTxt: { fontSize: 13, fontWeight: '600', marginTop: 8 },
    checkbox: {
        position: 'absolute', top: 8, right: 8,
        width: 18, height: 18, borderRadius: 9,
        borderWidth: 1.5, justifyContent: 'center', alignItems: 'center'
    },

    typeRow: { flexDirection: 'row', gap: 8 },
    typeBtn: { flex: 1, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
    typeTxt: { fontSize: 14 },

    // Subscription
    planCard: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
    planLabel: { fontSize: 13 },
    planSub: { fontSize: 10, marginTop: 2, textAlign: 'center' },

    // Photo
    photoWrap: { alignItems: 'center', marginBottom: 12, marginTop: 4 },
    photo: { width: 90, height: 90, borderRadius: 45, marginBottom: 6 },
    photoPlaceholder: { borderWidth: 2, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
    photoBadge: {
        position: 'absolute', bottom: 2, right: 2,
        width: 22, height: 22, borderRadius: 11,
        justifyContent: 'center', alignItems: 'center',
    },
    tapPhoto: { fontSize: 12 },

    // Info box
    infoBox: { marginTop: 12, padding: 10, borderRadius: 8, borderWidth: 1 },

    // Specialties
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
    chipTxt: { fontSize: 13 },

    // Working days
    daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    dayChip: { width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
    dayTxt: { fontSize: 11, fontWeight: '600' },

    // Working hours
    hoursRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 4 },
    hourBox: { flex: 1 },
    hourLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
    hourInput: {
        borderWidth: 1, borderRadius: 10,
        paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 9,
        fontSize: 15, textAlign: 'center', fontWeight: '600',
    },
    hourDash: { fontSize: 20, fontWeight: '300', marginBottom: 10 },

    // Experience
    expRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 2 },
    expBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5 },
    expTxt: { fontSize: 13 },

    // Pricing
    priceRow: { flexDirection: 'row', gap: 20, marginTop: 4 },
    priceHalf: { flex: 1 },
    priceTypeLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
    priceInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
    priceCurrLarge: { fontSize: 20, fontWeight: '700', marginBottom: 2 },
    priceInputLarge: {
        fontSize: 28, fontWeight: '800',
        borderBottomWidth: 2, paddingBottom: 2,
        minWidth: 80,
    },
    perUnit: { fontSize: 13, marginLeft: 4, marginBottom: 4 },
    priceNote: { fontSize: 11, marginTop: 10, fontStyle: 'italic' },

    // Rating
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    ratingBig: { fontSize: 44, fontWeight: '800' },

    // Save
    saveBtn: {
        padding: 18, borderRadius: 14, alignItems: 'center', marginTop: 6,
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
    },
    saveTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
