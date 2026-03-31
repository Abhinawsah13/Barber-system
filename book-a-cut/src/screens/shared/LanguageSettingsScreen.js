import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageProvider';

const LANGUAGES = [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'np', name: 'Nepali', native: 'नेपाली' },
    { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
];

export default function LanguageSettingsScreen({ navigation }) {
    const { theme } = useTheme();
    const { language, changeLanguage, t } = useLanguage();

    const handleSelect = async (code) => {
        await changeLanguage(code);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={[styles.backText, { color: theme.text }]}>←</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>{t('language')}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={[styles.label, { color: theme.textLight }]}>Select App Language</Text>
                <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    {LANGUAGES.map((lang, idx) => (
                        <View key={lang.code}>
                            <TouchableOpacity
                                style={styles.item}
                                onPress={() => handleSelect(lang.code)}
                            >
                                <View>
                                    <Text style={[styles.langName, { color: theme.text }]}>{lang.name}</Text>
                                    <Text style={[styles.langNative, { color: theme.textMuted }]}>{lang.native}</Text>
                                </View>
                                <View style={[
                                    styles.radio,
                                    { borderColor: language === lang.code ? theme.primary : '#CCC' }
                                ]}>
                                    {language === lang.code && <View style={[styles.radioFill, { backgroundColor: theme.primary }]} />}
                                </View>
                            </TouchableOpacity>
                            {idx < LANGUAGES.length - 1 && <View style={[styles.divider, { backgroundColor: theme.inputBg }]} />}
                        </View>
                    ))}
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
    label: { fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 15, marginLeft: 5 },
    card: { borderRadius: 15, borderWidth: 1, overflow: 'hidden' },
    item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18 },
    langName: { fontSize: 16, fontWeight: '600' },
    langNative: { fontSize: 14, marginTop: 2 },
    radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
    radioFill: { width: 12, height: 12, borderRadius: 6 },
    divider: { height: 1 },
});
