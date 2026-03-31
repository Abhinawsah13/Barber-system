import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageProvider';
import { deleteAccount } from '../../services/api';
import { removeToken } from '../../services/TokenManager';

export default function SettingsScreen({ navigation }) {
    const [pushEnabled, setPushEnabled] = useState(true);
    const [emailEnabled, setEmailEnabled] = useState(false);

    const { theme, darkMode, toggleTheme } = useTheme();
    const { t, language } = useLanguage();

    const getLanguageName = (code) => {
        const names = { en: 'English', np: 'नेपाली', hi: 'हिन्दी' };
        return names[code] || 'English';
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            t('delete_account'),
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
            t('logout'),
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
                trackColor={{ false: "#E0E0E0", true: theme.primary + '80' }}
                thumbColor={value ? theme.primary : "#F5F5F5"}
                onValueChange={onToggle}
                value={value}
            />
        </View>
    );

    const renderLinkItem = (label, icon, onPress, subValue = null) => (
        <TouchableOpacity style={styles.linkItem} onPress={onPress}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Text style={styles.linkIcon}>{icon}</Text>
                <Text style={[styles.linkLabel, { color: theme.text }]}>{label}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {subValue && <Text style={[styles.subValue, { color: theme.textMuted }]}>{subValue}</Text>}
                <Text style={[styles.chevron, { color: theme.textMuted }]}>›</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={[styles.backText, { color: theme.text }]}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>{t('settings')}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>

                <Text style={styles.sectionHeader}>{t('preferences')}</Text>
                <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    {renderSettingItem(t('push_notifications'), pushEnabled, setPushEnabled)}
                    <View style={[styles.divider, { backgroundColor: theme.inputBg }]} />
                    {renderSettingItem(t('email_updates'), emailEnabled, setEmailEnabled)}
                    <View style={[styles.divider, { backgroundColor: theme.inputBg }]} />
                    {renderSettingItem(t('dark_mode'), darkMode, toggleTheme)}
                </View>

                <Text style={styles.sectionHeader}>{t('language')}</Text>
                <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    {renderLinkItem(t('language'), "🌐", () => navigation.navigate("LanguageSettings"), getLanguageName(language))}
                </View>

                <Text style={styles.sectionHeader}>{t('security')}</Text>
                <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    {renderLinkItem(t('change_password'), "🔒", () => navigation.navigate("ChangePassword"))}
                    <View style={[styles.divider, { backgroundColor: theme.inputBg }]} />
                    {renderLinkItem(t('privacy_policy'), "🛡️", () => navigation.navigate("TermsPrivacy"))}
                </View>

                <Text style={styles.sectionHeader}>{t('help_support')}</Text>
                <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    {renderLinkItem(t('faq'), "❓", () => navigation.navigate("HelpSupport"))}
                    <View style={[styles.divider, { backgroundColor: theme.inputBg }]} />
                    {renderLinkItem(t('contact_us'), "📞", () => navigation.navigate("HelpSupport"))}
                    <View style={[styles.divider, { backgroundColor: theme.inputBg }]} />
                    {renderLinkItem(t('about_app'), "ℹ️", () => Alert.alert(t('about_app'), "Book-A-Cut Version 1.0.0"))}
                </View>

                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Text style={styles.logoutText}>{t('logout')}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
                    <Text style={styles.deleteText}>{t('delete_account')}</Text>
                </TouchableOpacity>

                <Text style={styles.versionText}>{t('version')} 1.0.0</Text>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
    backBtn: { marginRight: 20 },
    backText: { fontSize: 24, fontWeight: 'bold' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    scrollContent: { padding: 20, paddingBottom: 40 },
    sectionHeader: { fontSize: 13, fontWeight: 'bold', color: '#999', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1, marginLeft: 5 },
    sectionCard: { borderRadius: 15, marginBottom: 25, paddingHorizontal: 15, borderWidth: 1 },
    settingItem: { flexDirection: 'row', justifyKey: 'space-between', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15 },
    settingLabel: { fontSize: 16, fontWeight: '500' },
    linkItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15 },
    linkIcon: { fontSize: 18, marginRight: 15 },
    linkLabel: { fontSize: 16, fontWeight: '500' },
    subValue: { fontSize: 14, marginRight: 10 },
    chevron: { fontSize: 18, fontWeight: 'bold' },
    divider: { height: 1 },
    logoutBtn: { alignItems: 'center', padding: 16, marginTop: 10, backgroundColor: '#FF9800', borderRadius: 12 },
    logoutText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
    deleteBtn: { alignItems: 'center', padding: 15, marginTop: 10 },
    deleteText: { color: '#F44336', fontWeight: 'bold', fontSize: 15 },
    versionText: { textAlign: 'center', marginTop: 20, color: '#CCC', fontSize: 12 }
});

