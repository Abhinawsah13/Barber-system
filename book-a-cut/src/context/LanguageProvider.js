import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from '../utils/translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
    const [language, setLanguage] = useState('en');

    useEffect(() => {
        loadSavedLanguage();
    }, []);

    const loadSavedLanguage = async () => {
        try {
            const savedLanguage = await AsyncStorage.getItem('user_language');
            if (savedLanguage) {
                setLanguage(savedLanguage);
            }
        } catch (error) {
            console.error('Error loading language', error);
        }
    };

    const changeLanguage = async (newLanguage) => {
        try {
            setLanguage(newLanguage);
            await AsyncStorage.setItem('user_language', newLanguage);
        } catch (error) {
            console.error('Error saving language', error);
        }
    };

    const t = (key) => {
        return translations[language][key] || translations['en'][key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, changeLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);
