import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';

export default function CustomerSettingsScreen({ navigation }) {
    const { theme, darkMode, toggleTheme } = useTheme();
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
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
                            Alert.alert('Error', 'Failed to logout');
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
                <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Account Settings */}
                <SettingsSection title="ACCOUNT">
                    <SettingsItem
                        icon="👤"
                        title="Edit Profile"
                        subtitle="Update your profile information"
                        onPress={() => navigation.navigate('EditProfile', { user: {} })}
                    />
                    <SettingsItem
                        icon="🔒"
                        title="Change Password"
                        subtitle="Update your password"
                        onPress={() => navigation.navigate('ChangePassword')}
                    />
                    <SettingsItem
                        icon="📍"
                        title="Saved Addresses"
                        subtitle="Manage your addresses"
                        onPress={() => Alert.alert('Coming Soon', 'Address management will be available soon')}
                    />
                </SettingsSection>

                {/* App Settings */}
                <SettingsSection title="APP SETTINGS">
                    <SettingsItem
                        icon="🌙"
                        title="Dark Mode"
                        subtitle={darkMode ? "Dark theme enabled" : "Light theme enabled"}
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
                        icon="🔔"
                        title="Notifications"
                        subtitle={notificationsEnabled ? "Enabled" : "Disabled"}
                        showArrow={false}
                        rightComponent={
                            <Switch
                                value={notificationsEnabled}
                                onValueChange={setNotificationsEnabled}
                                trackColor={{ false: theme.border, true: theme.primary }}
                                thumbColor={notificationsEnabled ? theme.primaryDark : '#f4f3f4'}
                            />
                        }
                    />
                    <SettingsItem
                        icon="🌐"
                        title="Language"
                        subtitle="English (US)"
                        onPress={() => Alert.alert('Coming Soon', 'Language selection will be available soon')}
                    />
                </SettingsSection>

                {/* Booking History */}
                <SettingsSection title="BOOKINGS">
                    <SettingsItem
                        icon="📅"
                        title="My Bookings"
                        subtitle="View booking history"
                        onPress={() => navigation.navigate('BookingHistory')}
                    />
                    <SettingsItem
                        icon="⭐"
                        title="Favorite Barbers"
                        subtitle="Your saved barbers"
                        onPress={() => Alert.alert('Coming Soon', 'Favorites will be available soon')}
                    />
                </SettingsSection>

                {/* Support */}
                <SettingsSection title="SUPPORT">
                    <SettingsItem
                        icon="❓"
                        title="Help & Support"
                        subtitle="Get help with the app"
                        onPress={() => Alert.alert('Help', 'Contact support@bookacutapp.com')}
                    />
                    <SettingsItem
                        icon="📄"
                        title="Terms & Privacy"
                        subtitle="Read our policies"
                        onPress={() => Alert.alert('Info', 'Terms and Privacy Policy')}
                    />
                    <SettingsItem
                        icon="ℹ️"
                        title="About"
                        subtitle="Version 1.0.0"
                        showArrow={false}
                    />
                </SettingsSection>

                {/* Logout */}
                <TouchableOpacity
                    style={[styles.logoutBtn, { backgroundColor: theme.card, borderColor: theme.error }]}
                    onPress={handleLogout}
                >
                    <Text style={[styles.logoutText, { color: theme.error }]}>🚪 Logout</Text>
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
