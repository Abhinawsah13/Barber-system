import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageProvider';

export default function ContactUsScreen({ navigation }) {
    const { theme } = useTheme();
    const { t } = useLanguage();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={[styles.backText, { color: theme.text }]}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>{t('contact_us')}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('contact_details')}</Text>
                <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <View style={styles.contactItem}>
                        <Text style={[styles.contactLabel, { color: theme.textMuted }]}>{t('email')}</Text>
                        <Text style={[styles.contactValue, { color: theme.primary }]}>abhinawprasad83@gmail.com</Text>
                    </View>
                    <View style={[styles.divider, { backgroundColor: theme.inputBg }]} />
                    <View style={styles.contactItem}>
                        <Text style={[styles.contactLabel, { color: theme.textMuted }]}>{t('phone')}</Text>
                        <Text style={[styles.contactValue, { color: theme.primary }]}>9765252198</Text>
                    </View>
                </View>

                <TouchableOpacity style={[styles.supportBtn, { backgroundColor: theme.primary }]}>
                    <Text style={styles.supportBtnText}>{t('contact_support')}</Text>
                </TouchableOpacity>
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
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
    card: { borderRadius: 15, borderWidth: 1, overflow: 'hidden' },
    contactItem: { padding: 18 },
    contactLabel: { fontSize: 13, marginBottom: 5 },
    contactValue: { fontSize: 16, fontWeight: '600' },
    divider: { height: 1 },
    supportBtn: { marginTop: 40, padding: 18, borderRadius: 12, alignItems: 'center' },
    supportBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});
