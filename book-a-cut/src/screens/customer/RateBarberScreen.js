import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    Image, ActivityIndicator, KeyboardAvoidingView,
    Platform, ScrollView, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import StarRating from '../../components/shared/StarRating';
import { submitReview } from '../../services/api';
import { formatDate } from '../../utils/dateUtils';

const PURPLE = '#7B2FBE';
const LIGHT_PURPLE = '#F3E8FF';
const AMBER = '#F59E0B';
const GREEN = '#16A34A';
const LIGHT_GREEN = '#DCFCE7';
const CREAM = '#F5F0E8';

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'];
const RATING_EMOJIS = ['', '😞', '😐', '🙂', '😊', '🤩'];
const RATING_COLORS = ['', '#EF4444', '#F97316', AMBER, '#84CC16', '#22C55E'];

const GOOD_TAGS = [
    'Great Fade ✂️', 'On Time ⏰', 'Clean Shop 🧹', 'Friendly 😊',
    'Skilled Hands 👐', 'Good Value 💰', 'Neat Beard 🧔', 'Will Return 🔁',
];
const BAD_TAGS = [
    'Late Arrival ⏰', 'Rushed Job ⚡', 'Not as Expected 😕', 'Overpriced 💸',
];

const CATEGORIES = [
    { key: 'skill', label: 'Skill & Precision', icon: '✂️' },
    { key: 'punctuality', label: 'Punctuality', icon: '⏰' },
    { key: 'cleanliness', label: 'Cleanliness', icon: '🧹' },
    { key: 'value', label: 'Value for Money', icon: '💰' },
];

// dot-based 1–5 selector for each category
function CategoryRating({ label, icon, value, onChange, theme }) {
    return (
        <View style={cat.row}>
            <View style={cat.left}>
                <Text style={cat.icon}>{icon}</Text>
                <Text style={[cat.label, { color: theme.text }]}>{label}</Text>
            </View>
            <View style={cat.dots}>
                {[1, 2, 3, 4, 5].map(i => (
                    <TouchableOpacity
                        key={i}
                        onPress={() => onChange(i)}
                        activeOpacity={0.75}
                        style={[cat.dot, {
                            backgroundColor: value >= i ? PURPLE : 'transparent',
                            borderColor: value >= i ? PURPLE : theme.border,
                        }]}
                    >
                        <Text style={[cat.num, { color: value >= i ? '#fff' : theme.textMuted }]}>
                            {i}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}

const cat = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    left: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    icon: { fontSize: 18 },
    label: { fontSize: 13, fontWeight: '500' },
    dots: { flexDirection: 'row', gap: 6 },
    dot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    num: { fontSize: 11, fontWeight: '700' },
});

function TagPill({ label, active, onPress, activeColor, activeBg, theme }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.75}
            style={[tp.pill, {
                backgroundColor: active ? activeBg : 'transparent',
                borderColor: active ? activeColor : theme.border,
            }]}
        >
            <Text style={[tp.text, { color: active ? activeColor : '#555' }]}>{label}</Text>
        </TouchableOpacity>
    );
}

const tp = StyleSheet.create({
    pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1.5, margin: 3 },
    text: { fontSize: 12, fontWeight: '600' },
});

