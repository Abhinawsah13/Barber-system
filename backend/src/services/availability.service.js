// services/availability.service.js
// This file handles figuring out which time slots are available for a barber on a given date
// The main function takes barberId, service duration, and date — and returns a list of open slots

import Booking from '../models/Booking.js';
import BarberProfile from '../models/BarberProfile.js';

// Days in order matching JS Date.getDay() (0 = Sunday, 6 = Saturday)
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Convert a "HH:MM" time string to total minutes from midnight
// e.g. "09:30" → 570
function timeStringToMinutes(timeStr) {
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    return hours * 60 + minutes;
}

// Convert minutes from midnight back to "HH:MM" string
// e.g. 570 → "09:30"
function minutesToTimeString(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    // Pad with leading zero so it's always HH:MM format
    const hoursStr = hours.toString().padStart(2, '0');
    const minsStr = mins.toString().padStart(2, '0');

    return `${hoursStr}:${minsStr}`;
}

// Build a full ISO date-time string from a date string and a time string
// e.g. ("2026-02-22", "10:00") → "2026-02-22T10:00:00.000Z"
function buildISODateTime(dateStr, timeStr) {
    return new Date(`${dateStr}T${timeStr}:00.000Z`).toISOString();
}

// Generate all available time slots within a working window
// Skips slots that overlap with breaks or existing bookings
function generateAvailableSlots(startMinutes, endMinutes, slotDuration, breakRanges, bookedRanges, dateStr) {
    const slots = [];

    // Get the current time in minutes so we can skip past slots if today is selected
    const now = new Date();
    const currentTimeInMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const todayDateStr = now.toISOString().split('T')[0];
    const isRequestedDateToday = dateStr === todayDateStr;

    let currentSlotStart = startMinutes;

    // Walk through the day slot by slot until we run out of working time
    while (currentSlotStart + slotDuration <= endMinutes) {
        const currentSlotEnd = currentSlotStart + slotDuration;

        // Skip slots that are already in the past (only matters if the date is today)
        if (isRequestedDateToday && currentSlotStart < currentTimeInMinutes) {
            currentSlotStart += slotDuration;
            continue;
        }

        // Check if this slot falls inside any break period
        let slotOverlapsBreak = false;
        for (let i = 0; i < breakRanges.length; i++) {
            const breakStart = breakRanges[i].start;
            const breakEnd = breakRanges[i].end;
            if (currentSlotStart < breakEnd && currentSlotEnd > breakStart) {
                slotOverlapsBreak = true;
                break;
            }
        }

        // Check if this slot conflicts with an already booked appointment
        let slotIsBooked = false;
        for (let i = 0; i < bookedRanges.length; i++) {
            const bookingStart = bookedRanges[i].start;
            const bookingEnd = bookedRanges[i].end;
            if (currentSlotStart < bookingEnd && currentSlotEnd > bookingStart) {
                slotIsBooked = true;
                break;
            }
        }

        // Only add the slot if it's free from breaks and existing bookings
        if (!slotOverlapsBreak && !slotIsBooked) {
            const timeStr = minutesToTimeString(currentSlotStart);
            slots.push({
                time: timeStr,
                iso: buildISODateTime(dateStr, timeStr),
                available: true,
            });
        }

        // Move to the next potential slot
        currentSlotStart += slotDuration;
    }

    return slots;
}

// Main function: returns available slots for a barber on a given date
// barberId: the barber's user ID
// serviceDurationMinutes: how long the selected service takes
// dateStr: "YYYY-MM-DD" format
// serviceType: "salon" or "home"
export const getAvailableSlots = async (barberId, serviceDurationMinutes, dateStr, serviceType = 'salon') => {

    // Step 1: Load the barber's profile to get their working schedule
    const barberProfile = await BarberProfile.findOne({ user: barberId }).lean();

    if (!barberProfile) {
        throw new Error('Barber profile not found');
    }

    // Step 2: Check if barber offers this service mode and is active
    const mode = serviceType === 'home' ? 'home' : 'salon';
    const isModeEnabled = barberProfile.serviceModes?.[mode];
    const config = barberProfile.availability?.[mode];

    if (!isModeEnabled || !config || !config.isActive) {
        return [];
    }

    // Step 3: Figure out what day of the week the requested date is
    const dayIndex = new Date(dateStr).getDay();
    const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = DAYS_SHORT[dayIndex];

    // Check if the barber works on this day
    if (!config.workingDays || !config.workingDays.includes(dayName)) {
        return [];
    }

    // Step 4: Get working window
    const workStartMinutes = timeStringToMinutes(config.openTime || "09:00");
    const workEndMinutes = timeStringToMinutes(config.closeTime || "19:00");

    // Step 5: Get all existing bookings for this barber on this date
    const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);

    const existingBookings = await Booking.find({
        barber: barberId,
        date: { $gte: dayStart, $lte: dayEnd },
        // Don't count cancelled bookings as blocking time
        status: { $nin: ['cancelled_by_customer', 'cancelled_by_barber'] },
    })
        .populate('service', 'duration_minutes')
        .lean();

    // Step 6: Convert existing bookings into minute ranges so we can check for overlaps
    const blockedRanges = [];

    for (let i = 0; i < existingBookings.length; i++) {
        const booking = existingBookings[i];
        const bookingStartMinutes = timeStringToMinutes(booking.time_slot);

        const bookingDuration = booking.service
            ? booking.service.duration_minutes
            : serviceDurationMinutes;

        blockedRanges.push({
            start: bookingStartMinutes,
            end: bookingStartMinutes + bookingDuration,
        });
    }

    // Step 7: Generate and return the open slots
    // Break ranges are empty for now — can add break support by extending BarberProfile schema
    const breakRanges = [];

    const openSlots = generateAvailableSlots(
        workStartMinutes,
        workEndMinutes,
        serviceDurationMinutes,
        breakRanges,
        blockedRanges,
        dateStr
    );

    return openSlots;
};

// Export the helper functions too in case other parts of the code need them
export { timeStringToMinutes, minutesToTimeString, buildISODateTime, generateAvailableSlots };
