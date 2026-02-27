import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    Alert
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useTheme } from '../../context/ThemeContext';

export default function CalendarScreen({ navigation, route }) {
    const { theme } = useTheme();
    const [selectedDate, setSelectedDate] = useState('');
    const [markedDates, setMarkedDates] = useState({});

    const onDayPress = (day) => {
        setSelectedDate(day.dateString);
        setMarkedDates({
            [day.dateString]: {
                selected: true,
                disableTouchEvent: true,
                selectedDotColor: 'orange',
                selectedColor: theme.primary,
            },
        });
    };

    const handleContinue = () => {
        if (!selectedDate) {
            Alert.alert('Selection Required', 'Please select a date from the calendar.');
            return;
        }

        // Return to the previous screen with the selected date
        const fromScreen = route.params?.fromScreen || 'Home';
        navigation.navigate(fromScreen, {
            returnedDate: selectedDate,
            serviceType: route.params?.serviceType
        });
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={[styles.backText, { color: theme.text }]}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Select Date</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.calendarContainer}>
                    <Calendar
                        onDayPress={onDayPress}
                        markedDates={markedDates}
                        theme={{
                            backgroundColor: theme.card,
                            calendarBackground: theme.card,
                            textSectionTitleColor: theme.textLight,
                            selectedDayBackgroundColor: theme.primary,
                            selectedDayTextColor: '#ffffff',
                            todayTextColor: theme.primary,
                            dayTextColor: theme.text,
                            textDisabledColor: theme.border,
                            dotColor: theme.primary,
                            selectedDotColor: '#ffffff',
                            arrowColor: theme.primary,
                            monthTextColor: theme.text,
                            indicatorColor: theme.primary,
                            textDayFontWeight: '300',
                            textMonthFontWeight: 'bold',
                            textDayHeaderFontWeight: '300',
                            textDayFontSize: 16,
                            textMonthFontSize: 18,
                            textDayHeaderFontSize: 14
                        }}
                        minDate={new Date().toISOString().split('T')[0]}
                    />
                </View>

                <View style={styles.infoSection}>
                    <Text style={[styles.infoTitle, { color: theme.text }]}>Selected Date</Text>
                    <Text style={[styles.infoText, { color: theme.textLight }]}>
                        {selectedDate ? new Date(selectedDate).toDateString() : 'No date selected'}
                    </Text>
                </View>

                <TouchableOpacity
                    style={[
                        styles.bookBtn,
                        { backgroundColor: selectedDate ? theme.primary : theme.border }
                    ]}
                    onPress={handleContinue}
                    disabled={!selectedDate}
                >
                    <Text style={[styles.bookBtnText, { color: selectedDate ? '#FFF' : theme.textLight }]}>Book Now</Text>
                </TouchableOpacity>
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
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    backButton: {
        padding: 5,
    },
    backText: {
        fontSize: 24,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    calendarContainer: {
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        marginBottom: 30,
    },
    infoSection: {
        marginBottom: 40,
        alignItems: 'center',
    },
    infoTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    infoText: {
        fontSize: 16,
    },
    bookBtn: {
        paddingVertical: 18,
        borderRadius: 15,
        alignItems: 'center',
        marginBottom: 20,
    },
    bookBtnText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
