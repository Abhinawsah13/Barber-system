// screens/customer/DateTimePickerScreen.js
// This screen lets the customer pick a date and time slot for their booking
// Uses react-native-calendars for the calendar UI
// Install: npx expo install react-native-calendars

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { useTheme } from '../../context/ThemeContext';
import { getAvailableSlots } from '../../services/api';

// Helper: convert date to YYYY-MM-DD string format the calendar understands
function getFormattedDate(dateObj) {
    return dateObj.toISOString().split('T')[0];
}

export default function DateTimePickerScreen({ navigation, route }) {
    const { theme } = useTheme();

    // Pull the barber and service info passed from the previous screen
    const { service, barber, barberId, barberName } = route.params || {};

    // Start with today's date selected by default
    const today = getFormattedDate(new Date());
    const [selectedDate, setSelectedDate] = useState(today);

    // Slots fetched from backend for chosen date
    const [availableSlots, setAvailableSlots] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [pickedSlot, setPickedSlot] = useState(null); // the slot the user taps

    // Fetch time slots whenever the date changes
    useEffect(() => {
        loadSlotsForDate(selectedDate);
    }, [selectedDate]);

    const loadSlotsForDate = async (date) => {
        // Don't bother fetching if we don't have the necessary info
        if (!barberId || !service?._id) return;

        setLoadingSlots(true);
        setPickedSlot(null); // reset selection when date changes

        try {
            const result = await getAvailableSlots({
                barberId,
                serviceId: service._id,
                date,
            });
            setAvailableSlots(result.slots || []);
        } catch (err) {
            console.log('Error loading slots:', err.message);
            Alert.alert('Error', 'Could not load available time slots. Please try again.');
            setAvailableSlots([]);
        } finally {
            setLoadingSlots(false);
        }
    };

    const handleDayPress = (day) => {
        setSelectedDate(day.dateString);
    };

    const handleConfirm = () => {
        if (!pickedSlot) {
            Alert.alert('Select Time', 'Please pick a time slot before continuing.');
            return;
        }

        // Navigate to confirm screen with all booking details
        navigation.navigate('BookingConfirmation', {
            service,
            barber,
            barberId,
            barberName,
            date: selectedDate,
            timeSlot: pickedSlot.time,
            timeSlotISO: pickedSlot.iso,
        });
    };

    // Build the marked dates object for the calendar component
    // (only the selected date needs to be highlighted)
    const markedDates = {
        [selectedDate]: {
            selected: true,
            selectedColor: theme.primary,
        },
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>

            {/* Header with back button */}
            <View style={[styles.header, { backgroundColor: theme.background }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={{ fontSize: 24, color: theme.text }}>←</Text>
                </TouchableOpacity>

                <View>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Pick Date & Time</Text>
                    {/* Show barber name if it was passed */}
                    {barberName ? (
                        <Text style={[styles.headerSub, { color: theme.primary }]}>
                            with {barberName}
                        </Text>
                    ) : null}
                </View>

                {/* Empty view just to center the title */}
                <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* Calendar */}
                <View style={[styles.calendarCard, { backgroundColor: theme.card }]}>
                    <Calendar
                        current={selectedDate}
                        minDate={today}
                        onDayPress={handleDayPress}
                        markedDates={markedDates}
                        enableSwipeMonths
                        theme={{
                            backgroundColor: 'transparent',
                            calendarBackground: 'transparent',
                            textSectionTitleColor: theme.textMuted,
                            selectedDayBackgroundColor: theme.primary,
                            selectedDayTextColor: '#ffffff',
                            todayTextColor: theme.primary,
                            dayTextColor: theme.text,
                            textDisabledColor: theme.border,
                            dotColor: theme.primary,
                            arrowColor: theme.primary,
                            monthTextColor: theme.text,
                            textDayFontSize: 14,
                            textMonthFontSize: 16,
                            textMonthFontWeight: '700',
                            textDayHeaderFontSize: 13,
                        }}
                    />
                </View>

                {/* Show service summary so the user doesn't forget what they picked */}
                {service ? (
                    <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Service</Text>
                        <Text style={[styles.summaryValue, { color: theme.text }]}>
                            {service.name} · {service.duration_minutes} min · Rs {service.price}
                        </Text>
                    </View>
                ) : null}

                {/* Time slot section */}
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Available Slots</Text>

                {loadingSlots ? (
                    <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 20 }} />
                ) : availableSlots.length === 0 ? (
                    <View style={styles.noSlotsBox}>
                        <Text style={{ fontSize: 32 }}>🚫</Text>
                        <Text style={[styles.noSlotsText, { color: theme.textLight }]}>
                            No slots available on this date
                        </Text>
                        <Text style={[styles.noSlotsSub, { color: theme.textMuted }]}>
                            The barber may be off or fully booked
                        </Text>
                    </View>
                ) : (
                    <View style={styles.slotsGrid}>
                        {availableSlots.map((slot) => {
                            const isSelected = pickedSlot?.iso === slot.iso;
                            return (
                                <TouchableOpacity
                                    key={slot.iso}
                                    activeOpacity={0.8}
                                    onPress={() => setPickedSlot(slot)}
                                    style={[
                                        styles.slotBtn,
                                        { backgroundColor: theme.card, borderColor: theme.border },
                                        isSelected && { backgroundColor: theme.primary, borderColor: theme.primary },
                                    ]}
                                >
                                    <Text style={[
                                        styles.slotTime,
                                        { color: theme.textMuted },
                                        isSelected && { color: '#FFF', fontWeight: '700' },
                                    ]}>
                                        {slot.time}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* Extra space at bottom so content isn't hidden behind the footer bar */}
                <View style={{ height: 120 }} />
            </ScrollView>

            {/* Bottom bar showing selection summary + confirm button */}
            <View style={[styles.bottomBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
                <View style={styles.bottomInfo}>
                    <Text style={[styles.bottomDate, { color: theme.text }]}>
                        📅 {new Date(selectedDate).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                        })}
                    </Text>
                    <Text style={[styles.bottomTime, { color: theme.primary }]}>
                        {pickedSlot ? `⏰ ${pickedSlot.time}` : 'No time selected'}
                    </Text>
                </View>

                <TouchableOpacity
                    style={[
                        styles.confirmBtn,
                        { backgroundColor: pickedSlot ? theme.primary : theme.border },
                    ]}
                    onPress={handleConfirm}
                    disabled={!pickedSlot}
                >
                    <Text style={styles.confirmBtnText}>Confirm →</Text>
                </TouchableOpacity>
            </View>

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
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    backBtn: {
        padding: 6,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
    },
    headerSub: {
        fontSize: 12,
        textAlign: 'center',
        marginTop: 2,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 8,
    },
    calendarCard: {
        borderRadius: 20,
        padding: 8,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 4,
    },
    summaryCard: {
        borderRadius: 14,
        padding: 14,
        marginBottom: 20,
        borderWidth: 1,
    },
    summaryLabel: {
        fontSize: 12,
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '600',
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '700',
        marginBottom: 14,
    },
    noSlotsBox: {
        alignItems: 'center',
        paddingVertical: 40,
        gap: 8,
    },
    noSlotsText: {
        fontSize: 15,
        fontWeight: '600',
    },
    noSlotsSub: {
        fontSize: 13,
    },
    slotsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -6,
    },
    slotBtn: {
        width: '30%',
        marginHorizontal: '1.5%',
        marginBottom: 10,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    slotTime: {
        fontSize: 13,
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderTopWidth: 1,
    },
    bottomInfo: {
        flex: 1,
        marginRight: 12,
    },
    bottomDate: {
        fontSize: 14,
        fontWeight: '600',
    },
    bottomTime: {
        fontSize: 13,
        marginTop: 4,
    },
    confirmBtn: {
        paddingHorizontal: 22,
        paddingVertical: 13,
        borderRadius: 12,
    },
    confirmBtnText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '700',
    },
});
