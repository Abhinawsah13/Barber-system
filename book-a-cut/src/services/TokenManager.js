import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'userToken';
const USER_KEY = 'userData';

// Save token to AsyncStorage (for "Remember Me" functionality)
export const setToken = async (newToken) => {
    try {
        if (newToken) {
            await AsyncStorage.setItem(TOKEN_KEY, newToken);
        }
    } catch (error) {
        console.error('Error saving token:', error);
    }
};

// Get token from AsyncStorage
export const getToken = async () => {
    try {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        return token;
    } catch (error) {
        console.error('Error getting token:', error);
        return null;
    }
};

// Remove token from AsyncStorage (logout)
export const removeToken = async () => {
    try {
        await AsyncStorage.removeItem(TOKEN_KEY);
        await AsyncStorage.removeItem(USER_KEY);
    } catch (error) {
        console.error('Error removing token:', error);
    }
};

// Save user data
export const setUserData = async (userData) => {
    try {
        if (userData) {
            await AsyncStorage.setItem(USER_KEY, JSON.stringify(userData));
        }
    } catch (error) {
        console.error('Error saving user data:', error);
    }
};

// Get user data
export const getUserData = async () => {
    try {
        const userData = await AsyncStorage.getItem(USER_KEY);
        return userData ? JSON.parse(userData) : null;
    } catch (error) {
        console.error('Error getting user data:', error);
        return null;
    }
};

// Check if user is logged in
export const isLoggedIn = async () => {
    try {
        const token = await getToken();
        return !!token;
    } catch (error) {
        console.error('Error checking login status:', error);
        return false;
    }
};
