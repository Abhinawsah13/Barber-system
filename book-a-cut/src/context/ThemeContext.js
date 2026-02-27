import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'react-native';
import { lightTheme, darkTheme } from '../theme/theme';

const ThemeContext = createContext();

const THEME_STORAGE_KEY = '@app_theme_mode';

export const ThemeProvider = ({ children }) => {
    const [darkMode, setDarkMode] = useState(false);
    const [loading, setLoading] = useState(true);

    // Load saved theme preference on app start
    useEffect(() => {
        loadThemePreference();
    }, []);

    // Update StatusBar when theme changes
    useEffect(() => {
        StatusBar.setBarStyle(darkMode ? 'light-content' : 'dark-content');
    }, [darkMode]);

    const loadThemePreference = async () => {
        try {
            const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
            if (savedTheme !== null) {
                setDarkMode(savedTheme === 'dark');
            }
        } catch (error) {
            console.error('Failed to load theme preference:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleTheme = async (value) => {
        try {
            const newMode = value !== undefined ? value : !darkMode;
            setDarkMode(newMode);
            await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode ? 'dark' : 'light');
        } catch (error) {
            console.error('Failed to save theme preference:', error);
        }
    };

    const theme = darkMode ? darkTheme : lightTheme;

    return (
        <ThemeContext.Provider value={{ theme, darkMode, toggleTheme, loading }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};
