import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageProvider';

export default function CustomerSettingsScreen({ navigation }) {
    const { theme, darkMode, toggleTheme } = useTheme();
    const { t, language } = useLanguage();
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);

    const getLanguageName = (code) => {
        const names = { en: 'English', np: 'नेपाली', hi: 'हिन्दी' };
        return names[code] || 'English';
    };

    const handleLogout = () => {
        Alert.alert(
            t('logout'),
            t('logout_confirm'),
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('logout'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await AsyncStorage.removeItem('token');
                            await AsyncStorage.removeItem('user');
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'Login' }],
                            });
                        } catch (error) {
                            Alert.alert(t('error'), t('logout_fail') || 'Failed to logout');
                        }
                    }
                }
            ]
        );
    };

    const SettingsSection = ({ title, children }) => (
        <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textLight }]}>{title}</Text>
            <View style={[styles.sectionContent, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {children}
            </View>
        </View>
    );

    const SettingsItem = ({ icon, title, subtitle, onPress, showArrow = true, rightComponent }) => (
        <TouchableOpacity
            style={[styles.settingsItem, { borderBottomColor: theme.border }]}
            onPress={onPress}
            disabled={!onPress}
        >
            <View style={styles.itemLeft}>
                <View style={[styles.iconContainer, { backgroundColor: theme.primaryLight }]}>
                    <Text style={styles.icon}>{icon}</Text>
                </View>
                <View style={styles.itemText}>
                    <Text style={[styles.itemTitle, { color: theme.text }]}>{title}</Text>
                    {subtitle && <Text style={[styles.itemSubtitle, { color: theme.textLight }]}>{subtitle}</Text>}
                </View>
            </View>
            {rightComponent || (showArrow && <Text style={[styles.arrow, { color: theme.textMuted }]}>›</Text>)}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={{ fontSize: 24, color: theme.text }}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>{t('settings')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Account Settings */}
                <SettingsSection title={t('account')}>
                    <SettingsItem
                        icon="👤"
                        title={t('edit_profile')}
                        subtitle={t('update_profile_info')}
                        onPress={() => navigation.navigate('EditProfile', { user: {} })}
                    />
                    <SettingsItem
                        icon="🔒"
                        title={t('change_password')}
                        subtitle={t('update_password')}
                        onPress={() => navigation.navigate('ChangePassword')}
                    />
                    <SettingsItem
                        icon="📍"
                        title={t('saved_addresses')}
                        subtitle={t('manage_addresses')}
                        onPress={() => Alert.alert(t('manage'), t('address_mgmt_coming_soon'))}
                    />
                </SettingsSection>

                {/* App Settings */}
                <SettingsSection title={t('preferences')}>
                    <SettingsItem
                        icon="🌙"
                        title={t('dark_mode')}
                        subtitle={darkMode ? t('dark_theme_enabled') : t('light_theme_enabled')}
                        showArrow={false}
                        rightComponent={
                            <Switch
                                value={darkMode}
                                onValueChange={toggleTheme}
                                trackColor={{ false: theme.border, true: theme.primary }}
                                thumbColor={darkMode ? theme.primaryDark : '#f4f3f4'}
                            />
                        }
                    />
                    <SettingsItem
                        icon="🌐"
                        title={t('language')}
                        subtitle={getLanguageName(language)}
                        onPress={() => navigation.navigate('LanguageSettings')}
                    />
                </SettingsSection>

                {/* Booking History */}
                <SettingsSection title={t('bookings_section')}>
                    <SettingsItem
                        icon="📅"
                        title={t('my_bookings')}
                        subtitle={t('booking_history_subtitle')}
                        onPress={() => navigation.navigate('BookingHistory')}
                    />
                    <SettingsItem
                        icon="⭐"
                        title={t('favorite_barbers')}
                        subtitle={t('saved_barbers_subtitle')}
                        onPress={() => Alert.alert(t('favorites'), t('favorites_coming_soon'))}
                    />
                </SettingsSection>

                {/* Support */}
                <SettingsSection title={t('help_support')}>
                    <SettingsItem
                        icon="❓"
                        title={t('faq')}
                        subtitle={t('faq_subtitle')}
                        onPress={() => navigation.navigate('HelpSupport')}
                    />
                    <SettingsItem
                        icon="📄"
                        title={t('terms_and_privacy')}
                        subtitle={t('terms_privacy_subtitle')}
                        onPress={() => navigation.navigate('TermsPrivacy')}
                    />
                    <SettingsItem
                        icon="ℹ️"
                        title={t('about_app')}
                        subtitle={`${t('version')} 1.0.0`}
                        showArrow={false}
                    />
                </SettingsSection>

                {/* Logout */}
                <TouchableOpacity
                    style={[styles.logoutBtn, { backgroundColor: theme.card, borderColor: theme.error }]}
                    onPress={handleLogout}
                >
                    <Text style={[styles.logoutText, { color: theme.error }]}>🚪 {t('logout')}</Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
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
        padding: 20,
        paddingBottom: 10,
    },
    backBtn: {
        padding: 5,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    scrollContent: {
        padding: 20,
        paddingTop: 10,
    },
    section: {
        marginBottom: 25,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 10,
        paddingLeft: 5,
    },
    sectionContent: {
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
    },
    settingsItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
    },
    itemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    icon: {
        fontSize: 20,
    },
    itemText: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    itemSubtitle: {
        fontSize: 13,
    },
    arrow: {
        fontSize: 24,
        marginLeft: 10,
    },
    logoutBtn: {
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
        borderWidth: 2,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
});
