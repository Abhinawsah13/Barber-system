import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageProvider';

export default function HelpSupportScreen({ navigation }) {
    const { theme } = useTheme();
    const { t } = useLanguage();

    const menuItems = [
        {
            title: t('faq'),
            description: "Find answers to commonly asked questions",
            icon: "❓",
            screen: "FAQ"
        },
        {
            title: t('contact_us'),
            description: "Get in touch with our support team",
            icon: "📞",
            screen: "ContactUs"
        }
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={[styles.backText, { color: theme.text }]}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>{t('help_support')}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={[styles.welcomeText, { color: theme.text }]}>How can we help you?</Text>
                <Text style={[styles.subtitle, { color: theme.textMuted }]}>Select an option below to get the assistance you need.</Text>

                {menuItems.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[styles.menuCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                        onPress={() => navigation.navigate(item.screen)}
                    >
                        <View style={[styles.iconBox, { backgroundColor: theme.primary + '15' }]}>
                            <Text style={styles.icon}>{item.icon}</Text>
                        </View>
                        <View style={styles.menuText}>
                            <Text style={[styles.menuTitle, { color: theme.text }]}>{item.title}</Text>
                            <Text style={[styles.menuDesc, { color: theme.textLight }]}>{item.description}</Text>
                        </View>
                        <Text style={[styles.chevron, { color: theme.textMuted }]}>›</Text>
                    </TouchableOpacity>
                ))}

                <View style={[styles.infoBox, { backgroundColor: theme.primary + '05', borderColor: theme.primary + '20' }]}>
                    <Text style={[styles.infoText, { color: theme.textLight }]}>
                        Our support team is available Monday to Friday, 9:00 AM - 6:00 PM.
                    </Text>
                </View>
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
    content: { padding: 20 },
    welcomeText: { fontSize: 24, fontWeight: 'bold', marginTop: 10, marginBottom: 8 },
    subtitle: { fontSize: 15, marginBottom: 30 },
    menuCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 15,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
    },
    iconBox: { width: 50, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    icon: { fontSize: 22 },
    menuText: { flex: 1 },
    menuTitle: { fontSize: 17, fontWeight: 'bold', marginBottom: 2 },
    menuDesc: { fontSize: 13 },
    chevron: { fontSize: 24, fontWeight: '300' },
    infoBox: { marginTop: 20, padding: 20, borderRadius: 15, borderWidth: 1, alignItems: 'center' },
    infoText: { textAlign: 'center', fontSize: 13, lineHeight: 20 },
});
