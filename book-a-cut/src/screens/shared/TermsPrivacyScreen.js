import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageProvider';

export default function TermsPrivacyScreen({ navigation }) {
    const { theme } = useTheme();
    const { t } = useLanguage();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={[styles.backText, { color: theme.text }]}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>{t('terms_and_privacy')}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={[styles.sectionTitle, { color: theme.primary }]}>{t('terms_and_privacy')}</Text>
                <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[styles.paragraph, { color: theme.textLight }]}>
                        • {t('terms_bullet1')}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.textLight }]}>
                        • {t('terms_bullet2')}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.textLight }]}>
                        • {t('terms_bullet3')}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.textLight }]}>
                        • {t('terms_bullet4')}
                    </Text>
                </View>

                <Text style={[styles.sectionTitle, { color: theme.primary, marginTop: 30 }]}>{t('privacy_policy')}</Text>
                <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[styles.paragraph, { color: theme.textLight }]}>
                        • {t('privacy_bullet1')}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.textLight }]}>
                        • {t('privacy_bullet2')}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.textLight }]}>
                        • {t('privacy_bullet3')}
                    </Text>
                    <Text style={[styles.paragraph, { color: theme.textLight }]}>
                        • {t('privacy_bullet4')}
                    </Text>
                </View>

                <Text style={[styles.footerText, { color: theme.textMuted }]}>
                    {t('last_updated')}: March 27, 2026
                </Text>
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
    card: { borderRadius: 15, borderWidth: 1, padding: 15 },
    paragraph: { fontSize: 14, lineHeight: 22, marginBottom: 12 },
    footerText: { textAlign: 'center', marginTop: 30, fontSize: 12, marginBottom: 40 },
});
