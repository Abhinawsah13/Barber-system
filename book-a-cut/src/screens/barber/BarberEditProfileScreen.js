import React, { useState, useEffect } from "react";
import {
    View, Text, StyleSheet, ScrollView, TextInput,
    TouchableOpacity, Alert, ActivityIndicator, Image, Platform, KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from "../../context/ThemeContext";
import {
    updateBarberProfile, getProfile, getBarberById, getMyBarberProfile, getBarberRating,
} from "../../services/api";
import StarRating from "../../components/shared/StarRating";
import { Ionicons } from '@expo/vector-icons';

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
    const [bio, setBio] = useState('');

    // Change Detection
    const [initialData, setInitialData] = useState(null);
    const [hasChanges, setHasChanges] = useState(false);

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

            // ✅ Use getMyBarberProfile — server resolves profile via JWT token
            const [barber, rating] = await Promise.all([
                getMyBarberProfile(),
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
                if (barber.bio) setBio(barber.bio);

                // Pricing
                if (barber.pricing) {
                    if (barber.pricing.salonValue) setSalonPrice(barber.pricing.salonValue.toString());
                    if (barber.pricing.homeValue) setHomePrice(barber.pricing.homeValue.toString());
                    if (barber.pricing.homeSurcharge) setHomeTravelFee(barber.pricing.homeSurcharge.toString());
                }

                // Capture initial state for change detection
                setInitialData({
                    fullName: user.username || '',
                    phone: user.phone || '',
                    profileImage: user.profile_image || '',
                    bio: barber.bio || '',
                    serviceModeSelection: barber.serviceModes?.salon && barber.serviceModes?.home ? 'both' : (barber.serviceModes?.home ? 'home' : 'salon'),
                    selectedServices: barber.services || [],
                    otherService: barber.services?.filter(s => !SERVICES_LIST.includes(s)).join(', ') || '',
                    shopName: barber.location?.address || '',
                    city: barber.location?.city || '',
                    fullAddress: barber.location?.fullAddress || '',
                    serviceArea: barber.location?.serviceArea || '',
                    salonDays: barber.availability?.salon?.workingDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                    salonOpen: barber.availability?.salon?.openTime || '09:00',
                    salonClose: barber.availability?.salon?.closeTime || '19:00',
                    homeDays: barber.availability?.home?.workingDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                    homeOpen: barber.availability?.home?.openTime || '10:00',
                    homeClose: barber.availability?.home?.closeTime || '18:00',
                    subscriptionPlan: barber.subscription_plan || 'free',
                    salonPrice: barber.pricing?.salonValue?.toString() || '',
                    homePrice: barber.pricing?.homeValue?.toString() || '',
                    homeTravelFee: barber.pricing?.homeSurcharge?.toString() || '',
                });
            }
            if (rating) setRatingData(rating);

        } catch (e) {
            console.log('loadProfile error:', e.message);
        } finally {
            setPageLoading(false);
        }
    };

    // ── Change Detection ─────────────────────────────────────────────────────
    useEffect(() => {
        if (!initialData) return;

        const currentData = {
            fullName,
            phone,
            profileImage,
            bio,
            serviceModeSelection,
            selectedServices: [...selectedServices].sort(),
            otherService,
            shopName,
            city,
            fullAddress,
            serviceArea,
            salonDays: [...salonDays].sort(),
            salonOpen,
            salonClose,
            homeDays: [...homeDays].sort(),
            homeOpen,
            homeClose,
            subscriptionPlan,
            salonPrice,
            homePrice,
            homeTravelFee,
        };

        const isChanged = JSON.stringify(currentData) !== JSON.stringify({
            ...initialData,
            selectedServices: [...initialData.selectedServices].sort(),
            salonDays: [...initialData.salonDays].sort(),
            homeDays: [...initialData.homeDays].sort(),
        });

        setHasChanges(isChanged);
    }, [
        fullName, phone, profileImage, bio, serviceModeSelection,
        selectedServices, otherService, shopName, city, fullAddress,
        serviceArea, salonDays, salonOpen, salonClose, homeDays,
        homeOpen, homeClose, subscriptionPlan, salonPrice, homePrice,
        homeTravelFee, initialData
    ]);

    // ── Helpers ───────────────────────────────────────────────────────────────
    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission Denied', 'Camera roll access is needed.'); return; }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.2,
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
        // ── VALIDATION ─────────────────────────────────────────────────────────
        if (!phone.trim()) {
            Alert.alert('Phone Required', 'Please enter your phone number.');
            return;
        }

        let finalServices = selectedServices.filter(s => s !== 'Others');
        if (selectedServices.includes('Others') && otherService.trim()) {
            finalServices.push(...otherService.split(',').map(s => s.trim()).filter(Boolean));
        }

        if (finalServices.length === 0) {
            Alert.alert('Services Required', 'Please select at least one service you offer.');
            return;
        }

        if (expValue === null || expValue === undefined) {
            Alert.alert('Experience Required', 'Please select your years of experience.');
            return;
        }

        const isSalonActive = serviceModeSelection === 'salon' || serviceModeSelection === 'both';
        const isHomeActive = serviceModeSelection === 'home' || serviceModeSelection === 'both';

        if (isSalonActive && !salonPrice.trim()) {
            Alert.alert('Price Required', 'Please enter your salon service starting price (Rs).');
            return;
        }
        if (isHomeActive && !homePrice.trim()) {
            Alert.alert('Price Required', 'Please enter your home service starting price (Rs).');
            return;
        }

        if (isSalonActive && (!salonOpen.trim() || !salonClose.trim())) {
            Alert.alert('Working Hours Required', 'Please enter salon opening and closing times (e.g. 09:00 - 19:00).');
            return;
        }

        if (isHomeActive && (!homeOpen.trim() || !homeClose.trim())) {
            Alert.alert('Working Hours Required', 'Please enter home service opening and closing times.');
            return;
        }

        if (isSalonActive && salonOpen >= salonClose) {
            Alert.alert('Invalid Hours', 'Salon closing time must be after opening time.');
            return;
        }

        if (isHomeActive && homeOpen >= homeClose) {
            Alert.alert('Invalid Hours', 'Home service closing time must be after opening time.');
            return;
        }

        if (!fullName.trim()) {
            Alert.alert('Name Required', 'Please enter your full name.');
            return;
        }

        if (isSalonActive && !shopName.trim()) {
            Alert.alert('Address Required', 'Please enter your shop name / salon address.');
            return;
        }
        if (isHomeActive && !serviceArea.trim()) {
            Alert.alert('Service Area Required', 'Please specify the area you cover for home service.');
            return;
        }

        // ── END VALIDATION ──────────────────────────────────────────────────────

        setSaving(true);
        try {
            await updateBarberProfile({
                fullName,
                phone,
                services: finalServices,
                bio,
                experience_years: expValue,
                serviceModes: {
                    salon: isSalonActive,
                    home: isHomeActive
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
                        isActive: isSalonActive
                    },
                    home: {
                        workingDays: homeDays,
                        openTime: homeOpen,
                        closeTime: homeClose,
                        isActive: isHomeActive
                    }
                },
                pricing: {
                    salonValue: parseFloat(salonPrice) || 0,
                    homeValue: parseFloat(homePrice) || 0,
                    homeSurcharge: parseFloat(homeTravelFee) || 0,
                },
                profile_image: profileImage,
                is_verified_barber: true,
                subscription_plan: subscriptionPlan,
            });
            Alert.alert('✅ Success', 'Profile updated successfully!');
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
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>My Profile</Text>
                <TouchableOpacity onPress={handleSave} disabled={saving || !hasChanges}>
                    {saving ? <ActivityIndicator size="small" color={theme.primary} /> : <Text style={[styles.saveHeaderTxt, { color: hasChanges ? theme.primary : theme.textMuted }]}>Save</Text>}
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    
                    {/* PHOTO SECTION */}
                    <View style={styles.photoSection}>
                        <TouchableOpacity style={styles.photoContainer} onPress={pickImage}>
                            {profileImage ? (
                                <Image source={{ uri: profileImage }} style={styles.photo} />
                            ) : (
                                <Image 
                                    source={require("../../../assets/barber.png")} 
                                    style={styles.photo} 
                                />
                            )}
                            <View style={[styles.editBadge, { backgroundColor: theme.primary }]}>
                                <Ionicons name="pencil" size={14} color="#FFF" />
                            </View>
                        </TouchableOpacity>
                        <Text style={[styles.photoHint, { color: theme.textLight }]}>Tap to change profile picture</Text>
                    </View>

                    {/* BASIC INFO */}
                    <Card theme={theme}>
                        <SectionTitle theme={theme}>Personal Information</SectionTitle>
                        <FieldLabel theme={theme}>Full Name</FieldLabel>
                        <FieldInput theme={theme} value={fullName} onChangeText={setFullName} placeholder="Enter your full name" />

                        <FieldLabel theme={theme}>Phone Number</FieldLabel>
                        <FieldInput theme={theme} value={phone} onChangeText={setPhone} placeholder="Enter your phone number" keyboardType="phone-pad" />

                        <FieldLabel theme={theme}>Bio</FieldLabel>
                        <FieldInput theme={theme} value={bio} onChangeText={setBio} placeholder="Describe yourself..." multiline numberOfLines={3} style={{ height: 80, textAlignVertical: 'top' }} />
                    </Card>

                    {/* SERVICE MODES */}
                    <Card theme={theme}>
                        <SectionTitle theme={theme}>Service Modes</SectionTitle>
                        <View style={styles.modeToggleRow}>
                            {['salon', 'home', 'both'].map(mode => (
                                <TouchableOpacity
                                    key={mode}
                                    style={[
                                        styles.modeBtn,
                                        { borderColor: theme.border, backgroundColor: theme.background },
                                        serviceModeSelection === mode && { borderColor: theme.primary, backgroundColor: theme.primary + '10' }
                                    ]}
                                    onPress={() => setServiceModeSelection(mode)}
                                >
                                    <Text style={[styles.modeBtnText, { color: theme.text }, serviceModeSelection === mode && { color: theme.primary, fontWeight: '700' }]}>
                                        {mode === 'both' ? 'Both' : mode === 'home' ? 'Home Only' : 'Salon Only'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </Card>

                    {/* LOCATION DETAILS (Salon / Both) */}
                    {showSalon && (
                        <Card theme={theme}>
                            <SectionTitle theme={theme}>Salon Details</SectionTitle>
                            <FieldLabel theme={theme}>Shop Name / Address</FieldLabel>
                            <FieldInput theme={theme} value={shopName} onChangeText={setShopName} placeholder="e.g. 123 Main St" />

                            <FieldLabel theme={theme}>City</FieldLabel>
                            <FieldInput theme={theme} value={city} onChangeText={setCity} placeholder="e.g. Kathmandu" />

                            <FieldLabel theme={theme}>Full Address</FieldLabel>
                            <FieldInput theme={theme} value={fullAddress} onChangeText={setFullAddress} placeholder="Detailed address..." />
                        </Card>
                    )}

                    {/* HOME SERVICE AREA (Home / Both) */}
                    {showHome && (
                        <Card theme={theme}>
                            <SectionTitle theme={theme}>Home Service Details</SectionTitle>
                            <FieldLabel theme={theme}>Service Area / Coverage</FieldLabel>
                            <FieldInput theme={theme} value={serviceArea} onChangeText={setServiceArea} placeholder="Area you cover..." />
                        </Card>
                    )}

                    {/* SERVICES */}
                    <Card theme={theme}>
                        <SectionTitle theme={theme}>Your Services</SectionTitle>
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
                                    <Text style={[styles.chipTxt, { color: theme.text }, selectedServices.includes(s) && { color: theme.primary, fontWeight: '600' }]}>{s}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        {selectedServices.includes('Others') && (
                            <View style={{ marginTop: 12 }}>
                                <FieldLabel theme={theme}>Custom Services (comma separated)</FieldLabel>
                                <FieldInput theme={theme} value={otherService} onChangeText={setOtherService} placeholder="Head Massage, Beard Wash..." />
                            </View>
                        )}
                    </Card>

                    {/* EXPERIENCE */}
                    <Card theme={theme}>
                        <SectionTitle theme={theme}>Experience</SectionTitle>
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
                                    <Text style={[styles.expTxt, { color: theme.text }, expValue === value && { color: '#fff', fontWeight: '700' }]}>{label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </Card>

                    {/* PRICING */}
                    <Card theme={theme}>
                        <SectionTitle theme={theme}>Pricing Configuration (Starting Prices)</SectionTitle>
                        {showSalon && (
                            <View style={{ marginBottom: showHome ? 20 : 0 }}>
                                <FieldLabel theme={theme}>Salon Service (Rs.)</FieldLabel>
                                <FieldInput theme={theme} value={salonPrice} onChangeText={setSalonPrice} placeholder="300" keyboardType="numeric" />
                            </View>
                        )}
                        {showHome && (
                            <>
                                <FieldLabel theme={theme}>Home Base Price (Rs.)</FieldLabel>
                                <FieldInput theme={theme} value={homePrice} onChangeText={setHomePrice} placeholder="500" keyboardType="numeric" />
                                <FieldLabel theme={theme}>Home Travel Surcharge (Rs.)</FieldLabel>
                                <FieldInput theme={theme} value={homeTravelFee} onChangeText={setHomeTravelFee} placeholder="100" keyboardType="numeric" />
                            </>
                        )}
                    </Card>

                    {/* WORKING HOURS */}
                    <Card theme={theme}>
                        <SectionTitle theme={theme}>Working Hours</SectionTitle>
                        {showSalon && (
                            <>
                                <FieldLabel theme={theme}>Salon Hours</FieldLabel>
                                <View style={styles.hoursRow}>
                                    <View style={styles.hourBox}>
                                        <Text style={[styles.hourLab, { color: theme.textLight }]}>Opens</Text>
                                        <FieldInput theme={theme} value={salonOpen} onChangeText={setSalonOpen} placeholder="09:00" />
                                    </View>
                                    <Text style={{ marginTop: 25, color: theme.textLight }}>—</Text>
                                    <View style={styles.hourBox}>
                                        <Text style={[styles.hourLab, { color: theme.textLight }]}>Closes</Text>
                                        <FieldInput theme={theme} value={salonClose} onChangeText={setSalonClose} placeholder="19:00" />
                                    </View>
                                </View>
                            </>
                        )}
                        
                        {showHome && (
                            <View style={{ marginTop: showSalon ? 15 : 0 }}>
                                <FieldLabel theme={theme}>Home Service Hours</FieldLabel>
                                <View style={styles.hoursRow}>
                                    <View style={styles.hourBox}>
                                        <Text style={[styles.hourLab, { color: theme.textLight }]}>Opens</Text>
                                        <FieldInput theme={theme} value={homeOpen} onChangeText={setHomeOpen} placeholder="10:00" />
                                    </View>
                                    <Text style={{ marginTop: 25, color: theme.textLight }}>—</Text>
                                    <View style={styles.hourBox}>
                                        <Text style={[styles.hourLab, { color: theme.textLight }]}>Closes</Text>
                                        <FieldInput theme={theme} value={homeClose} onChangeText={setHomeClose} placeholder="18:00" />
                                    </View>
                                </View>
                            </View>
                        )}
                    </Card>

                    <TouchableOpacity 
                        style={[styles.saveBtn, { backgroundColor: theme.primary }, (saving || !hasChanges) && { opacity: 0.5 }]} 
                        onPress={handleSave} 
                        disabled={saving || !hasChanges}
                    >
                        {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Update Profile</Text>}
                    </TouchableOpacity>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

// Helpers
function Card({ theme, children }) {
    return <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>{children}</View>;
}
function SectionTitle({ theme, children }) {
    return <Text style={[styles.sectionTitle, { color: theme.text }]}>{children}</Text>;
}
function FieldLabel({ theme, children }) {
    return <Text style={[styles.fieldLab, { color: theme.textLight }]}>{children}</Text>;
}
function FieldInput({ theme, style, ...props }) {
    return <TextInput style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }, style]} placeholderTextColor={theme.textLight} {...props} />;
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    saveHeaderTxt: { fontSize: 16, fontWeight: '700' },
    content: { padding: 16 },

    photoSection: { alignItems: 'center', marginBottom: 24 },
    photoContainer: { width: 90, height: 90, borderRadius: 45, position: 'relative' },
    photo: { width: '100%', height: '100%', borderRadius: 45 },
    photoPlaceholder: { justifyContent: 'center', alignItems: 'center' },
    editBadge: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
    photoHint: { fontSize: 11, marginTop: 6 },

    card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14 },
    sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 15 },
    fieldLab: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
    input: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 14, marginBottom: 10 },

    modeToggleRow: { flexDirection: 'row', gap: 10 },
    modeBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
    modeBtnText: { fontSize: 12, fontWeight: '600' },

    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
    chipTxt: { fontSize: 12 },

    expRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    expBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
    expTxt: { fontSize: 12 },

    hoursRow: { flexDirection: 'row', gap: 15, alignItems: 'center' },
    hourBox: { flex: 1 },
    hourLab: { fontSize: 11, marginBottom: 4 },

    saveBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 5 },
    saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
