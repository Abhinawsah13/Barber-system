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
import { getServices, getAvailableSlots } from "../../services/api";

export default function BookingScreen({ navigation, route }) {
    const { theme } = useTheme();

    // Pull params from previous screen (BarberDetails or HomeServices)
    const {
        barberId,
        barberName,
        service,
        barber,
        serviceType: initialServiceType = 'salon',
    } = route.params || {};

    const [loading, setLoading] = useState(false);

    const mockBarberName = barberName || 'Your Barber';

    // ─── State ────────────────────────────────────────────────────────────────

    // Service type: 'salon', 'home', or 'both'
    const [serviceType, setServiceType] = useState(initialServiceType);

    // Services list — starts with the passed service, or empty while fetching
    const [services, setServices] = useState(service ? [service] : []);
    const [servicesLoading, setServicesLoading] = useState(!service); // fetch if none passed

    // Track the full selected service OBJECT (not just name) so we have a real _id
    const [selectedService, setSelectedService] = useState(service || null);

    // Customer address (needed for home service)
    const [customerAddress, setCustomerAddress] = useState('');

    // ─── Fetch services if not passed via params ──────────────────────────────
    // This happens when coming from HomeServicesScreen which doesn't pass a service
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

    // Re-fetch services if serviceType changes (to filter correctly)
    useEffect(() => {
        fetchServices();
    }, [serviceType]);

    // Generate the next 7 days for the date picker
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

    // Default to today
    const [selectedDate, setSelectedDate] = useState(dates[0]);

    // ─── Data Lists ───────────────────────────────────────────────────────────

    // Time slot selection
    const [selectedTime, setSelectedTime] = useState(null);
    const [availableSlots, setAvailableSlots] = useState([]);
    const [slotsLoading, setSlotsLoading] = useState(false);

    // ─── Fetch slots when dependencies change ────────────────────────────────
    useEffect(() => {
        if (barberId && selectedService?._id && selectedDate) {
            fetchSlots();
        }
    }, [selectedService, selectedDate, serviceType]);

    const fetchSlots = async () => {
        try {
            setSlotsLoading(true);
            const dateStr = selectedDate.fullDate.toISOString().split('T')[0];
            const result = await getAvailableSlots({
                barberId,
                serviceId: selectedService._id,
                date: dateStr,
                serviceType: serviceType
            });

            // The API returns { slots: [{time, iso, available}] } or []
            const slots = result?.slots || result || [];
            setAvailableSlots(slots);
            setSelectedTime(null); // Reset when slots change
        } catch (e) {
            console.warn('Error fetching slots:', e.message);
        } finally {
            setSlotsLoading(false);
        }
    };

    // ─── Pricing ──────────────────────────────────────────────────────────────

    const subtotal = selectedService?.price || 0;
    const taxes = 2.50;
    const total = subtotal + taxes;

    // ─── Validation ───────────────────────────────────────────────────────────

    // Book Now only enabled when all required fields are chosen AND a real service is selected
    // selectedService must have a valid _id that's not our placeholder '1'
    const hasRealService = selectedService && selectedService._id && selectedService._id !== '1';
    const canBook = serviceType && hasRealService && selectedDate && selectedTime;

    // ─── Handlers ─────────────────────────────────────────────────────────────

    // Convert "10:00 AM" display format to "10:00" for the backend
    const convertTo24Hour = (timeStr) => {
        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':');
        hours = parseInt(hours);
        if (modifier === 'PM' && hours !== 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        const hoursStr = hours < 10 ? '0' + hours : String(hours);
        return `${hoursStr}:${minutes}`;
    };

    // Navigate to confirmation screen instead of calling API directly
    // This gives the user a chance to review before confirming
    const handleBookNow = () => {
        if (!hasRealService) {
            Alert.alert('No Service Selected', 'Please wait for services to load, or select a service.');
            return;
        }
        if (!canBook) {
            Alert.alert('Missing Info', 'Please select a service type, date, and time slot.');
            return;
        }

        const now = new Date();
        // e.g. "Sun Mar 24 2024" + " " + "10:00 AM" -> "Sun Mar 24 2024 10:00 AM"
        const selectedDateTime = new Date(`${selectedDate.fullDate.toDateString()} ${selectedTime}`);

        if (selectedDateTime <= now) {
            Alert.alert("Invalid Time", "Please select a future time.");
            return;
        }

        // Navigate to BookingConfirmation which will call the API
        // selectedService._id is now a real MongoDB ObjectId from the API
        navigation.navigate('BookingConfirmation', {
            service: selectedService,          // real service object with valid _id
            barber: barber || null,
            barberId: barberId,
            barberName: mockBarberName,
            date: selectedDate.fullDate.toISOString().split('T')[0], // "YYYY-MM-DD"
            timeSlot: convertTo24Hour(selectedTime),                  // "HH:MM"
            serviceType: serviceType,
            customerAddress: customerAddress || 'Kathmandu',
        });
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>

            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.background }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                    <Text style={{ fontSize: 24, color: theme.text }}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Book Appointment</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* ── Choose Service ── */}
                <View style={[styles.cardContainer, { backgroundColor: '#FFF', borderColor: '#EEE' }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 0 }]}>Choose Service</Text>

                    {servicesLoading ? (
                        <View style={styles.serviceLoadingRow}>
                            <ActivityIndicator color={theme.primary} />
                            <Text style={[styles.serviceLoadingText, { color: theme.textLight }]}>Loading services...</Text>
                        </View>
                    ) : (() => {
                        const filteredServices = services.filter(s => s.isActive !== false);

                        if (filteredServices.length === 0) {
                            return (
                                <Text style={{ textAlign: 'center', color: theme.textMuted, padding: 20 }}>
                                    This barber hasn't added any bookable services yet.
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

                {/* ── Pick a Date ── */}
                <View style={[styles.cardContainer, { backgroundColor: '#FFF', borderColor: '#EEE' }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 0 }]}>Pick a Date</Text>

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

                {/* ── Available Slots ── */}
                <View style={[styles.cardContainer, { backgroundColor: '#FFF', borderColor: '#EEE' }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 0 }]}>Available Slots</Text>

                    <View style={styles.timeGrid}>
                        {slotsLoading ? (
                            <View style={{ width: '100%', padding: 20, alignItems: 'center' }}>
                                <ActivityIndicator color={theme.primary} />
                                <Text style={{ color: theme.textMuted, marginTop: 8 }}>Checking availability...</Text>
                            </View>
                        ) : availableSlots.length === 0 ? (
                            <Text style={{ color: theme.textMuted, padding: 10, textAlign: 'center', width: '100%' }}>
                                No slots available for this date.
                            </Text>
                        ) : (
                            availableSlots.map((slot, i) => {
                                const isSelected = slot.time === selectedTime;

                                const now = new Date();
                                const slotDateTime = new Date(`${selectedDate.fullDate.toDateString()} ${slot.time}`);
                                const isPast = slotDateTime <= now;

                                const isBooked = !slot.available || isPast;
                                return (
                                    <TouchableOpacity
                                        key={i}
                                        style={[
                                            styles.mockupTimeSlot,
                                            isSelected && styles.mockupTimeSlotSelected,
                                            isBooked && styles.mockupTimeSlotBooked
                                        ]}
                                        onPress={() => setSelectedTime(slot.time)}
                                        activeOpacity={0.8}
                                        disabled={isBooked}
                                    >
                                        <Text style={[
                                            styles.mockupTimeText,
                                            isSelected && styles.mockupTimeTextSelected,
                                            isBooked && styles.mockupTimeTextBooked
                                        ]}>
                                            {slot.time}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </View>

                    {/* Slot Legend */}
                    <View style={styles.legendRow}>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendBox, { backgroundColor: '#FFF', borderColor: '#EAEAEA', borderWidth: 1 }]} />
                            <Text style={styles.legendText}>Available</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendBox, { backgroundColor: '#B39DDB' }]} />
                            <Text style={styles.legendText}>Selected</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={{ width: 14, height: 2, backgroundColor: '#E0E0E0', marginRight: 4 }} />
                            <Text style={styles.legendText}>Booked</Text>
                        </View>
                    </View>
                </View>

                <View style={{ height: 20 }} />

                {/* ── Confirm Booking Button ── */}
                <TouchableOpacity
                    style={[
                        styles.mockupConfirmBtn,
                        { backgroundColor: canBook ? '#C2B6D4' : '#E0E0E0' }
                    ]}
                    onPress={handleBookNow}
                    disabled={loading || !canBook}
                    activeOpacity={0.85}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={[styles.mockupConfirmBtnText, { color: canBook ? '#FFF' : '#A0A0A0' }]}>
                            {canBook ? 'Confirm Booking →' : 'Select Service & Time'}
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
    mockupTimeTextBooked: { color: '#BDBDBD', textDecorationLine: 'line-through' },
    
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
