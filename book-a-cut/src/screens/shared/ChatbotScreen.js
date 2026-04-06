import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getToken } from '../../services/TokenManager';
import { API_BASE_URL } from '../../config/server';

const { width } = Dimensions.get('window');

// ─── Quick Suggestions ────────────────────────────────────────────────────────
const QUICK_SUGGESTIONS = [
  { id: '1', label: '💇 Book haircut', message: 'Book a haircut' },
  { id: '2', label: '💰 Wallet balance', message: 'What is my wallet balance' },
  { id: '3', label: '⭐ Loyalty points', message: 'How many loyalty points do I have' },
  { id: '4', label: '📅 Booking status', message: 'What is my booking status' },
  { id: '5', label: '🏆 Best barber', message: 'Recommend a barber' },
  { id: '6', label: '❌ Cancel booking', message: 'Cancel my booking' },
  { id: '7', label: '🏠 Home service', message: 'Can the barber come home' },
  { id: '8', label: '💸 Refund policy', message: 'What is the refund policy' },
  { id: '9', label: '💈 Check price', message: 'How much is a haircut' },
  { id: '10', label: '📍 Available barbers', message: 'Who is available today' },
];

const BOT_INTRO = "Hi! I'm your Book-A-Cut AI assistant 🤖\n\nI can help you with:\n• 💇 Book appointments\n• 💰 Check wallet balance\n• ⭐ View loyalty points\n• 📅 Check booking status\n• 🏆 Find top barbers\n• 🏠 Home service booking\n\nTap a quick action below or type your question!";

const formatTime = (date) =>
  new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// ─── Animated Typing Dots ─────────────────────────────────────────────────────
const TypingDots = () => {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    dots.forEach((dot, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, { toValue: -5, duration: 280, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 280, useNativeDriver: true }),
          Animated.delay(480),
        ])
      ).start();
    });
  }, []);

  return (
    <View style={styles.dotsRow}>
      {dots.map((dot, i) => (
        <Animated.View key={i} style={[styles.dot, { transform: [{ translateY: dot }] }]} />
      ))}
    </View>
  );
};

// ─── Message Bubble ────────────────────────────────────────────────────────────
const MessageBubble = ({ item }) => {
  const isUser = item.from === 'user';
  return (
    <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowBot]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>AI</Text>
        </View>
      )}
      <View style={[styles.bubbleWrap, isUser && { alignItems: 'flex-end' }]}>
        <View style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleBot,
          item.isError && styles.bubbleError,
        ]}>
          <Text style={[
            styles.bubbleText,
            isUser ? styles.textUser : styles.textBot,
            item.isError && styles.textError,
          ]}>
            {item.text}
          </Text>
        </View>
        <Text style={[styles.timeText, isUser && { textAlign: 'right' }]}>
          {formatTime(item.time)}
        </Text>
      </View>
      {isUser && <View style={styles.avatarUser}><Text style={styles.avatarUserText}>Me</Text></View>}
    </View>
  );
};

