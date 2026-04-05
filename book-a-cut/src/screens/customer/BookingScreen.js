import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Image,
    ActivityIndicator,
    TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageProvider";
import { getServices, getAvailableSlots } from "../../services/api";

export default function BookingScreen({ navigation, route }) {
    const { theme } = useTheme();
    const { t } = useLanguage();

    const {
        barberId,
        barberName,
        service,
        barber,
        serviceType: initialServiceType = 'salon',
    } = route.params || {};

    const [loading, setLoading] = useState(false);
    const mockBarberName = barberName || 'Your Barber';

    const [serviceType, setServiceType] = useState(initialServiceType);
    const [services, setServices] = useState(service ? [service] : []);
    const [servicesLoading, setServicesLoading] = useState(!service); 
    const [selectedService, setSelectedService] = useState(service || null);
    const [customerAddress, setCustomerAddress] = useState('');

    useEffect(() => {
        if (!service) {
            fetchServices();
        }
    }, []);

    const fetchServices = async () => {
        try {
            setServicesLoading(true);
            const params = {
                barberId,
                serviceType: serviceType
            };
            const result = await getServices(params);
            const list = result?.data || result || [];

            if (list.length > 0) {
                setServices(list);
                setSelectedService(list[0]);
            } else {
                setServices([]);
                setSelectedService(null);
            }
        } catch (e) {
            console.warn('Could not load services:', e.message);
        } finally {
            setServicesLoading(false);
        }
    };

    useEffect(() => {
        fetchServices();
    }, [serviceType]);

    const generateDates = () => {
        const days = [];
        const today = new Date();
        const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            days.push({
                day: daysOfWeek[date.getDay()],
                date: date.getDate(),
                month: months[date.getMonth()],
                fullDate: date,
            });
        }
        return days;
    };

    const dates = generateDates();
    const [selectedDate, setSelectedDate] = useState(dates[0]);
    const [selectedTime, setSelectedTime] = useState(null);
    const [availableSlots, setAvailableSlots] = useState([]);
    const [slotsLoading, setSlotsLoading] = useState(false);
    // ✅ Tracks whether the selected slot is already booked (show error, keep slot visible)
    const [bookedSlotError, setBookedSlotError] = useState(false);

    useEffect(() => {
        if (barberId && selectedService?._id && selectedDate) {
            fetchSlots();
        }
    }, [selectedService, selectedDate, serviceType]);

    const fetchSlots = async () => {
        try {
            setSlotsLoading(true);
            setBookedSlotError(false); // reset error on re-fetch
            const dateStr = selectedDate.fullDate.toISOString().split('T')[0];
            const result = await getAvailableSlots({
                barberId,
                serviceId: selectedService._id,
                date: dateStr,
                serviceType: serviceType
            });

            const slots = result?.slots || result || [];
            setAvailableSlots(slots);
            setSelectedTime(null);
        } catch (e) {
            console.warn('Error fetching slots:', e.message);
        } finally {
            setSlotsLoading(false);
        }
    };

    const hasRealService = selectedService && selectedService._id && selectedService._id !== '1';
    const canBook = serviceType && hasRealService && selectedDate && selectedTime;

    const convertTo24Hour = (timeStr) => {
        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':');
        hours = parseInt(hours);
        if (modifier === 'PM' && hours !== 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        const hoursStr = hours < 10 ? '0' + hours : String(hours);
        return `${hoursStr}:${minutes}`;
    };

    const handleBookNow = () => {
        if (!hasRealService) {
            Alert.alert('No Service Selected', 'Please wait for services to load.');
            return;
        }
        if (!canBook) {
            Alert.alert('Missing Info', t('select_service_time'));
            return;
        }

        // ✅ Block booking if the selected slot is already booked
        if (bookedSlotError) {
            Alert.alert(
                'Slot Already Booked',
                'This time slot is already booked. Please select a different time.',
            );
            return;
        }

        const now = new Date();
        const selectedDateTime = new Date(`${selectedDate.fullDate.toDateString()} ${selectedTime}`);

        if (selectedDateTime <= now) {
            Alert.alert("Invalid Time", t('invalid_time'));
            return;
        }

        navigation.navigate('BookingConfirmation', {
            service: selectedService,
            barber: barber || null,
            barberId: barberId,
            barberName: mockBarberName,
            date: selectedDate.fullDate.toISOString().split('T')[0],
            timeSlot: convertTo24Hour(selectedTime),
            serviceType: serviceType,
            customerAddress: customerAddress || 'Kathmandu',
        });
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { backgroundColor: theme.background }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                    <Text style={{ fontSize: 24, color: theme.text }}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>{t('book_appointment')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={[styles.cardContainer, { backgroundColor: '#FFF', borderColor: '#EEE' }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 0 }]}>{t('choose_service')}</Text>

                    {servicesLoading ? (
                        <View style={styles.serviceLoadingRow}>
                            <ActivityIndicator color={theme.primary} />
                            <Text style={[styles.serviceLoadingText, { color: theme.textLight }]}>{t('loading_services')}</Text>
                        </View>
                    ) : (() => {
                        const filteredServices = services.filter(s => s.isActive !== false);

                        if (filteredServices.length === 0) {
                            return (
                                <Text style={{ textAlign: 'center', color: theme.textMuted, padding: 20 }}>
                                    No bookable services found.
                                </Text>
                            );
                        }

                        return filteredServices.map((s, index) => {
                            const isSelected = selectedService?._id === s._id;
                            const icons = ['💈', '✂️', '🧔', '⭐', '🪒'];
                            const icon = icons[index % icons.length];
                            
                            return (
                                <TouchableOpacity
                                    key={s._id || index}
                                    style={[
                                        styles.mockupServiceCard,
                                        { borderColor: isSelected ? theme.primary : '#EAEAEA' },
                                        isSelected && { backgroundColor: theme.primary + '0A' }
                                    ]}
                                    onPress={() => setSelectedService(s)}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.mockupServiceLeft}>
                                        <Text style={{ fontSize: 24, marginRight: 15 }}>{icon}</Text>
                                        <View>
                                            <Text style={[styles.mockupServiceName, { color: theme.text }]}>{s.name}</Text>
                                            <Text style={styles.mockupServiceTime}>🕑 {s.duration_minutes || 30} min</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.mockupServicePrice}>Rs. {s.price || 500}</Text>
                                </TouchableOpacity>
                            );
                        });
                    })()}
                </View>

                <View style={[styles.cardContainer, { backgroundColor: '#FFF', borderColor: '#EEE' }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 0 }]}>{t('pick_a_date')}</Text>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingBottom: 5 }}>
                        {dates.map((d, i) => {
                            const isSelected = selectedDate.date === d.date;
                            return (
                                <TouchableOpacity
                                    key={i}
                                    style={[
                                        styles.mockupDateBox,
                                        isSelected && { borderColor: theme.text, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 5, elevation: 2 }
                                    ]}
                                    onPress={() => {
                                        setSelectedDate(d);
                                        setSelectedTime(null);
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.mockupDateDay, { color: isSelected ? theme.text : '#A0A0A0' }]}>{d.day}</Text>
                                    <Text style={[styles.mockupDateNum, { color: isSelected ? theme.text : theme.text }]}>{d.date}</Text>
                                    <Text style={[styles.mockupDateMonth, { color: isSelected ? theme.text : '#A0A0A0' }]}>{d.month}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                <View style={[styles.cardContainer, { backgroundColor: '#FFF', borderColor: '#EEE' }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 0 }]}>{t('available_slots')}</Text>

                    <View style={styles.timeGrid}>
                        {slotsLoading ? (
                            <View style={{ width: '100%', padding: 20, alignItems: 'center' }}>
                                <ActivityIndicator color={theme.primary} />
                                <Text style={{ color: theme.textMuted, marginTop: 8 }}>{t('checking_availability')}</Text>
                            </View>
                        ) : availableSlots.length === 0 ? (
                            <Text style={{ color: theme.textMuted, padding: 10, textAlign: 'center', width: '100%' }}>
                                {t('no_slots_available')}
                            </Text>
                        ) : (
                            availableSlots.map((slot, i) => {
                                const isSelected = slot.time === selectedTime;

                                const now = new Date();
                                const slotDateTime = new Date(`${selectedDate.fullDate.toDateString()} ${slot.time}`);
                                const isPast = slotDateTime <= now;

                                // ✅ isBooked = slot not available per API (already taken by someone)
                                // isPast = time has passed — these remain permanently disabled
                                const isBooked = !slot.available && !isPast;

                                return (
                                    <TouchableOpacity
                                        key={i}
                                        style={[
                                            styles.mockupTimeSlot,
                                            isSelected && !isBooked && styles.mockupTimeSlotSelected,
                                            isBooked && styles.mockupTimeSlotBooked,
                                            isPast && styles.mockupTimeSlotPast,
                                        ]}
                                        onPress={() => {
                                            if (isPast) return; // hard block for past times
                                            setSelectedTime(slot.time);
                                            // ✅ Show error banner inline if slot is already booked
                                            setBookedSlotError(isBooked);
                                        }}
                                        activeOpacity={isPast ? 1 : 0.8}
                                        disabled={isPast}
                                    >
                                        <Text style={[
                                            styles.mockupTimeText,
                                            isSelected && !isBooked && styles.mockupTimeTextSelected,
                                            isBooked && styles.mockupTimeTextBooked,
                                            isPast && styles.mockupTimeTextPast,
                                        ]}>
                                            {slot.time}
                                        </Text>
                                        {/* ✅ Booked indicator badge */}
                                        {isBooked && (
                                            <Text style={styles.mockupTimeSlotBadge}>Booked</Text>
                                        )}
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </View>

                    {/* ✅ Inline error banner — shown when user selects an already-booked slot */}
                    {bookedSlotError && (
                        <View style={styles.slotErrorBanner}>
                            <Text style={styles.slotErrorIcon}>🚫</Text>
                            <Text style={styles.slotErrorText}>
                                This time slot is already booked. Please select another time.
                            </Text>
                        </View>
                    )}

                    <View style={styles.legendRow}>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendBox, { backgroundColor: '#FFF', borderColor: '#EAEAEA', borderWidth: 1 }]} />
                            <Text style={styles.legendText}>{t('available')}</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendBox, { backgroundColor: '#B39DDB' }]} />
                            <Text style={styles.legendText}>{t('selected')}</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={{ width: 14, height: 2, backgroundColor: '#E0E0E0', marginRight: 4 }} />
                            <Text style={styles.legendText}>{t('booked')}</Text>
                        </View>
                    </View>
                </View>

                <View style={{ height: 20 }} />

                <TouchableOpacity
                    style={[
                        styles.mockupConfirmBtn,
                        { backgroundColor: (canBook && !bookedSlotError) ? '#C2B6D4' : '#E0E0E0' }
                    ]}
                    onPress={handleBookNow}
                    disabled={loading || !canBook || bookedSlotError}
                    activeOpacity={0.85}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={[styles.mockupConfirmBtnText, { color: (canBook && !bookedSlotError) ? '#FFF' : '#A0A0A0' }]}>
                            {canBook && !bookedSlotError ? `${t('confirm_booking')} →` : t('select_service_time')}
                        </Text>
                    )}
                </TouchableOpacity>
                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView >
    );
}



