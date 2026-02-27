// services/api.js
// All API calls to the backend go through here
// Makes it easier to change the base URL in one place

import { getToken } from './TokenManager';

import { API_BASE_URL } from '../config/server';

// IP is defined ONCE in src/config/server.js - change it there, not here
const BASE_URL = API_BASE_URL;

// How long to wait for a response before giving up (30 seconds)
const REQUEST_TIMEOUT_MS = 30000;

// Helper: print what request is being made (useful during debugging)
function logRequest(url, method, body) {
    console.log(`[API] ${method} ${url}`);
    if (body) {
        console.log('[API] Body:', JSON.stringify(body).substring(0, 100) + '...');
    }
}

// Helper: build the headers object
// If a token is passed, add it as Authorization header
function buildHeaders(token) {
    const headers = {
        'Content-Type': 'application/json',
        'bypass-tunnel-reminder': 'true', // needed when using tunnel
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
}

// Helper: fetch with a timeout so the app doesn't hang forever
async function fetchWithTimeout(url, options) {
    const controller = new AbortController();

    // Set a timer to cancel the request after 30 seconds
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        // Give a friendly error message instead of the default abort error
        if (error.name === 'AbortError') {
            throw new Error('Request timed out. Please check your connection.');
        }
        throw error;
    }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const loginUser = async (email, password) => {
    try {
        const url = `${BASE_URL}/auth/login`;
        logRequest(url, 'POST', { email, password });

        const response = await fetch(url, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify({ email, password }),
        });

        // Parse as text first because sometimes the server returns non-JSON on errors
        const responseText = await response.text();
        let data;

        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.log('[API] Server returned non-JSON response:', responseText);
            throw new Error(`Server Error: ${responseText.substring(0, 100)}`);
        }

        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }

        return data;
    } catch (error) {
        throw error;
    }
};