// ─── Main ChatbotScreen ───────────────────────────────────────────────────────
export default function ChatbotScreen({ navigation }) {
  const [messages, setMessages] = useState([
    { id: 'intro', text: BOT_INTRO, from: 'bot', time: new Date() },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const listRef = useRef(null);

  const scrollBottom = () =>
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);

  const addMessage = useCallback((text, from, extra = {}) => {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}_${Math.random()}`, text, from, time: new Date(), ...extra },
    ]);
    scrollBottom();
  }, []);

  const handleAction = useCallback((actionResult) => {
    if (!actionResult) return;
    switch (actionResult.action) {
      case 'NAVIGATE_TO_BOOKING':
        const { prefill } = actionResult;
        if (prefill?.barber?.id) {
            addMessage(`Taking you to ${prefill.barber.name}'s profile! 🗓️`, 'bot');
            setTimeout(() => navigation.navigate('BarberDetails', {
                barberId: prefill.barber.id,
                barberName: prefill.barber.name,
                serviceType: prefill.serviceType || 'salon',
            }), 700);
        } else if (prefill?.serviceType === 'home') {
            addMessage('Taking you to home service providers! 🏠', 'bot');
            setTimeout(() => navigation.navigate('HomeServices'), 700);
        } else {
            addMessage('Taking you to select a barber! 🗓️', 'bot');
            setTimeout(() => navigation.navigate('BarberSelection', {
                 service: prefill?.service ? { name: prefill.service } : null
            }), 700);
        }
        break;
      case 'SHOW_WALLET':
        addMessage(`💰 Wallet Balance\n\nRs ${actionResult.balance.toLocaleString()}`, 'bot');
        break;
      case 'SHOW_LOYALTY': {
        const e = actionResult.tier === 'Gold' ? '🥇' : actionResult.tier === 'Silver' ? '🥈' : '🥉';
        addMessage(`${e} Loyalty Points\n\nPoints: ${actionResult.points}\nTier: ${actionResult.tier}\n\n${actionResult.nextTier}`, 'bot');
        break;
      }
      case 'SHOW_BOOKING_STATUS':
        addMessage(`📋 Your Latest Booking\n\nBarber: ${actionResult.booking.barber}\nDate: ${actionResult.booking.date}\nTime: ${actionResult.booking.time}\nStatus: ${actionResult.booking.status}\nTotal: Rs ${actionResult.booking.price}`, 'bot');
        break;
      case 'NO_BOOKING_FOUND':
        addMessage('No recent bookings found. Want to book one now? 😊', 'bot');
        break;
      case 'SHOW_BARBERS':
        if (actionResult.barbers?.length > 0) {
          const list = actionResult.barbers.map((b, i) => `${i + 1}. ${b.name} ⭐ ${b.rating.toFixed(1)}`).join('\n');
          addMessage(`🏆 Top Rated Barbers\n\n${list}`, 'bot');
        }
        break;
      case 'CONFIRM_CANCEL':
        addMessage(`Found your booking:\n📅 ${actionResult.date} at ${actionResult.time}\nStatus: ${actionResult.status}\n\nGo to My Bookings to cancel it.`, 'bot');
        break;
      case 'NO_ACTIVE_BOOKING':
        addMessage('No active bookings to cancel.', 'bot');
        break;
      case 'NAVIGATE_TO_BARBERS':
        addMessage('Taking you to barbers list! 💇', 'bot');
        setTimeout(() => navigation.navigate('HomeServices'), 700);
        break;
      default:
        break;
    }
  }, [addMessage, navigation]);

  const send = useCallback(async (msgText) => {
    const msg = (msgText || input).trim();
    if (!msg || loading) return;

    setInput('');
    setShowSuggestions(false);
    addMessage(msg, 'user');
    setLoading(true);

    try {
      const token = await getToken(); // uses 'userToken' key ✅

      const res = await fetch(`${API_BASE_URL}/chatbot/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ message: msg }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

      addMessage(data.response, 'bot');
      handleAction(data.actionResult);
    } catch (err) {
      console.log('Chatbot error:', err.message);
      addMessage('Sorry, something went wrong. Please try again. 🙏', 'bot', { isError: true });
    } finally {
      setLoading(false);
    }
  }, [input, loading, addMessage, handleAction]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#1A237E" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>🤖</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>AI Assistant</Text>
            <View style={styles.headerStatusRow}>
              <View style={styles.greenDot} />
              <Text style={styles.headerStatus}>Online • Book-A-Cut AI</Text>
            </View>
          </View>
        </View>

        {/* ── Messages ── */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble item={item} />}
          contentContainerStyle={styles.msgList}
          onContentSizeChange={scrollBottom}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />

        {/* ── Typing indicator ── */}
        {loading && (
          <View style={styles.typingRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>AI</Text>
            </View>
            <View style={styles.typingBubble}>
              <TypingDots />
            </View>
          </View>
        )}

        {/* ── Quick Suggestions ── */}
        {showSuggestions && (
          <View style={styles.suggestBox}>
            <Text style={styles.suggestTitle}>✨ Quick Actions</Text>
            <FlatList
              horizontal
              data={QUICK_SUGGESTIONS}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.chip}
                  onPress={() => send(item.message)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.chipText}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* ── Input Bar ── */}
        <View style={styles.inputBar}>
          <TouchableOpacity
            style={styles.ideaBtn}
            onPress={() => setShowSuggestions((v) => !v)}
          >
            <Text style={styles.ideaBtnText}>{showSuggestions ? '✕' : '💡'}</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type your question..."
            placeholderTextColor="#9e9e9e"
            returnKeyType="send"
            onSubmitEditing={() => send()}
            editable={!loading}
            multiline
            maxLength={500}
          />

          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnOff]}
            onPress={() => send()}
            disabled={!input.trim() || loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.sendIcon}>➤</Text>
            }
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1A237E' },
  flex: { flex: 1, backgroundColor: '#F4F6FA' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A237E',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
  headerAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#7C4DFF',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  headerAvatarText: { fontSize: 22 },
  headerInfo: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  headerStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#69F0AE' },
  headerStatus: { color: '#B0BEC5', fontSize: 12 },

  // Messages
  msgList: { paddingHorizontal: 14, paddingVertical: 16, gap: 14, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowBot: { justifyContent: 'flex-start' },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#7C4DFF',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18, flexShrink: 0,
  },
  avatarText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  avatarUser: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#1A237E',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18, flexShrink: 0,
  },
  avatarUserText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  bubbleWrap: { maxWidth: width * 0.72 },
  bubble: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 22 },
  bubbleUser: {
    backgroundColor: '#1A237E',
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  bubbleError: { backgroundColor: '#FFF3F3', borderWidth: 1, borderColor: '#FFCDD2' },
  bubbleText: { fontSize: 14.5, lineHeight: 22 },
  textUser: { color: '#fff' },
  textBot: { color: '#1a1a2e' },
  textError: { color: '#c62828' },
  timeText: { fontSize: 10, color: '#bbb', marginTop: 4, marginLeft: 2 },

  // Typing
  typingRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingBottom: 6, gap: 8,
  },
  typingBubble: {
    backgroundColor: '#fff', borderRadius: 22, borderBottomLeftRadius: 4,
    paddingHorizontal: 18, paddingVertical: 13, elevation: 2,
  },
  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 18 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7C4DFF' },

  // Suggestions
  suggestBox: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E8EDF2',
    paddingTop: 10,
    paddingBottom: 6,
  },
  suggestTitle: {
    fontSize: 11, color: '#9E9E9E', marginLeft: 14,
    marginBottom: 8, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  suggestList: { paddingHorizontal: 12, gap: 8, paddingBottom: 2 },
  chip: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5, borderColor: '#3949AB',
    borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8,
  },
  chipText: { color: '#1A237E', fontSize: 12.5, fontWeight: '600' },

  // Input Bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E8EDF2',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -2 },
  },
  ideaBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 1,
  },
  ideaBtnText: { fontSize: 18 },
  input: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    borderWidth: 1.5,
    borderColor: '#DDE3EA',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: '#212121',
    maxHeight: 110,
    lineHeight: 20,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1A237E',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 1,
    elevation: 2,
  },
  sendBtnOff: { backgroundColor: '#B0BEC5' },
  sendIcon: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginLeft: 2 },
});