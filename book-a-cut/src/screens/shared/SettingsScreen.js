import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { deleteAccount } from '../../services/api';
import { removeToken } from '../../services/TokenManager';

export default function SettingsScreen({ navigation }) {
    const [pushEnabled, setPushEnabled] = useState(true);
    const [emailEnabled, setEmailEnabled] = useState(false);

    // Access theme from context
    const { theme, darkMode, toggleTheme } = useTheme();

    const handleDeleteAccount = () => {
        Alert.alert(
            "Delete Account",
            "Are you sure? This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteAccount();
                            await removeToken();
                            // Reset navigation to Login/Welcome
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'Login' }],
                            });
                        } catch (error) {
                            Alert.alert("Error", error.message || "Failed to delete account");
                        }
                    }
                }
            ]
        );
    };

    const handleLogout = () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to logout?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Logout",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await removeToken();
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'Login' }],
                            });
                        } catch (error) {
                            Alert.alert("Error", "Failed to logout");
                        }
                    }
                }
            ]
        );
    };

    const renderSettingItem = (label, value, onToggle) => (
        <View style={styles.settingItem}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>{label}</Text>
            <Switch
                trackColor={{ false: "#E0E0E0", true: "#E1BEE7" }}
                thumbColor={value ? theme.primary : "#F5F5F5"}
                onValueChange={onToggle}
                value={value}
            />
        </View>
    );

    const renderLinkItem = (label, icon, onPress) => (
        <TouchableOpacity style={styles.linkItem} onPress={onPress}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.linkIcon}>{icon}</Text>
                <Text style={[styles.linkLabel, { color: theme.text }]}>{label}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={[styles.backText, { color: theme.text }]}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>

                <Text style={styles.sectionHeader}>Preferences</Text>
                <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    {renderSettingItem("Push Notifications", pushEnabled, setPushEnabled)}
                    <View style={[styles.divider, { backgroundColor: theme.inputBg }]} />
                    {renderSettingItem("Email Updates", emailEnabled, setEmailEnabled)}
                    <View style={[styles.divider, { backgroundColor: theme.inputBg }]} />
                    {renderSettingItem("Dark Mode", darkMode, toggleTheme)}
                </View>

                <Text style={styles.sectionHeader}>Security</Text>
                <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    {renderLinkItem("Change Password", "🔒", () => navigation.navigate("ChangePassword"))}
                    <View style={[styles.divider, { backgroundColor: theme.inputBg }]} />
                    {renderLinkItem("Privacy Policy", "🛡️", () => Alert.alert("Privacy Policy", "Coming soon!"))}
                </View>

                <Text style={styles.sectionHeader}>Help & Support</Text>
                <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    {renderLinkItem("FAQ", "❓", () => Alert.alert("FAQ", "FAQs coming soon!"))}
                    <View style={[styles.divider, { backgroundColor: theme.inputBg }]} />
                    {renderLinkItem("Contact Us", "📞", () => Alert.alert("Contact Us", "Email us at support@bookacut.com"))}
                    <View style={[styles.divider, { backgroundColor: theme.inputBg }]} />
                    {renderLinkItem("About App", "ℹ️", () => Alert.alert("About", "Book-A-Cut Version 1.0.0"))}
                </View>

                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
                    <Text style={styles.deleteText}>Delete Account</Text>
                </TouchableOpacity>

                <Text style={styles.versionText}>Version 1.0.0</Text>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // backgroundColor handled by theme
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
    },
    backBtn: {
        marginRight: 20,
    },
    backText: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    sectionHeader: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#999',
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginLeft: 5,
    },
    sectionCard: {
        borderRadius: 15,
        marginBottom: 25,
        paddingHorizontal: 15,
        borderWidth: 1,
    },
    settingItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: '500',
    },
    linkItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
    },
    linkIcon: {
        fontSize: 18,
        marginRight: 15,
    },
    linkLabel: {
        fontSize: 16,
        fontWeight: '500',
    },
    chevron: {
        fontSize: 20,
        color: '#CCC',
        fontWeight: 'bold',
    },
    divider: {
        height: 1,
    },
    logoutBtn: {
        alignItems: 'center',
        padding: 15,
        marginTop: 10,
        backgroundColor: '#FF9800',
        borderRadius: 12,
        marginHorizontal: 20,
    },
    logoutText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    deleteBtn: {
        alignItems: 'center',
        padding: 15,
        marginTop: 10,
    },
    deleteText: {
        color: '#F44336',
        fontWeight: 'bold',
        fontSize: 16,
    },
    versionText: {
        textAlign: 'center',
        marginTop: 20,
        color: '#CCC',
        fontSize: 12,
    }
});