export const registerUser = async (userData) => {
    try {
        const url = `${BASE_URL}/auth/register`;
        logRequest(url, 'POST', userData);

        const response = await fetch(url, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify({
                username: userData.name,
                email: userData.email,
                phone: userData.phone,
                password: userData.password,
                user_type: userData.role,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
        }

        return data;
    } catch (error) {
        throw error;
    }
};

export const getProfile = async () => {
    try {
        const url = `${BASE_URL}/auth/profile`;
        const token = await getToken();
        logRequest(url, 'GET');

        const response = await fetch(url, {
            method: 'GET',
            headers: buildHeaders(token),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        return data.data.user;
    } catch (error) {
        console.error('Error fetching profile:', error);
        return null;
    }
};

export const updateUserProfile = async (profileData) => {
    try {
        const url = `${BASE_URL}/auth/profile`;
        const token = await getToken();
        logRequest(url, 'PUT', profileData);

        const response = await fetch(url, {
            method: 'PUT',
            headers: buildHeaders(token),
            body: JSON.stringify(profileData),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        return data;
    } catch (error) {
        throw error;
    }
};

export const verifyEmail = async (email, code) => {
    try {
        const url = `${BASE_URL}/auth/verify-email`;
        logRequest(url, 'POST', { email, code });

        const response = await fetch(url, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify({ email, code }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        return data;
    } catch (error) {
        throw error;
    }
};

export const resendVerification = async (email) => {
    try {
        const url = `${BASE_URL}/auth/resend-verification`;
        logRequest(url, 'POST', { email });

        const response = await fetch(url, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        return data;
    } catch (error) {
        throw error;
    }
};

export const resendOtp = async (email, type) => {
    try {
        const url = `${BASE_URL}/auth/resend-otp`;
        logRequest(url, 'POST', { email, type });

        const response = await fetch(url, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify({ email, type }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        return data;
    } catch (error) {
        throw error;
    }
};

export const forgotPassword = async (email) => {
    try {
        const url = `${BASE_URL}/auth/forgot-password`;
        logRequest(url, 'POST', { email });

        const response = await fetch(url, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        return data;
    } catch (error) {
        throw error;
    }
};

export const verifyResetCode = async (email, code) => {
    try {
        const url = `${BASE_URL}/auth/verify-reset`;
        logRequest(url, 'POST', { email, code });

        const response = await fetch(url, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify({ email, code }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        return data;
    } catch (error) {
        throw error;
    }
};

export const resetPassword = async (email, code, newPassword) => {
    try {
        const url = `${BASE_URL}/auth/reset-password`;
        // Don't log the actual password
        logRequest(url, 'POST', { email, code, newPassword: '***' });

        const response = await fetch(url, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify({ email, code, newPassword }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        return data;
    } catch (error) {
        throw error;
    }
};

export const changePassword = async (passwordData) => {
    try {
        const token = await getToken();
        const url = `${BASE_URL}/auth/change-password`;
        logRequest(url, 'PUT', { oldPassword: '***', newPassword: '***' });

        const response = await fetch(url, {
            method: 'PUT',
            headers: buildHeaders(token),
            body: JSON.stringify(passwordData),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to change password');
        }

        return data;
    } catch (error) {
        throw error;
    }
};

export const deleteAccount = async () => {
    try {
        const token = await getToken();
        const url = `${BASE_URL}/auth/delete-account`;
        logRequest(url, 'DELETE');

        const response = await fetch(url, {
            method: 'DELETE',
            headers: buildHeaders(token),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        return data;
    } catch (error) {
        throw error;
    }
};

// ─── Services ─────────────────────────────────────────────────────────────────

export const getServices = async (params = {}) => {
    try {
        const queryParams = new URLSearchParams();
        if (params.barberId) queryParams.append('barberId', params.barberId);
        if (params.specialty) queryParams.append('specialty', params.specialty);
        if (params.serviceType) queryParams.append('serviceType', params.serviceType);

        const url = `${BASE_URL}/v2/services?${queryParams.toString()}`;
        logRequest(url, 'GET');

        const response = await fetch(url, {
            method: 'GET',
            headers: buildHeaders(),
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching services:', error);
        return { data: [], count: 0, total: 0 };
    }
};

export const createService = async (serviceData) => {
    try {
        const token = await getToken();
        const url = `${BASE_URL}/v2/services`;
        logRequest(url, 'POST', serviceData);

        const response = await fetch(url, {
            method: 'POST',
            headers: buildHeaders(token),
            body: JSON.stringify(serviceData),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to create service');
        return data;
    } catch (error) {
        throw error;
    }
};

export const updateService = async (serviceId, serviceData) => {
    try {
        const token = await getToken();
        const url = `${BASE_URL}/v2/services/${serviceId}`;
        logRequest(url, 'PUT', serviceData);

        const response = await fetch(url, {
            method: 'PUT',
            headers: buildHeaders(token),
            body: JSON.stringify(serviceData),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to update service');
        return data;
    } catch (error) {
        throw error;
    }
};

export const deleteService = async (serviceId) => {
    try {
        const token = await getToken();
        const url = `${BASE_URL}/v2/services/${serviceId}`;
        logRequest(url, 'DELETE');

        const response = await fetch(url, {
            method: 'DELETE',
            headers: buildHeaders(token),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to delete service');
        return data;
    } catch (error) {
        throw error;
    }
};

// ─── Barbers ──────────────────────────────────────────────────────────────────

export const getBarbers = async (params) => {
    try {
        // Build query string from the params object if any are passed
        const queryString = params ? new URLSearchParams(params).toString() : '';
        const url = queryString
            ? `${BASE_URL}/barbers?${queryString}`
            : `${BASE_URL}/barbers`;

        logRequest(url, 'GET');

        const response = await fetch(url, {
            method: 'GET',
            headers: buildHeaders(),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        return data.data;
    } catch (error) {
        console.error('Error fetching barbers:', error);
        return [];
    }
};

export const searchBarbers = async (query, type, service) => {
    try {
        const url = `${BASE_URL}/barbers/search?query=${encodeURIComponent(query)}&type=${type || 'all'}&service=${service || 'all'}`;
        logRequest(url, 'GET');

        const response = await fetch(url, {
            method: 'GET',
            headers: buildHeaders(),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        return data.data;
    } catch (error) {
        console.error('Error searching barbers:', error);
        return [];
    }
};

export const getBarberById = async (barberId) => {
    try {
        const url = `${BASE_URL}/barbers/${barberId}`;
        logRequest(url, 'GET');

        const response = await fetch(url, {
            method: 'GET',
            headers: buildHeaders(),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        return data.data;
    } catch (error) {
        console.error('Error fetching barber by ID:', error);
        return null;
    }
};

export const getBarbersV2 = async (params) => {
    try {
        const queryString = params ? new URLSearchParams(params).toString() : '';
        const url = queryString
            ? `${BASE_URL}/v2/barbers?${queryString}`
            : `${BASE_URL}/v2/barbers`;

        logRequest(url, 'GET');

        const response = await fetch(url, {
            method: 'GET',
            headers: buildHeaders(),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        return data.data || [];
    } catch (error) {
        console.error('Error fetching barbers v2:', error);
        return [];
    }
};

export const updateBarberProfile = async (profileData) => {
    try {
        const token = await getToken();
        const url = `${BASE_URL}/barbers/profile`;
        logRequest(url, 'PATCH', profileData);

        const response = await fetch(url, {
            method: 'PATCH',
            headers: buildHeaders(token),
            body: JSON.stringify(profileData),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        return data;
    } catch (error) {
        throw error;
    }
};

export const toggleBarberOnlineStatus = async (statusData) => {
    try {
        const token = await getToken();

        if (!token) {
            throw new Error('No auth token found');
        }

        const url = `${BASE_URL}/barbers/toggle-online`;
        logRequest(url, 'PUT', statusData);

        const response = await fetch(url, {
            method: 'PUT',
            headers: buildHeaders(token),
            body: JSON.stringify(statusData),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to toggle status');
        }

        return data;
    } catch (error) {
        console.error('Error toggling barber status:', error);
        throw error;
    }
};

export const getServiceCategories = async () => {
    try {
        const url = `${BASE_URL}/v2/barbers/services-list`;

        const response = await fetch(url, {
            method: 'GET',
            headers: buildHeaders(),
        });

        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error('Error fetching service categories:', error);
        return [];
    }
};

// ─── Bookings ─────────────────────────────────────────────────────────────────

export const createBooking = async (bookingData) => {
    try {
        const token = await getToken();
        const url = `${BASE_URL}/bookings`;
        logRequest(url, 'POST', bookingData);

        const response = await fetch(url, {
            method: 'POST',
            headers: buildHeaders(token),
            body: JSON.stringify(bookingData),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        return data;
    } catch (error) {
        throw error;
    }
};

export const getMyBookings = async () => {
    try {
        const token = await getToken();
        const url = `${BASE_URL}/bookings/my-bookings`;
        logRequest(url, 'GET');

        const response = await fetch(url, {
            method: 'GET',
            headers: buildHeaders(token),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        return data.data;
    } catch (error) {
        console.error('Error fetching bookings:', error);
        return [];
    }
};

// Update a booking's status (barber use: 'confirmed', 'completed', 'cancelled_by_barber')
export const updateBookingStatus = async (bookingId, status) => {
    try {
        const token = await getToken();
        const url = `${BASE_URL}/v2/bookings/${bookingId}/status`;
        logRequest(url, 'PUT', { status });

        const response = await fetch(url, {
            method: 'PUT',
            headers: buildHeaders(token),
            body: JSON.stringify({ status }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to update booking status');
        }

        return data;
    } catch (error) {
        console.error('Error updating booking status:', error);
        throw error;
    }
};

// Cancel a booking - only works if the booking is still pending or confirmed
export const cancelBooking = async (bookingId) => {
    try {
        const token = await getToken();
        const url = `${BASE_URL}/v2/bookings/${bookingId}/cancel`;
        logRequest(url, 'PUT');

        const response = await fetch(url, {
            method: 'PUT',
            headers: buildHeaders(token),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to cancel booking');
        }

        return data;
    } catch (error) {
        console.error('Error cancelling booking:', error);
        throw error;
    }
};

// Pay for a booking — simulated payment, marks payment_status as "paid"
export const payBooking = async (bookingId) => {
    try {
        const token = await getToken();
        const url = `${BASE_URL}/v2/bookings/${bookingId}/pay`;
        logRequest(url, 'PUT');

        const response = await fetch(url, {
            method: 'PUT',
            headers: buildHeaders(token),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Payment failed');
        }

        return data;
    } catch (error) {
        console.error('Error processing payment:', error);
        throw error;
    }
};



export const getServiceById = async (serviceId) => {
    try {
        const url = `${BASE_URL}/v2/services/${serviceId}`;
        logRequest(url, 'GET');

        const response = await fetch(url, {
            method: 'GET',
            headers: buildHeaders(),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        return data.data;
    } catch (error) {
        console.error('Error fetching service:', error);
        return null;
    }
};

// ─── Available Slots (v2 booking engine) ─────────────────────────────────────

export const getAvailableSlots = async ({ barberId, serviceId, date, serviceType = 'salon' }) => {
    try {
        // Build the query string manually for clarity
        const queryParams = new URLSearchParams({ barberId, serviceId, date, serviceType }).toString();
        const url = `${BASE_URL}/v2/bookings/available-slots?${queryParams}`;
        logRequest(url, 'GET');

        const response = await fetch(url, {
            method: 'GET',
            headers: buildHeaders(),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        return data; // { slots: [{time, iso, available}] }
    } catch (error) {
        console.error('Error fetching available slots:', error);
        return { slots: [] };
    }
};

export const createBookingV2 = async (bookingData) => {
    try {
        const token = await getToken();
        const url = `${BASE_URL}/v2/bookings`;
        logRequest(url, 'POST', bookingData);

        const response = await fetch(url, {
            method: 'POST',
            headers: buildHeaders(token),
            body: JSON.stringify(bookingData),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        return data;
    } catch (error) {
        throw error;
    }
};

// ─── Reviews & Ratings ────────────────────────────────────────────────────────

export const submitReview = async ({ bookingId, barberId, stars, comment, categoryRatings, tags, anonymous }) => {
    try {
        const token = await getToken();
        const url = `${BASE_URL}/v2/reviews`;
        logRequest(url, 'POST', { bookingId, barberId, stars });

        const response = await fetch(url, {
            method: 'POST',
            headers: buildHeaders(token),
            body: JSON.stringify({
                bookingId,
                barberId,
                stars,
                comment,
                categoryRatings, // { skill, punctuality, cleanliness, value }
                tags,            // string[]
                anonymous,       // boolean
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        return data;
    } catch (error) {
        throw error;
    }
};

export const updateReview = async (reviewId, { stars, comment }) => {
    try {
        const token = await getToken();
        const url = `${BASE_URL}/v2/reviews/${reviewId}`;

        const response = await fetch(url, {
            method: 'PUT',
            headers: buildHeaders(token),
            body: JSON.stringify({ stars, comment }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        return data;
    } catch (error) {
        throw error;
    }
};

export const deleteReview = async (reviewId) => {
    try {
        const token = await getToken();
        const url = `${BASE_URL}/v2/reviews/${reviewId}`;

        const response = await fetch(url, {
            method: 'DELETE',
            headers: buildHeaders(token),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        return data;
    } catch (error) {
        throw error;
    }
};

export const getBarberReviews = async (barberId, page, limit) => {
    // Default to page 1 and 10 reviews per page
    const pageNum = page || 1;
    const limitNum = limit || 10;

    try {
        const url = `${BASE_URL}/v2/reviews/barbers/${barberId}/reviews?page=${pageNum}&limit=${limitNum}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: buildHeaders(),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        return data;
    } catch (error) {
        console.error('Error fetching barber reviews:', error);
        return { data: [], total: 0 };
    }
};

export const getBarberRating = async (barberId) => {
    try {
        const url = `${BASE_URL}/v2/reviews/barbers/${barberId}/rating`;

        const response = await fetch(url, {
            method: 'GET',
            headers: buildHeaders(),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        return data.data;
    } catch (error) {
        console.error('Error fetching barber rating:', error);
        // Return safe defaults so the UI doesn't break
        return { averageRating: 0, totalReviews: 0, starBreakdown: [] };
    }
};

// Check if a review already exists for a specific booking.
// Returns { exists: true/false, data: reviewObject|null }
// Called when MyBookingsScreen loads so we know which completed bookings are already reviewed.
export const getReviewByBooking = async (bookingId) => {
    try {
        const token = await getToken();
        const url = `${BASE_URL}/v2/reviews/booking/${bookingId}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: buildHeaders(token),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        return data; // { exists, data }
    } catch (error) {
        console.error('Error checking review status:', error);
        // Fail gracefully — treat as not reviewed so the button still shows
        return { exists: false, data: null };
    }
};

// ─── Notifications ────────────────────────────────────────────────────────────

export const getNotifications = async () => {
    try {
        const token = await getToken();
        const url = `${BASE_URL}/notifications`;
        logRequest(url, 'GET');

        const response = await fetch(url, {
            method: 'GET',
            headers: buildHeaders(token),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        return data.data;
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return [];
    }
};

export const markNotificationAsRead = async (id) => {
    try {
        const token = await getToken();
        const url = `${BASE_URL}/notifications/${id}/read`;
        logRequest(url, 'PUT');

        const response = await fetch(url, {
            method: 'PUT',
            headers: buildHeaders(token),
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error marking notification as read:', error);
        return null;
    }
};

// ─── Wallet ───────────────────────────────────────────────────────────────────

export const getWallet = async () => {
    try {
        const token = await getToken();
        const url = `${BASE_URL}/wallet`;
        logRequest(url, 'GET');

        const response = await fetch(url, {
            method: 'GET',
            headers: buildHeaders(token),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        return data.data; // { balance, transactions }
    } catch (error) {
        console.error('Error fetching wallet:', error);
        throw error;
    }
};

export const addMoneyToWallet = async (amount, source) => {
    // Default payment source to 'Card' if not specified
    const paymentSource = source || 'Card';

    try {
        const token = await getToken();
        const url = `${BASE_URL}/wallet/add-money`;
        logRequest(url, 'POST', { amount, source: paymentSource });

        const response = await fetch(url, {
            method: 'POST',
            headers: buildHeaders(token),
            body: JSON.stringify({ amount, source: paymentSource }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        return data.data; // { balance, transaction }
    } catch (error) {
        throw error;
    }
};

// Grouped export for convenience when importing auth functions together
export const authAPI = {
    forgotPassword,
    deleteAccount,
    changePassword,
};
