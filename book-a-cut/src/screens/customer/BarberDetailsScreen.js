import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, FlatList, Alert, Linking, Dimensions, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { getBarberById, getAvailableSlots, getBarberReviews, getBarberRating } from "../../services/api";
import { formatDateTime } from '../../utils/dateUtils';

const { width } = Dimensions.get('window');

export default function BarberDetailsScreen({ navigation, route }) {
    const { theme } = useTheme();
    const initialBarber = route.params?.barber || null;
    const [barberData, setBarberData] = useState(initialBarber);
    const [services, setServices] = useState(initialBarber?.offeredServices || initialBarber?.services || []);
    const [loading, setLoading] = useState(!initialBarber);
    const [activeTab, setActiveTab] = useState('Book'); // 'Book', 'Reviews', 'Info'
    const [selectedService, setSelectedService] = useState(route.params?.service || null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedServiceType, setSelectedServiceType] = useState(route.params?.serviceType || (initialBarber?.serviceModes?.home ? 'home' : 'salon'));
    const [availableSlots, setAvailableSlots] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [ratingBreakdown, setRatingBreakdown] = useState({ averageRating: 0, totalReviews: 0, starBreakdown: [] });
    const [fetchingReviews, setFetchingReviews] = useState(false);
    const [address, setAddress] = useState("");
    const [addressNotes, setAddressNotes] = useState("");

    useEffect(() => {
        const id = route.params?.barberId || route.params?.barber?._id || route.params?.barber?.user?._id;
        if (id) {
            loadBarberDetails(id);
            fetchReviewsAndRating(id);
        }
    }, []);

    const fetchReviewsAndRating = async (id) => {
        setFetchingReviews(true);
        try {
            const [reviewsData, ratingData] = await Promise.all([
                getBarberReviews(id),
                getBarberRating(id)
            ]);
            setReviews(reviewsData.data || []);
            setRatingBreakdown(ratingData || { averageRating: 0, totalReviews: 0, starBreakdown: [] });
        } catch (error) {
            console.error("Error fetching reviews:", error);
        } finally {
            setFetchingReviews(false);
        }
    };

    useEffect(() => {
        if (selectedDate && selectedService) {
            fetchSlots(selectedDate);
        }
    }, [selectedDate, selectedService, selectedServiceType]);

    // Auto-deselect service if it's no longer in the filtered list
    useEffect(() => {
        if (selectedService && services.length > 0) {
            const isAvailable = services.some(s => {
                const sType = s.serviceType || 'both';
                return s._id === selectedService._id && (sType === selectedServiceType || sType === 'both');
            });
            if (!isAvailable) {
                setSelectedService(null);
                setSelectedSlot(null);
            }
        }
    }, [selectedServiceType, services]);

    const fetchSlots = async (date) => {
        const id = route.params?.barberId || barberData?.user?._id || barberData?._id;
        if (!id || !selectedService?._id) return;

        setLoadingSlots(true);
        setSelectedSlot(null);
        try {
            const res = await getAvailableSlots({
                barberId: id,
                serviceId: selectedService._id,
                date: date,
                serviceType: selectedServiceType
            });
            setAvailableSlots(res.slots || []);
        } catch (error) {
            console.error("Error fetching slots:", error);
            setAvailableSlots([]);
        } finally {
            setLoadingSlots(false);
        }
    };

    const loadBarberDetails = async (id) => {
        try {
            const data = await getBarberById(id);
            if (data) {
                setBarberData(data);
                setServices(data.offeredServices || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const user = barberData?.user || {};
    const name = user.username || barberData?.username || "Aarav Sharma";
    const image = user.profile_image;
    const phone = user.phone || "";
    const rating = barberData?.rating?.average || 0;
    const reviewCount = barberData?.rating?.count || 0;
    const locationName = selectedServiceType === 'home'
        ? (barberData?.location?.serviceArea || barberData?.location?.city || "Kathmandu")
        : (barberData?.location?.address || barberData?.location?.city || "Kathmandu");
    const shopName = barberData?.shop_name || "Sharp Edge";

    const handleConfirmBooking = () => {
        if (!selectedService || !selectedDate || !selectedSlot) {
            Alert.alert("Selection Required", "Please select a service, date, and time slot.");
            return;
        }

        if (selectedServiceType === 'home' && !address.trim()) {
            Alert.alert("Address Required", "Please enter your full address for the home visit.");
            return;
        }

        navigation.navigate("BookingConfirmation", {
            service: selectedService,
            barber: barberData,
            barberId: barberData?.user?._id || barberData?.user || barberData?._id,
            barberName: name,
            date: selectedDate,
            timeSlot: selectedSlot.time,
            timeSlotISO: selectedSlot.iso,
            serviceType: selectedServiceType,
            customerAddress: address,
            notes: addressNotes
        });
    };

    const renderBookTab = () => (
        <View style={styles.tabContent}>
            {/* Home Service Available Banner */}
            {selectedServiceType === 'home' && (
                <View style={[styles.homeReadyBanner, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '30' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Text style={{ fontSize: 24, marginRight: 12 }}>🏍️</Text>
                            <View>
                                <Text style={[styles.homeReadyTitle, { color: theme.text }]}>Home Service Available</Text>
                                <Text style={[styles.homeReadySub, { color: theme.textMuted }]}>Thamel, Baneshwor, Baluwatar & nearby</Text>
                            </View>
                        </View>
                        <View style={styles.activeBadge}>
                            <Text style={styles.activeText}>Active</Text>
                        </View>
                    </View>
                </View>
            )}

            {/* AI Advisor Banner */}
            {selectedServiceType === 'salon' && (
                <TouchableOpacity
                    style={[styles.aiBanner, { backgroundColor: theme.primary + '10' }]}
                    onPress={() => navigation.navigate("AIChat")}
                >
                    <View style={styles.aiIconWrap}>
                        <Text style={{ fontSize: 24 }}>✨</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.aiTitle, { color: theme.text }]}>AI Style Advisor</Text>
                        <Text style={[styles.aiSub, { color: theme.textMuted }]}>Not sure what looks best? Ask our AI for recommendations.</Text>
                    </View>
                    <Text style={{ color: theme.primary, fontWeight: 'bold' }}>ASK →</Text>
                </TouchableOpacity>
            )}


            <View style={[styles.card, { backgroundColor: theme.card }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Choose Service</Text>
                {(() => {
                    const filteredServices = services.filter(s => {
                        const sType = s.serviceType || 'both';
                        return (sType === selectedServiceType || sType === 'both') && s.isActive !== false;
                    });

                    if (services.length === 0) {
                        return <Text style={{ textAlign: 'center', color: theme.textMuted, padding: 20 }}>This barber hasn't added any bookable services yet.</Text>;
                    }

                    if (filteredServices.length === 0) {
                        return (
                            <View style={{ padding: 20, alignItems: 'center' }}>
                                <Text style={{ fontSize: 40, marginBottom: 10 }}>{selectedServiceType === 'home' ? '🏠' : '💈'}</Text>
                                <Text style={{ textAlign: 'center', color: theme.textMuted }}>
                                    This barber does not offer <Text style={{ fontWeight: 'bold' }}>{selectedServiceType === 'home' ? 'Home Service' : 'At Salon'}</Text> bookings at the moment.
                                </Text>
                            </View>
                        );
                    }

                    return filteredServices.map((service, index) => {
                        const isSelected = selectedService?._id === service._id;
                        return (
                            <TouchableOpacity
                                key={service._id || index}
                                style={[
                                    styles.serviceItem,
                                    { borderBottomColor: theme.border + '40' },
                                    isSelected && { backgroundColor: theme.primary + '10', borderRadius: 12, paddingHorizontal: 10 }
                                ]}
                                onPress={() => setSelectedService(service)}
                            >
                                <View style={styles.serviceIconContainer}>
                                    <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: theme.inputBg, justifyContent: 'center', alignItems: 'center' }}>
                                        <Text style={{ fontSize: 22 }}>{index === 0 ? '💈' : index === 1 ? '✂️' : index === 2 ? '🧔' : '⭐'}</Text>
                                    </View>
                                </View>
                                <View style={styles.serviceInfo}>
                                    <Text style={[styles.serviceName, { color: theme.text, fontWeight: isSelected ? 'bold' : '600' }]}>{service.name}</Text>
                                    <Text style={[styles.serviceMeta, { color: theme.textMuted }]}>🕒 {service.duration_minutes} min</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={[styles.servicePrice, { color: theme.primary, fontWeight: 'bold' }]}>Rs. {service.price}</Text>
                                    {isSelected && <Text style={{ fontSize: 10, color: theme.primary, fontWeight: 'bold' }}>SELECTED</Text>}
                                </View>
                            </TouchableOpacity>
                        );
                    });
                })()}
                {selectedServiceType === 'home' && (
                    <View style={styles.surchargeBox}>
                        <Text style={styles.surchargeText}>💡 Home visit prices include a travel surcharge</Text>
                    </View>
                )}
            </View>

            {selectedServiceType === 'home' && (
                <View style={[styles.card, { backgroundColor: theme.card }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Your Address</Text>
                    <View style={[styles.inputContainer, { borderColor: theme.border }]}>
                        <Text style={{ fontSize: 16, marginRight: 10 }}>📍</Text>
                        <TextInput
                            placeholder="Enter your full address..."
                            value={address}
                            onChangeText={setAddress}
                            style={{ flex: 1, paddingVertical: 10, color: theme.text }}
                            placeholderTextColor={theme.textMuted}
                        />
                    </View>
                    <View style={[styles.inputContainer, { borderColor: theme.border, height: 80, alignItems: 'flex-start', paddingTop: 10, marginTop: 12 }]}>
                        <TextInput
                            placeholder="Add a note (floor, landmark, gate color...)"
                            value={addressNotes}
                            onChangeText={setAddressNotes}
                            multiline
                            style={{ flex: 1, color: theme.text }}
                            placeholderTextColor={theme.textMuted}
                        />
                    </View>
                </View>
            )}

            <View style={[styles.card, { backgroundColor: theme.card }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Pick a Date</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateRow}>
                    {[...Array(14)].map((_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() + i);
                        const dateStr = d.toISOString().split('T')[0];
                        const isSelected = selectedDate === dateStr;
                        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                        return (
                            <TouchableOpacity
                                key={i}
                                onPress={() => setSelectedDate(dateStr)}
                                style={[
                                    styles.dateBox,
                                    { borderColor: isSelected ? theme.primary : theme.border },
                                    isSelected && { backgroundColor: theme.primary }
                                ]}
                            >
                                <Text style={[styles.dateDay, { color: isSelected ? '#FFF' : theme.textMuted }]}>{days[d.getDay()]}</Text>
                                <Text style={[styles.dateNum, { color: isSelected ? '#FFF' : theme.text }]}>{d.getDate()}</Text>
                                <Text style={[styles.dateMonth, { color: isSelected ? '#FFF' : theme.textMuted }]}>{d.toLocaleString('default', { month: 'short' })}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            <View style={[styles.card, { backgroundColor: theme.card }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Available Slots</Text>
                <View style={styles.slotsGrid}>
                    {loadingSlots ? (
                        <ActivityIndicator color={theme.primary} style={{ width: '100%', padding: 20 }} />
                    ) : !selectedService ? (
                        <Text style={{ width: '100%', textAlign: 'center', color: theme.textMuted, padding: 10 }}>Select a service first</Text>
                    ) : availableSlots.length === 0 ? (
                        <Text style={{ width: '100%', textAlign: 'center', color: theme.textMuted, padding: 10 }}>No slots available for this date</Text>
                    ) : (
                        availableSlots.map((slot, i) => {
                            const isSelected = selectedSlot?.iso === slot.iso;
                            return (
                                <TouchableOpacity
                                    key={i}
                                    onPress={() => setSelectedSlot(slot)}
                                    style={[
                                        styles.slot,
                                        { borderColor: isSelected ? theme.primary : theme.border },
                                        isSelected && { backgroundColor: theme.primary }
                                    ]}
                                >
                                    <Text style={[styles.slotText, { color: isSelected ? '#FFF' : theme.textMuted }]}>{slot.time}</Text>
                                </TouchableOpacity>
                            );
                        })
                    )}
                </View>
            </View>

        </View>
    );

    const renderReviewsTab = () => (
        <View style={styles.tabContent}>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
                <View style={styles.ratingOverview}>
                    <View>
                        <Text style={[styles.bigRating, { color: theme.text }]}>{rating > 0 ? rating.toFixed(1) : 'No Rating'}</Text>
                        <Text style={[styles.stars, { color: '#f1c40f', fontSize: 16 }]}>
                            {rating > 0 && '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating))}
                        </Text>
                        <Text style={[styles.reviewCountText, { color: theme.textMuted }]}>{reviewCount} reviews</Text>
                    </View>
                    <View style={styles.ratingBars}>
                        {[5, 4, 3, 2, 1].map(num => {
                            const found = ratingBreakdown.starBreakdown?.find(s => s.stars === num);
                            const count = found ? found.count : 0;
                            const total = ratingBreakdown.totalReviews || 1;
                            const percent = (count / total) * 100;
                            return (
                                <View key={num} style={styles.ratingBarRow}>
                                    <Text style={styles.barNum}>{num}</Text>
                                    <View style={[styles.barBg, { backgroundColor: theme.border }]}>
                                        <View style={[styles.barFill, { width: `${percent}%`, backgroundColor: theme.primary }]} />
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border + '40', marginVertical: 20 }]} />

                {fetchingReviews ? (
                    <ActivityIndicator color={theme.primary} />
                ) : reviews.length === 0 ? (
                    <Text style={{ textAlign: 'center', color: theme.textMuted }}>No reviews yet.</Text>
                ) : (
                    reviews.map((item, idx) => (
                        <View key={item._id || idx} style={styles.reviewItem}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={[styles.reviewerName, { color: theme.text }]}>{item.user?.username || 'Customer'}</Text>
                                <Text style={[styles.reviewDate, { color: theme.textMuted }]}>
                                    {formatDateTime(item.createdAt)}
                                </Text>
                            </View>
                            <Text style={{ color: '#f1c40f', marginVertical: 4 }}>
                                {'★'.repeat(item.stars) + '☆'.repeat(5 - item.stars)}
                            </Text>
                            <Text style={[styles.reviewText, { color: theme.textLight }]}>{item.comment}</Text>
                            {idx < reviews.length - 1 && (
                                <View style={[styles.divider, { backgroundColor: theme.border + '15', marginVertical: 15 }]} />
                            )}
                        </View>
                    ))
                )}
            </View>
        </View>
    );

    const renderInfoTab = () => (
        <View style={styles.tabContent}>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
                {barberData?.bio && (
                    <View style={{ marginBottom: 20 }}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>About</Text>
                        <Text style={[styles.infoValue, { color: theme.text, fontWeight: 'normal', lineHeight: 20 }]}>
                            {barberData.bio}
                        </Text>
                        <View style={[styles.divider, { backgroundColor: theme.border + '15', marginTop: 15 }]} />
                    </View>
                )}

                <Text style={[styles.sectionTitle, { color: theme.text }]}>Barber Info</Text>
                <View style={styles.infoRow}>
                    <Text style={styles.infoIcon}>📍</Text>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.infoLabel, { color: theme.textMuted }]}>{selectedServiceType === 'home' ? 'Service Area' : 'Address'}</Text>
                        <Text style={[styles.infoValue, { color: theme.text }]}>{locationName}</Text>
                    </View>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoIcon}>📞</Text>
                    <View>
                        <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Phone</Text>
                        <Text style={[styles.infoValue, { color: theme.text }]}>{phone || "+977 98XXXXXXXX"}</Text>
                    </View>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoIcon}>🕒</Text>
                    <View>
                        <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Available</Text>
                        <Text style={[styles.infoValue, { color: theme.text }]}>
                            {barberData?.availability?.[selectedServiceType]?.openTime || '9:00 AM'} – {barberData?.availability?.[selectedServiceType]?.closeTime || '7:00 PM'}
                        </Text>
                    </View>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoIcon}>🗓️</Text>
                    <View>
                        <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Days</Text>
                        <Text style={[styles.infoValue, { color: theme.text }]}>
                            {barberData?.availability?.[selectedServiceType]?.workingDays?.join(', ') || 'Mon, Tue, Wed, Thu, Fri'}
                        </Text>
                    </View>
                </View>
                {selectedServiceType === 'home' && (
                    <View style={styles.infoRow}>
                        <Text style={styles.infoIcon}>🏍️</Text>
                        <View>
                            <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Travel</Text>
                            <Text style={[styles.infoValue, { color: theme.text }]}>
                                {barberData?.pricing?.homeSurcharge ? `Rs. ${barberData.pricing.homeSurcharge} travel fee` : 'Brings all tools to you'}
                            </Text>
                        </View>
                    </View>
                )}
            </View>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: '#FDFCF8' }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={{ fontSize: 24, color: theme.text }}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>
                    {selectedServiceType === 'home' ? 'Book Home Visit' : 'Book Appointment'}
                </Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={[styles.banner, { backgroundColor: theme.primary }]}>
                    <View style={styles.typeTag}>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: theme.primary }}>
                            {selectedServiceType === 'home' ? '🏠 Home Service' : '💈 Salon Service'}
                        </Text>
                    </View>
                </View>

                <View style={styles.profileOverlap}>
                    <View style={styles.avatarWrap}>
                        <Image
                            source={image ? { uri: image } : require('../../../assets/barber.png')}
                            style={styles.avatar}
                        />
                    </View>
                    <View style={styles.nameHeader}>
                        <Text style={[styles.name, { color: theme.text }]}>{name}</Text>
                        <Text style={[styles.shop, { color: theme.textMuted }]}>
                            {selectedServiceType === 'home' ? 'Home Visits' : 'Salon Services'} • {locationName}
                        </Text>
                        <Text style={[styles.ratingSmall, { color: theme.textMuted }]}>
                            {reviewCount > 0 ? (
                                <>
                                    <Text style={{ color: '#f1c40f' }}>{'★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating))}</Text> {rating.toFixed(1)} ({reviewCount} reviews)
                                </>
                            ) : (
                                <Text style={{ color: theme.primary, fontWeight: 'bold' }}>New Barber</Text>
                            )}
                        </Text>
                    </View>
                </View>

                <View style={styles.tabs}>
                    {['Book', 'Reviews', 'Info'].map((tab) => (
                        <TouchableOpacity
                            key={tab}
                            style={[styles.tab, activeTab === tab && { borderBottomColor: theme.primary, borderBottomWidth: 3 }]}
                            onPress={() => setActiveTab(tab)}
                        >
                            <Text style={[styles.tabText, { color: activeTab === tab ? theme.primary : theme.textMuted }]}>
                                {tab === 'Book' ? '📅 Book' : tab === 'Reviews' ? '⭐ Reviews' : 'ℹ️ Info'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {activeTab === 'Book' && renderBookTab()}
                {activeTab === 'Reviews' && renderReviewsTab()}
                {activeTab === 'Info' && renderInfoTab()}

                <View style={{ height: 120 }} />
            </ScrollView>

            <View style={styles.bottomCta}>
                <TouchableOpacity
                    style={[
                        styles.confirmBtn,
                        { backgroundColor: (selectedService && selectedDate && selectedSlot) ? theme.primary : theme.border }
                    ]}
                    onPress={handleConfirmBooking}
                    disabled={!selectedService || !selectedDate || !selectedSlot}
                >
                    <Text style={styles.confirmBtnText}>
                        {(selectedService && selectedDate && selectedSlot)
                            ? 'Confirm Booking →'
                            : 'Select details to book'}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFF' },
    headerTitle: { fontSize: 17, fontWeight: 'bold' },
    banner: { height: 100, padding: 16, alignItems: 'flex-end' },
    typeTag: { backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    profileOverlap: { paddingHorizontal: 20, marginTop: -45, flexDirection: 'row', alignItems: 'flex-end' },
    avatarWrap: { position: 'relative' },
    avatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 4, borderColor: '#FFF' },
    nameHeader: { marginLeft: 16, paddingBottom: 8 },
    name: { fontSize: 22, fontWeight: 'bold' },
    shop: { fontSize: 13, marginTop: 2 },
    ratingSmall: { fontSize: 13, marginTop: 4 },
    tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EEE', backgroundColor: '#FFF', marginTop: 15 },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 14 },
    tabText: { fontWeight: '600', fontSize: 14 },
    tabContent: { padding: 16 },
    aiBanner: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 18, marginBottom: 20 },
    aiIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', elevation: 2 },
    aiTitle: { fontSize: 15, fontWeight: 'bold' },
    aiSub: { fontSize: 11, marginTop: 2 },
    homeReadyBanner: { borderRadius: 12, padding: 15, borderWidth: 1, marginBottom: 20 },
    homeReadyTitle: { fontSize: 15, fontWeight: 'bold' },
    homeReadySub: { fontSize: 12, marginTop: 2 },
    activeBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    activeText: { color: '#4CAF50', fontSize: 11, fontWeight: 'bold' },
    typeToggle: { flexDirection: 'row', backgroundColor: '#F0F0F0', borderRadius: 12, padding: 4 },
    toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
    toggleText: { fontSize: 13, fontWeight: '600' },
    card: { borderRadius: 20, padding: 20, marginBottom: 20, backgroundColor: '#FFF', elevation: 1 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 16 },
    serviceItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1 },
    serviceIconContainer: { marginRight: 15 },
    serviceInfo: { flex: 1 },
    serviceName: { fontSize: 15, fontWeight: 'bold' },
    serviceMeta: { fontSize: 12, marginTop: 2 },
    servicePrice: { fontSize: 16, fontWeight: 'bold' },
    surchargeBox: { marginTop: 15, padding: 12, borderRadius: 10, backgroundColor: '#FFF9C4' },
    surchargeText: { fontSize: 12, color: '#827717', fontWeight: 'bold' },
    inputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, borderRadius: 12, borderWidth: 1, backgroundColor: '#FFF' },
    dateRow: { flexDirection: 'row' },
    dateBox: { width: 60, height: 80, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    dateDay: { fontSize: 12 },
    dateNum: { fontSize: 20, fontWeight: 'bold', marginVertical: 2 },
    dateMonth: { fontSize: 11 },
    slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    slot: { width: '22%', height: 42, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    slotText: { fontSize: 12 },
    ratingOverview: { flexDirection: 'row', justifyContent: 'space-between' },
    bigRating: { fontSize: 44, fontWeight: 'bold' },
    reviewCountText: { fontSize: 12, marginTop: 4 },
    ratingBars: { flex: 1, marginLeft: 30 },
    ratingBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    barNum: { width: 15, fontSize: 12, color: '#999' },
    barBg: { flex: 1, height: 6, borderRadius: 3, marginHorizontal: 10 },
    barFill: { height: 6, borderRadius: 3 },
    reviewItem: { marginBottom: 20 },
    reviewerName: { fontSize: 15, fontWeight: 'bold' },
    reviewDate: { fontSize: 12 },
    reviewText: { fontSize: 14, lineHeight: 20 },
    infoRow: { flexDirection: 'row', marginBottom: 20 },
    infoIcon: { fontSize: 24, marginRight: 15, marginTop: 2 },
    infoLabel: { fontSize: 12 },
    infoValue: { fontSize: 15, fontWeight: 'bold', marginTop: 2 },
    bottomCta: { position: 'absolute', bottom: 0, width: width, padding: 20, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#EEE' },
    confirmBtn: { height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    confirmBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
    divider: { height: 1 },
});