const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    iconBtn: { padding: 5 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        marginTop: 20,
    },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 20, marginBottom: 15 },
    cardContainer: {
        borderRadius: 16,
        padding: 15,
        borderWidth: 1,
        marginBottom: 15,
        shadowColor: "transparent",
    },

    // Mockup Service Cards
    mockupServiceCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 12,
        backgroundColor: '#FFF'
    },
    mockupServiceLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    mockupServiceName: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    mockupServiceTime: {
        fontSize: 12,
        color: '#A0A0A0'
    },
    mockupServicePrice: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#673AB7' // Purple from mockup
    },

    // Mockup Dates
    mockupDateBox: {
        width: 60,
        height: 75,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#EAEAEA',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
        backgroundColor: '#FFF'
    },
    mockupDateDay: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
    mockupDateNum: { fontSize: 18, fontWeight: 'bold', marginBottom: 2 },
    mockupDateMonth: { fontSize: 10, fontWeight: '500' },

    // Mockup Time Grid
    timeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 15,
    },
    mockupTimeSlot: {
        width: '30%',
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#EAEAEA',
        alignItems: 'center',
        backgroundColor: '#FFF'
    },
    mockupTimeSlotSelected: {
        backgroundColor: '#C2B6D4',
        borderColor: '#C2B6D4',
    },
    mockupTimeSlotBooked: {
        backgroundColor: '#F5F5F5',
        borderColor: '#EAEAEA',
    },
    mockupTimeText: { fontSize: 13, fontWeight: '600', color: '#333' },
    mockupTimeTextSelected: { color: '#FFF' },
    mockupTimeTextBooked: { color: '#BDBDBD' },
    mockupTimeTextPast: { color: '#C8C8C8', textDecorationLine: 'line-through' },

    // ✅ Booked slot styles — distinct from past/selected
    mockupTimeSlotBooked: {
        backgroundColor: '#FFF3F3',
        borderColor: '#FFCDD2',
        borderStyle: 'dashed',
    },
    mockupTimeSlotPast: {
        backgroundColor: '#F5F5F5',
        borderColor: '#EAEAEA',
        opacity: 0.5,
    },
    mockupTimeSlotBadge: {
        fontSize: 9,
        color: '#EF5350',
        fontWeight: '700',
        marginTop: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    // ✅ Inline error banner for booked slot selection
    slotErrorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFEBEE',
        borderRadius: 10,
        padding: 12,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#FFCDD2',
        gap: 8,
    },
    slotErrorIcon: { fontSize: 16 },
    slotErrorText: {
        flex: 1,
        color: '#C62828',
        fontSize: 13,
        fontWeight: '600',
        lineHeight: 18,
    },
    
    // Legend
    legendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
    legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 15 },
    legendBox: { width: 12, height: 12, borderRadius: 2, marginRight: 6 },
    legendText: { fontSize: 11, color: '#888' },

    // Mockup Book Button
    mockupConfirmBtn: {
        width: '100%',
        height: 56,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
    },
    mockupConfirmBtnText: {
        fontSize: 16,
        fontWeight: 'bold',
    }
});
