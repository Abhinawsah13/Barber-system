import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, LayoutAnimation, Platform, UIManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageProvider';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const getFAQ = (t) => [
    { q: t('faq_q1'), a: t('faq_a1') },
    { q: t('faq_q2'), a: t('faq_a2') },
    { q: t('faq_q3'), a: t('faq_a3') }
];

export default function FAQScreen({ navigation }) {
    const { theme } = useTheme();
    const { t } = useLanguage();
    const [expanded, setExpanded] = useState(null);
    const FAQ = getFAQ(t);

    const toggleFAQ = (idx) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(expanded === idx ? null : idx);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={[styles.backText, { color: theme.text }]}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>{t('faq')}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Frequently Asked Questions</Text>
                {FAQ.map((item, idx) => (
                    <TouchableOpacity
                        key={idx}
                        style={[styles.faqCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                        onPress={() => toggleFAQ(idx)}
                    >
                        <View style={styles.faqHeader}>
                            <Text style={[styles.faqQuestion, { color: theme.text }]}>{item.q}</Text>
                            <Text style={[styles.chevron, { color: theme.primary }]}>{expanded === idx ? '▲' : '▼'}</Text>
                        </View>
                        {expanded === idx && (
                            <Text style={[styles.faqAnswer, { color: theme.textLight }]}>{item.a}</Text>
                        )}
                    </TouchableOpacity>
                ))}
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
    faqCard: { marginBottom: 10, borderRadius: 12, borderWidth: 1, padding: 15 },
    faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    faqQuestion: { fontSize: 15, fontWeight: '600', flex: 1, marginRight: 10 },
    chevron: { fontSize: 12 },
    faqAnswer: { fontSize: 14, marginTop: 12, lineHeight: 20 },
});