// small preview card shown on success screen
function ReviewPreviewCard({ barberName, stars, comment, tags, anonymous, theme }) {
    return (
        <View style={[rp.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={rp.headerRow}>
                <View style={rp.avatar}>
                    <Text style={rp.avatarLetter}>
                        {anonymous ? '?' : (barberName ? barberName.charAt(0).toUpperCase() : 'Y')}
                    </Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[rp.name, { color: theme.text }]}>
                        {anonymous ? 'Anonymous' : 'You'}
                    </Text>
                    <Text style={[rp.sub, { color: theme.textMuted }]}>
                        Review for {barberName} • Just now
                    </Text>
                </View>
                <View style={{ flexDirection: 'row' }}>
                    {[1, 2, 3, 4, 5].map(i => (
                        <Text key={i} style={{ color: i <= stars ? AMBER : '#DDD', fontSize: 13 }}>★</Text>
                    ))}
                </View>
            </View>

            {comment ? (
                <Text style={[rp.comment, { color: theme.textMuted }]} numberOfLines={3}>
                    {comment}
                </Text>
            ) : null}

            {tags.length > 0 && (
                <View style={rp.tagsRow}>
                    {tags.map(t => (
                        <View key={t} style={[rp.tag, { backgroundColor: LIGHT_PURPLE }]}>
                            <Text style={[rp.tagText, { color: PURPLE }]}>{t}</Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

const rp = StyleSheet.create({
    card: { borderRadius: 14, borderWidth: 1, padding: 16, width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center' },
    avatarLetter: { color: '#fff', fontWeight: '800', fontSize: 15 },
    name: { fontWeight: '700', fontSize: 13 },
    sub: { fontSize: 11, marginTop: 1 },
    comment: { fontSize: 13, lineHeight: 20, marginBottom: 10 },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 100 },
    tagText: { fontSize: 11, fontWeight: '600' },
});

export default function RateBarberScreen({ navigation, route }) {
    const { theme } = useTheme();

    const { bookingId, barberId, barberName, barberImage, serviceName, date } = route.params || {};

    const [screen, setScreen] = useState('write');
    const [stars, setStars] = useState(0);
    const [catRatings, setCatRatings] = useState({ skill: 0, punctuality: 0, cleanliness: 0, value: 0 });
    const [selectedTags, setSelectedTags] = useState([]);
    const [comment, setComment] = useState('');
    const [anonymous, setAnonymous] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [textFocused, setTextFocused] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [userRole, setUserRole] = useState(null);
    React.useEffect(() => {
        const fetchUser = async () => {
            const userData = await getUserData();
            const role = userData?.user_type;
            setUserRole(role);

            // ⚠️ SECURITY: If a barber somehow gets here, send them back
            if (role === 'barber') {
                console.log('[RateBarber] Barber attempted to access review screen. Redirecting...');
                navigation.replace('BarberHome');
            }
        };
        fetchUser();
    }, []);

    const setCat = (key) => (val) => setCatRatings(prev => ({ ...prev, [key]: val }));
    const toggleTag = (tag) => setSelectedTags(prev =>
        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );

    // disable submit until star selected and comment is long enough
    const canSubmit = stars > 0 && comment.trim().length >= 10;

    const handleSubmit = async () => {
        if (!canSubmit) return;

        setSubmitting(true);
        setSubmitError('');

        try {
            await submitReview({
                bookingId,
                barberId,
                stars,
                comment: comment.trim(),
                categoryRatings: catRatings,
                tags: selectedTags,
                anonymous,
            });

            setScreen('success');
        } catch (error) {
            const msg = error.message || '';

            if (msg.toLowerCase().includes('already reviewed')) {
                setSubmitError('You have already submitted a review for this booking.');
            } else if (msg.toLowerCase().includes('only customers')) {
                setSubmitError('Only customers can submit reviews.');
            } else if (msg.toLowerCase().includes('completed')) {
                setSubmitError('This booking is not completed yet.');
            } else {
                setSubmitError(msg || 'Something went wrong. Please try again.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    // success screen shown after submission
    if (screen === 'success') {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: CREAM }]}>
                <ScrollView contentContainerStyle={styles.successScroll} showsVerticalScrollIndicator={false}>

                    <View style={styles.successBadge}>
                        <Text style={styles.successBadgeText}>✓ Review Submitted</Text>
                    </View>

                    <Text style={[styles.successHeading, { color: theme.text }]}>
                        Thanks for your feedback!
                    </Text>
                    <Text style={[styles.successSub, { color: theme.textMuted }]}>
                        Your review helps other customers find the best barbers.
                        {barberName ? ` ${barberName} appreciates your kind words!` : ''}
                    </Text>

                    <ReviewPreviewCard
                        barberName={barberName}
                        stars={stars}
                        comment={comment}
                        tags={selectedTags}
                        anonymous={anonymous}
                        theme={theme}
                    />

                    <TouchableOpacity
                        style={styles.primaryBtn}
                        onPress={() => {
                            const target = userRole === 'barber' ? 'BarberHome' : 'Home';
                            navigation.reset({ index: 0, routes: [{ name: target }] });
                        }}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.primaryBtnText}>← Back to Home</Text>
                    </TouchableOpacity>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: CREAM }]}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

                <View style={[styles.header, { backgroundColor: '#fff', borderBottomColor: theme.border }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                        <Text style={{ fontSize: 24, color: theme.text }}>←</Text>
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Write a Review</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* barber info strip — data comes from booking */}
                    <View style={[styles.barberStrip, { backgroundColor: '#fff' }]}>
                        <Image
                            source={barberImage ? { uri: barberImage } : require('../../../assets/logo.png')}
                            style={styles.avatar}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.barberName, { color: theme.text }]}>
                                {barberName || 'Barber'}
                            </Text>
                            {serviceName ? (
                                <Text style={[styles.infoText, { color: theme.textMuted }]}>✂️ {serviceName}</Text>
                            ) : null}
                            {date ? (
                                <Text style={[styles.infoText, { color: theme.textMuted }]}>
                                    📅 {formatDate(date)}
                                </Text>
                            ) : null}
                        </View>
                        <View style={[styles.visitBadge, { backgroundColor: LIGHT_PURPLE }]}>
                            <Text style={{ color: PURPLE, fontSize: 11, fontWeight: '700' }}>Recent Visit</Text>
                        </View>
                    </View>

                    {/* overall star rating */}
                    <View style={[styles.card, { backgroundColor: '#fff' }]}>
                        <Text style={[styles.cardTitle, { color: theme.text }]}>Overall Rating</Text>
                        <View style={styles.starsRow}>
                            <StarRating rating={stars} onChange={setStars} size={44} color={AMBER} emptyColor={theme.border} />
                        </View>
                        {stars > 0 ? (
                            <View style={styles.feedbackRow}>
                                <Text style={styles.emoji}>{RATING_EMOJIS[stars]}</Text>
                                <Text style={[styles.feedbackLabel, { color: RATING_COLORS[stars] }]}>
                                    {RATING_LABELS[stars]}
                                </Text>
                            </View>
                        ) : (
                            <Text style={[styles.ratingHint, { color: theme.textMuted }]}>Tap the stars to rate</Text>
                        )}
                    </View>

                    {/* per-category dot ratings */}
                    <View style={[styles.card, { backgroundColor: '#fff' }]}>
                        <Text style={[styles.cardTitle, { color: theme.text }]}>Rate by Category</Text>
                        {CATEGORIES.map(c => (
                            <CategoryRating
                                key={c.key}
                                label={c.label}
                                icon={c.icon}
                                value={catRatings[c.key]}
                                onChange={setCat(c.key)}
                                theme={theme}
                            />
                        ))}
                    </View>

                    {/* quick tag selection */}
                    <View style={[styles.card, { backgroundColor: '#fff' }]}>
                        <Text style={[styles.cardTitle, { color: theme.text }]}>What stood out?</Text>
                        <Text style={[styles.tagHint, { color: theme.textMuted }]}>Select all that apply</Text>

                        <Text style={styles.tagGroupLabel}>👍 Positives</Text>
                        <View style={styles.tagsWrap}>
                            {GOOD_TAGS.map(t => (
                                <TagPill
                                    key={t} label={t}
                                    active={selectedTags.includes(t)}
                                    onPress={() => toggleTag(t)}
                                    activeColor={PURPLE} activeBg={LIGHT_PURPLE}
                                    theme={theme}
                                />
                            ))}
                        </View>

                        <Text style={[styles.tagGroupLabel, { marginTop: 12 }]}>👎 Improvements</Text>
                        <View style={styles.tagsWrap}>
                            {BAD_TAGS.map(t => (
                                <TagPill
                                    key={t} label={t}
                                    active={selectedTags.includes(t)}
                                    onPress={() => toggleTag(t)}
                                    activeColor="#DC2626" activeBg="#FEF2F2"
                                    theme={theme}
                                />
                            ))}
                        </View>
                    </View>

                    {/* written comment with live char counter */}
                    <View style={[styles.card, { backgroundColor: '#fff' }]}>
                        <Text style={[styles.cardTitle, { color: theme.text }]}>
                            Your Review{' '}
                            <Text style={{ fontWeight: '400', fontSize: 12, color: theme.textMuted }}>(min. 10 chars)</Text>
                        </Text>
                        <TextInput
                            style={[
                                styles.textInput,
                                { color: theme.text, borderColor: textFocused ? PURPLE : theme.border, backgroundColor: CREAM },
                                textFocused && styles.textInputFocused,
                            ]}
                            placeholder="Describe your experience... Was the fade clean? Did they listen to what you wanted?"
                            placeholderTextColor={theme.textMuted}
                            value={comment}
                            onChangeText={setComment}
                            onFocus={() => setTextFocused(true)}
                            onBlur={() => setTextFocused(false)}
                            multiline
                            numberOfLines={5}
                            maxLength={500}
                            textAlignVertical="top"
                        />
                        <View style={styles.charRow}>
                            <Text style={{ fontSize: 11, color: comment.length < 10 ? '#EF4444' : GREEN }}>
                                {comment.length < 10 ? `${10 - comment.length} more chars needed` : '✓ Good length'}
                            </Text>
                            <Text style={{ fontSize: 11, color: theme.textMuted }}>{comment.length}/500</Text>
                        </View>
                    </View>

                    {/* anonymous toggle */}
                    <View style={[styles.card, { backgroundColor: '#fff' }]}>
                        <View style={styles.anonRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.anonTitle, { color: theme.text }]}>Post Anonymously</Text>
                                <Text style={[styles.anonSub, { color: theme.textMuted }]}>Your name won't be shown</Text>
                            </View>
                            <Switch
                                value={anonymous}
                                onValueChange={setAnonymous}
                                trackColor={{ false: '#D1D5DB', true: PURPLE }}
                                thumbColor="#fff"
                            />
                        </View>
                    </View>

                    {/* hint shown until form is valid */}
                    {!canSubmit && (
                        <View style={styles.hintBox}>
                            <Text style={styles.hintText}>
                                {stars === 0
                                    ? '⭐ Please select a star rating first'
                                    : '✏️ Write at least 10 characters to submit'}
                            </Text>
                        </View>
                    )}

                    {submitError ? (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>⚠️ {submitError}</Text>
                        </View>
                    ) : null}

                    {/* disabled until valid */}
                    <TouchableOpacity
                        style={[
                            styles.primaryBtn,
                            { backgroundColor: canSubmit ? PURPLE : '#C4B5D4' },
                            submitting && { opacity: 0.7 },
                        ]}
                        onPress={handleSubmit}
                        disabled={submitting || !canSubmit}
                        activeOpacity={0.85}
                    >
                        {submitting ? (
                            <View style={styles.row}>
                                <ActivityIndicator color="#FFF" size="small" />
                                <Text style={styles.primaryBtnText}>  Submitting...</Text>
                            </View>
                        ) : (
                            <Text style={styles.primaryBtnText}>Submit Review ✓</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => navigation.navigate('MyBookings')} style={styles.skipBtn}>
                        <Text style={[styles.skipText, { color: theme.textMuted }]}>Skip for now</Text>
                    </TouchableOpacity>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
    iconBtn: { padding: 6 },
    headerTitle: { fontSize: 17, fontWeight: '700' },
    scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20, gap: 14 },
    barberStrip: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    avatar: { width: 52, height: 52, borderRadius: 26 },
    barberName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
    infoText: { fontSize: 12, marginTop: 1 },
    visitBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
    card: { borderRadius: 16, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 16 },
    starsRow: { alignItems: 'center', marginBottom: 12 },
    feedbackRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    emoji: { fontSize: 26 },
    feedbackLabel: { fontSize: 17, fontWeight: '800' },
    ratingHint: { textAlign: 'center', fontSize: 13, marginTop: 2 },
    tagHint: { fontSize: 12, marginTop: -10, marginBottom: 14 },
    tagGroupLabel: { fontSize: 12, fontWeight: '600', color: '#555', marginBottom: 8 },
    tagsWrap: { flexDirection: 'row', flexWrap: 'wrap' },
    textInput: { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: 14, minHeight: 110, marginBottom: 8 },
    textInputFocused: { borderWidth: 1.5 },
    charRow: { flexDirection: 'row', justifyContent: 'space-between' },
    anonRow: { flexDirection: 'row', alignItems: 'center' },
    anonTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
    anonSub: { fontSize: 12 },
    hintBox: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 12, padding: 14 },
    hintText: { fontSize: 13, color: '#92400E' },
    errorBox: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, padding: 14 },
    errorText: { fontSize: 13, color: '#DC2626' },
    primaryBtn: { paddingVertical: 16, backgroundColor: PURPLE, borderRadius: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
    primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    row: { flexDirection: 'row', alignItems: 'center' },
    skipBtn: { alignItems: 'center', paddingVertical: 12 },
    skipText: { fontSize: 14 },
    successScroll: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 48, paddingBottom: 24, alignItems: 'center' },
    successEmoji: { fontSize: 72, marginBottom: 6, textAlign: 'center' },
    successBadge: { backgroundColor: LIGHT_GREEN, borderWidth: 1.5, borderColor: '#86EFAC', borderRadius: 100, paddingHorizontal: 20, paddingVertical: 6, marginBottom: 20 },
    successBadgeText: { color: GREEN, fontWeight: '700', fontSize: 13 },
    successHeading: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
    successSub: { fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 28, paddingHorizontal: 8 },
});
