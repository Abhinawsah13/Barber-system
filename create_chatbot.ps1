# ============================================================
# Book-A-Cut Chatbot File Creator
# Save this in Barber-system/ and run with PowerShell
# ============================================================

Write-Host "Creating Book-A-Cut Chatbot files..." -ForegroundColor Cyan

# Create folders
New-Item -ItemType Directory -Force -Path "chatbot" | Out-Null
New-Item -ItemType Directory -Force -Path "backend\src\services" | Out-Null
New-Item -ItemType Directory -Force -Path "backend\src\controllers" | Out-Null
New-Item -ItemType Directory -Force -Path "backend\src\routes" | Out-Null
New-Item -ItemType Directory -Force -Path "book-a-cut\src\screens\shared" | Out-Null

Write-Host "Folders created." -ForegroundColor Green

# ─── FILE 1: chatbot/train.py ────────────────────────────────
$train = @'
import json
import pickle
import numpy as np
import nltk
from nltk.stem import LancasterStemmer
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import LabelEncoder

nltk.download('punkt')
nltk.download('punkt_tab')

stemmer = LancasterStemmer()

intents = {
    "intents": [
        {
            "tag": "greeting",
            "patterns": ["Hello", "Hi", "Hey", "Good morning", "Good afternoon",
                         "What's up", "Howdy", "Hi there", "Hey there", "Greetings"],
            "responses": ["Hi! I am your Book-A-Cut assistant. How can I help you today?",
                          "Hello! Ready to help you book your next appointment.",
                          "Hey there! What can I do for you today?"]
        },
        {
            "tag": "goodbye",
            "patterns": ["Bye", "Goodbye", "See you", "See you later", "Thanks bye",
                         "Take care", "That is all", "I am done", "Exit", "Quit"],
            "responses": ["Goodbye! Come back anytime.",
                          "See you soon! Have a great day.",
                          "Take care! Your next haircut awaits."]
        },
        {
            "tag": "book_appointment",
            "patterns": [
                "Book a haircut", "I want to book", "Schedule an appointment",
                "Book with Raju", "Book haircut tomorrow 3pm", "Can I get a haircut",
                "I need a trim", "Make an appointment", "Reserve a slot",
                "Book me in", "I want an appointment", "Set up a booking",
                "Can you book for me", "Book a beard trim", "I need a shave",
                "Book haircut at 2pm", "Appointment for tomorrow", "Book next Monday",
                "I want to schedule", "Get me a slot", "Book barber today"
            ],
            "responses": ["I can help you book! Which barber and service do you need?",
                          "Sure! Tell me the service, barber name, date and time.",
                          "Let me help you schedule that appointment!"]
        },
        {
            "tag": "check_availability",
            "patterns": [
                "Is Raju available", "When is the barber free", "Check availability",
                "Who is available today", "Any slots today", "Is there a slot at 3pm",
                "Are there open slots", "What times are free", "When can I come in",
                "Check barber schedule", "Is anyone free tomorrow", "Available barbers",
                "Free slots this afternoon", "Open appointment times"
            ],
            "responses": ["Let me check availability for you.",
                          "Checking open slots now...",
                          "I will look up available times for you."]
        },
        {
            "tag": "cancel_booking",
            "patterns": [
                "Cancel my booking", "I want to cancel", "Cancel appointment",
                "Remove my booking", "Delete my appointment", "Cancel my reservation",
                "I need to cancel", "Cancel booking please", "Cancel my slot",
                "I cannot make it", "Need to cancel"
            ],
            "responses": ["I can help you cancel. Let me find your booking.",
                          "Sure, I will look up your current booking to cancel.",
                          "Let me pull up your booking details for cancellation."]
        },
        {
            "tag": "check_price",
            "patterns": [
                "How much is a haircut", "What is the price", "How much does it cost",
                "Price list", "Rates", "What are the charges", "Cost of services",
                "How much for a beard trim", "Service prices", "What do you charge",
                "Price of haircut", "Fees", "How expensive is it"
            ],
            "responses": ["Service prices vary by barber. A haircut typically starts from Rs 200.",
                          "Prices depend on the service and barber. Browse barbers to see exact rates.",
                          "Check individual barber profiles for their service pricing."]
        },
        {
            "tag": "check_status",
            "patterns": [
                "What is my booking status", "Is my booking confirmed", "Status of my appointment",
                "Did the barber accept", "My booking status", "Check my appointment",
                "What happened to my booking", "Has my booking been confirmed",
                "Is my appointment approved", "Track my booking", "Booking update"
            ],
            "responses": ["Let me check your latest booking status.",
                          "Checking your booking now...",
                          "I will look up your current appointment status."]
        },
        {
            "tag": "wallet_balance",
            "patterns": [
                "What is my wallet balance", "How much in my wallet", "Check my balance",
                "Wallet amount", "My wallet", "How much money do I have",
                "Check wallet", "Wallet funds", "Available balance", "My account balance"
            ],
            "responses": ["Let me fetch your wallet balance.",
                          "Checking your wallet now...",
                          "I will look up your current balance."]
        },
        {
            "tag": "loyalty_points",
            "patterns": [
                "How many points do I have", "My loyalty points", "Check my points",
                "Points balance", "What tier am I", "Loyalty tier", "My rewards",
                "How many rewards", "Bronze Silver Gold", "Redeem points",
                "Points earned", "My loyalty status", "Reward points check"
            ],
            "responses": ["Let me check your loyalty points and tier.",
                          "Checking your rewards balance...",
                          "I will look up your points and current tier status."]
        },
        {
            "tag": "home_service",
            "patterns": [
                "Can the barber come home", "Home service available", "Book home visit",
                "I want barber at my location", "Do you do home visits", "Home haircut",
                "Barber at my house", "Can someone come to me", "Home delivery service",
                "Visit me at home", "Barber to my address"
            ],
            "responses": ["Yes we offer home services! The barber will come to your location.",
                          "Home service is available. A travel charge applies based on distance.",
                          "Absolutely! Book a home service and share your GPS location when booking."]
        },
        {
            "tag": "refund",
            "patterns": [
                "I want a refund", "Refund my payment", "How do I get refund",
                "Cancel and refund", "Money back", "Get my money back",
                "Refund policy", "Cancellation refund", "How much refund will I get",
                "Partial refund", "Full refund"
            ],
            "responses": [
                "Our refund policy: more than 2 hours before gets 100 percent refund. 1 to 2 hours gets 70 percent. Less than 1 hour gets 50 percent. No refund if service has started.",
                "Refunds depend on when you cancel. Cancel early for the best refund rate.",
                "Your refund amount depends on how far in advance you cancel your booking."
            ]
        },
        {
            "tag": "recommend_barber",
            "patterns": [
                "Who is the best barber", "Recommend a barber", "Which barber should I choose",
                "Top rated barber", "Best barber near me", "Good barber recommendation",
                "Suggest a barber", "Who should I book", "Highest rated barber",
                "Popular barbers", "Barber recommendation"
            ],
            "responses": ["Let me find the top rated barbers for you!",
                          "I will show you our highest rated barbers.",
                          "Here are the best reviewed barbers available."]
        },
        {
            "tag": "unclear",
            "patterns": ["hmm", "I do not know", "not sure", "maybe", "whatever",
                         "ok", "okay", "alright", "sure", "fine"],
            "responses": ["I did not quite catch that. Could you rephrase?",
                          "Can you be more specific? I can help with bookings, wallet, points, and more.",
                          "Sorry I did not understand. Try asking about booking, wallet balance, or loyalty points."]
        }
    ]
}

with open('intents.json', 'w') as f:
    json.dump(intents, f)

words = []
classes = []
documents = []
ignore_chars = ['?', '!', '.', ',', "'"]

for intent in intents['intents']:
    for pattern in intent['patterns']:
        word_list = nltk.word_tokenize(pattern)
        words.extend(word_list)
        documents.append((word_list, intent['tag']))
        if intent['tag'] not in classes:
            classes.append(intent['tag'])

words = sorted(set([
    stemmer.stem(w.lower()) for w in words if w not in ignore_chars
]))
classes = sorted(set(classes))

print(f"Words: {len(words)}, Classes: {len(classes)}, Documents: {len(documents)}")

training_X = []
training_y = []

for doc_words, tag in documents:
    bag = []
    word_patterns = [stemmer.stem(w.lower()) for w in doc_words]
    for w in words:
        bag.append(1 if w in word_patterns else 0)
    training_X.append(bag)
    training_y.append(tag)

training_X = np.array(training_X)
training_y = np.array(training_y)

le = LabelEncoder()
training_y_encoded = le.fit_transform(training_y)

print("Training model...")
model = MLPClassifier(
    hidden_layer_sizes=(256, 128),
    activation='relu',
    solver='adam',
    max_iter=1000,
    random_state=42,
    early_stopping=True,
    validation_fraction=0.1,
    n_iter_no_change=20
)
model.fit(training_X, training_y_encoded)

train_accuracy = model.score(training_X, training_y_encoded)
print(f"Training accuracy: {train_accuracy:.2%}")

pickle.dump(model, open('chatbot_model.pkl', 'wb'))
pickle.dump(words, open('words.pkl', 'wb'))
pickle.dump(classes, open('classes.pkl', 'wb'))
pickle.dump(le, open('label_encoder.pkl', 'wb'))

print("Model trained and saved successfully!")
print(f"Intents: {classes}")
'@
Set-Content -Path "chatbot\train.py" -Value $train -Encoding UTF8
Write-Host "Created: chatbot/train.py" -ForegroundColor Green

# ─── FILE 2: chatbot/app.py ──────────────────────────────────
$app = @'
from flask import Flask, request, jsonify
import pickle
import json
import nltk
import numpy as np
import re
import random
from datetime import datetime, timedelta
from nltk.stem import LancasterStemmer

app = Flask(__name__)
stemmer = LancasterStemmer()

model = pickle.load(open('chatbot_model.pkl', 'rb'))
words = pickle.load(open('words.pkl', 'rb'))
classes = pickle.load(open('classes.pkl', 'rb'))
le = pickle.load(open('label_encoder.pkl', 'rb'))

with open('intents.json', 'r') as f:
    intents_data = json.load(f)


def clean_sentence(sentence):
    tokens = nltk.word_tokenize(sentence)
    return [stemmer.stem(w.lower()) for w in tokens]


def bag_of_words(sentence):
    s_words = clean_sentence(sentence)
    bag = [1 if w in s_words else 0 for w in words]
    return np.array(bag)


def predict_intent(sentence):
    bow = bag_of_words(sentence)
    probs = model.predict_proba([bow])[0]
    idx = np.argmax(probs)
    confidence = float(probs[idx])
    intent_label = le.inverse_transform([idx])[0]
    return intent_label, confidence


def get_response(intent_tag):
    for intent in intents_data['intents']:
        if intent['tag'] == intent_tag:
            return random.choice(intent['responses'])
    return "How can I help you today?"


def extract_entities(sentence):
    entities = {}
    sentence_lower = sentence.lower()

    time_patterns = [
        r'(\d{1,2}:\d{2})\s*(am|pm)?',
        r'(\d{1,2})\s*(am|pm)',
    ]
    for pattern in time_patterns:
        match = re.search(pattern, sentence_lower)
        if match:
            entities['time'] = match.group(0).strip()
            break

    if 'tomorrow' in sentence_lower:
        entities['date'] = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
    elif 'today' in sentence_lower:
        entities['date'] = datetime.now().strftime('%Y-%m-%d')
    elif 'next monday' in sentence_lower:
        entities['date'] = 'next_monday'
    elif 'next week' in sentence_lower:
        entities['date'] = 'next_week'

    services = {
        'haircut': 'haircut', 'trim': 'trim', 'shave': 'shave',
        'beard': 'beard trim', 'facial': 'facial', 'massage': 'head massage',
        'color': 'hair color', 'style': 'hair styling', 'wash': 'hair wash'
    }
    for keyword, service_name in services.items():
        if keyword in sentence_lower:
            entities['service'] = service_name
            break

    name_match = re.search(r'\bwith\s+([A-Z][a-z]+)\b', sentence)
    if name_match:
        entities['barber_name'] = name_match.group(1)
    else:
        cap_words = re.findall(r'\b([A-Z][a-z]{2,})\b', sentence)
        common_words = {'Book', 'Schedule', 'Cancel', 'Check', 'Show', 'Get', 'Find', 'The', 'Today', 'Tomorrow'}
        for word in cap_words:
            if word not in common_words:
                entities['barber_name'] = word
                break

    return entities


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'model': 'Book-A-Cut ML Chatbot v1.0'})


@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    if not data or 'message' not in data:
        return jsonify({'error': 'No message provided'}), 400
    message = data.get('message', '').strip()
    if not message:
        return jsonify({'error': 'Empty message'}), 400

    intent, confidence = predict_intent(message)
    if confidence < 0.60:
        intent = 'unclear'

    entities = extract_entities(message)
    response = get_response(intent)

    return jsonify({
        'intent': intent,
        'confidence': round(confidence, 3),
        'response': response,
        'entities': entities
    })


@app.route('/intents', methods=['GET'])
def get_intents():
    return jsonify({'intents': classes})


if __name__ == '__main__':
    print("Starting Book-A-Cut AI Chatbot Server...")
    print(f"Loaded {len(words)} words, {len(classes)} intents")
    app.run(host='0.0.0.0', port=5001, debug=False)
'@
Set-Content -Path "chatbot\app.py" -Value $app -Encoding UTF8
Write-Host "Created: chatbot/app.py" -ForegroundColor Green

# ─── FILE 3: chatbotService.js ───────────────────────────────
$service = @'
const axios = require("axios");

const ML_API_URL = process.env.ML_API_URL || "http://localhost:5001";

const getChatbotResponse = async (message) => {
  try {
    const response = await axios.post(
      `${ML_API_URL}/predict`,
      { message },
      { timeout: 8000 }
    );
    return response.data;
  } catch (error) {
    console.error("ML API error:", error.message);
    return {
      intent: "error",
      confidence: 0,
      response: "I am having a little trouble right now. Please try again in a moment.",
      entities: {},
    };
  }
};

const checkMLHealth = async () => {
  try {
    const response = await axios.get(`${ML_API_URL}/health`, { timeout: 3000 });
    return response.data;
  } catch {
    return { status: "offline" };
  }
};

module.exports = { getChatbotResponse, checkMLHealth };
'@
Set-Content -Path "backend\src\services\chatbotService.js" -Value $service -Encoding UTF8
Write-Host "Created: backend/src/services/chatbotService.js" -ForegroundColor Green

# ─── FILE 4: chatbotController.js ───────────────────────────
$controller = @'
const { getChatbotResponse, checkMLHealth } = require("../services/chatbotService");
const User = require("../models/User");
const Booking = require("../models/Booking");
const BarberProfile = require("../models/BarberProfile");

exports.chat = async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message cannot be empty" });
    }

    const mlResult = await getChatbotResponse(message.trim());
    const { intent, confidence, response, entities } = mlResult;

    let actionResult = null;

    switch (intent) {
      case "book_appointment": {
        if (entities.service || entities.date || entities.barber_name) {
          let barberInfo = null;
          if (entities.barber_name) {
            const barberUser = await User.findOne({
              username: new RegExp(entities.barber_name, "i"),
              user_type: "barber",
            }).select("_id username");
            if (barberUser) {
              barberInfo = { id: barberUser._id, name: barberUser.username };
            }
          }
          actionResult = {
            action: "NAVIGATE_TO_BOOKING",
            prefill: {
              service: entities.service || null,
              date: entities.date || null,
              time: entities.time || null,
              barber: barberInfo,
            },
          };
        }
        break;
      }

      case "check_status": {
        const latestBooking = await Booking.findOne({ customer: userId })
          .sort({ createdAt: -1 })
          .populate("barber", "username")
          .select("status date time_slot total_price");
        if (latestBooking) {
          actionResult = {
            action: "SHOW_BOOKING_STATUS",
            booking: {
              status: latestBooking.status,
              date: latestBooking.date,
              time: latestBooking.time_slot,
              price: latestBooking.total_price,
              barber: latestBooking.barber?.username || "Unknown",
            },
          };
        } else {
          actionResult = { action: "NO_BOOKING_FOUND", message: "You have no recent bookings." };
        }
        break;
      }

      case "wallet_balance": {
        const user = await User.findById(userId).select("wallet_balance");
        actionResult = { action: "SHOW_WALLET", balance: user.wallet_balance || 0 };
        break;
      }

      case "loyalty_points": {
        const user = await User.findById(userId).select("loyalty_points");
        const points = user.loyalty_points || 0;
        const tier = points >= 300 ? "Gold" : points >= 100 ? "Silver" : "Bronze";
        const nextTier =
          tier === "Bronze" ? `${100 - points} points to Silver`
          : tier === "Silver" ? `${300 - points} points to Gold`
          : "Maximum tier reached!";
        actionResult = { action: "SHOW_LOYALTY", points, tier, nextTier };
        break;
      }

      case "recommend_barber": {
        const topBarbers = await BarberProfile.find({})
          .sort({ "rating.average": -1 })
          .limit(3)
          .populate("user", "username");
        actionResult = {
          action: "SHOW_BARBERS",
          barbers: topBarbers.map((b) => ({
            name: b.user?.username || "Unknown",
            rating: b.rating?.average || 0,
            services: b.services?.slice(0, 3) || [],
          })),
        };
        break;
      }

      case "cancel_booking": {
        const activeBooking = await Booking.findOne({
          customer: userId,
          status: { $in: ["pending", "confirmed"] },
        }).sort({ createdAt: -1 }).select("_id status date time_slot total_price");
        if (activeBooking) {
          actionResult = {
            action: "CONFIRM_CANCEL",
            bookingId: activeBooking._id,
            date: activeBooking.date,
            time: activeBooking.time_slot,
            price: activeBooking.total_price,
            status: activeBooking.status,
          };
        } else {
          actionResult = { action: "NO_ACTIVE_BOOKING", message: "You have no active bookings to cancel." };
        }
        break;
      }

      case "check_availability": {
        actionResult = { action: "NAVIGATE_TO_BARBERS", message: "Browse available barbers and their open slots." };
        break;
      }

      case "home_service": {
        actionResult = { action: "NAVIGATE_TO_BOOKING", prefill: { serviceType: "home" } };
        break;
      }

      default:
        actionResult = null;
        break;
    }

    return res.json({ response, intent, confidence, entities, actionResult });
  } catch (err) {
    console.error("Chatbot controller error:", err.message);
    return res.status(500).json({
      response: "Something went wrong. Please try again.",
      intent: "error",
      confidence: 0,
      entities: {},
      actionResult: null,
    });
  }
};

exports.health = async (req, res) => {
  const mlStatus = await checkMLHealth();
  return res.json({ chatbot: "online", ml_model: mlStatus });
};
'@
Set-Content -Path "backend\src\controllers\chatbotController.js" -Value $controller -Encoding UTF8
Write-Host "Created: backend/src/controllers/chatbotController.js" -ForegroundColor Green

# ─── FILE 5: chatbotRoutes.js ────────────────────────────────
$routes = @'
const express = require("express");
const router = express.Router();
const chatbotController = require("../controllers/chatbotController");
const auth = require("../middleware/auth");

router.post("/chat", auth, chatbotController.chat);
router.get("/health", chatbotController.health);

module.exports = router;
'@
Set-Content -Path "backend\src\routes\chatbotRoutes.js" -Value $routes -Encoding UTF8
Write-Host "Created: backend/src/routes/chatbotRoutes.js" -ForegroundColor Green

# ─── FILE 6: ChatbotScreen.js ────────────────────────────────
$screen = @'
import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, SafeAreaView,
} from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// TODO: Change x to your PC local IP address (run ipconfig to find it)
const API_URL = "http://192.168.1.x:5000";

const QUICK_SUGGESTIONS = [
  "Book a haircut",
  "My wallet balance",
  "My loyalty points",
  "Check booking status",
  "Recommend a barber",
  "Cancel my booking",
];

const BOT_INTRO =
  "Hi! I am your Book-A-Cut AI assistant. I can help you book appointments, check your wallet balance, loyalty points, booking status, and more. Just ask me anything!";

export default function ChatbotScreen({ navigation }) {
  const [messages, setMessages] = useState([
    { id: "intro", text: BOT_INTRO, from: "bot", time: new Date() },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const listRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => { listRef.current?.scrollToEnd({ animated: true }); }, 150);
  }, []);

  const addMessage = useCallback((text, from) => {
    const newMsg = { id: `${Date.now()}_${from}_${Math.random()}`, text, from, time: new Date() };
    setMessages((prev) => [...prev, newMsg]);
    scrollToBottom();
  }, [scrollToBottom]);

  const handleActionResult = useCallback((actionResult) => {
    if (!actionResult) return;
    switch (actionResult.action) {
      case "NAVIGATE_TO_BOOKING":
        addMessage("Taking you to the booking screen now!", "bot");
        setTimeout(() => navigation.navigate("BookingScreen", { prefill: actionResult.prefill }), 800);
        break;
      case "SHOW_WALLET":
        addMessage(`Your current wallet balance is Rs ${actionResult.balance.toLocaleString()}`, "bot");
        break;
      case "SHOW_LOYALTY":
        addMessage(`You have ${actionResult.points} loyalty points.\nTier: ${actionResult.tier}\n${actionResult.nextTier}`, "bot");
        break;
      case "SHOW_BOOKING_STATUS":
        addMessage(`Your latest booking:\nStatus: ${actionResult.booking.status}\nDate: ${actionResult.booking.date}\nTime: ${actionResult.booking.time}\nBarber: ${actionResult.booking.barber}\nTotal: Rs ${actionResult.booking.price}`, "bot");
        break;
      case "NO_BOOKING_FOUND":
        addMessage("You have no recent bookings. Would you like to book one now?", "bot");
        break;
      case "SHOW_BARBERS":
        if (actionResult.barbers && actionResult.barbers.length > 0) {
          const barberList = actionResult.barbers.map((b, i) => `${i + 1}. ${b.name} - ${b.rating.toFixed(1)} stars`).join("\n");
          addMessage(`Top rated barbers right now:\n${barberList}`, "bot");
        }
        break;
      case "CONFIRM_CANCEL":
        addMessage(`Found your booking for ${actionResult.date} at ${actionResult.time}.\nStatus: ${actionResult.status}\nGo to My Bookings to cancel and receive your refund.`, "bot");
        break;
      case "NO_ACTIVE_BOOKING":
        addMessage("You have no active bookings to cancel.", "bot");
        break;
      case "NAVIGATE_TO_BARBERS":
        addMessage("Let me take you to the barber listing!", "bot");
        setTimeout(() => navigation.navigate("BarbersScreen"), 800);
        break;
      default:
        break;
    }
  }, [addMessage, navigation]);

  const send = useCallback(async (messageText) => {
    const msg = (messageText || input).trim();
    if (!msg || loading) return;
    setInput("");
    setShowSuggestions(false);
    addMessage(msg, "user");
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await axios.post(
        `${API_URL}/api/chatbot/chat`,
        { message: msg },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
      );
      const { response, actionResult } = res.data;
      addMessage(response, "bot");
      handleActionResult(actionResult);
    } catch (err) {
      addMessage(err.response?.data?.error || "I could not reach the server. Please check your connection.", "bot");
    } finally {
      setLoading(false);
    }
  }, [input, loading, addMessage, handleActionResult]);

  const formatTime = (date) => new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const renderMessage = useCallback(({ item }) => {
    const isUser = item.from === "user";
    return (
      <View style={[styles.messageRow, isUser ? styles.userRow : styles.botRow]}>
        {!isUser && (
          <View style={styles.botAvatar}>
            <Text style={styles.botAvatarText}>AI</Text>
          </View>
        )}
        <View style={styles.bubbleContainer}>
          <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
            <Text style={[styles.bubbleText, isUser ? styles.userText : styles.botText]}>{item.text}</Text>
          </View>
          <Text style={[styles.timeText, isUser && styles.userTime]}>{formatTime(item.time)}</Text>
        </View>
      </View>
    );
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View style={styles.header}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>AI</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Book-A-Cut Assistant</Text>
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.headerSub}>AI Powered</Text>
            </View>
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          renderItem={renderMessage}
          onContentSizeChange={scrollToBottom}
          showsVerticalScrollIndicator={false}
        />

        {showSuggestions && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsLabel}>Quick actions</Text>
            <FlatList
              horizontal
              data={QUICK_SUGGESTIONS}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionsList}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.suggestionChip} onPress={() => send(item)}>
                  <Text style={styles.suggestionText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {loading && (
          <View style={styles.typingContainer}>
            <View style={styles.botAvatar}>
              <Text style={styles.botAvatarText}>AI</Text>
            </View>
            <View style={styles.typingBubble}>
              <ActivityIndicator size="small" color="#1e3448" />
              <Text style={styles.typingText}>Thinking...</Text>
            </View>
          </View>
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Ask me anything..."
            placeholderTextColor="#aaa"
            onSubmitEditing={() => send()}
            returnKeyType="send"
            multiline={false}
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]}
            onPress={() => send()}
            disabled={!input.trim() || loading}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#1e3448" },
  container: { flex: 1, backgroundColor: "#f0f4f8" },
  header: { flexDirection: "row", alignItems: "center", backgroundColor: "#1e3448", paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  headerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#7c3aed", alignItems: "center", justifyContent: "center" },
  headerAvatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  headerInfo: { flex: 1 },
  headerTitle: { color: "#fff", fontSize: 16, fontWeight: "600" },
  onlineRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#4ade80" },
  headerSub: { color: "#8ab4cc", fontSize: 12 },
  messageList: { padding: 12, paddingBottom: 4, gap: 10 },
  messageRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginVertical: 2 },
  userRow: { justifyContent: "flex-end" },
  botRow: { justifyContent: "flex-start" },
  botAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#7c3aed", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  botAvatarText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  bubbleContainer: { maxWidth: "75%" },
  bubble: { padding: 12, borderRadius: 18 },
  userBubble: { backgroundColor: "#1e3448", borderBottomRightRadius: 4 },
  botBubble: { backgroundColor: "#fff", borderBottomLeftRadius: 4, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  bubbleText: { fontSize: 14, lineHeight: 21 },
  userText: { color: "#fff" },
  botText: { color: "#1a1a1a" },
  timeText: { fontSize: 10, color: "#aaa", marginTop: 3, marginLeft: 4 },
  userTime: { textAlign: "right", marginRight: 4 },
  suggestionsContainer: { backgroundColor: "#fff", paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: "#e5e7eb" },
  suggestionsLabel: { fontSize: 11, color: "#999", marginLeft: 14, marginBottom: 6, fontWeight: "500" },
  suggestionsList: { paddingHorizontal: 12, gap: 8 },
  suggestionChip: { backgroundColor: "#f0f4f8", borderWidth: 1, borderColor: "#1e3448", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  suggestionText: { color: "#1e3448", fontSize: 12, fontWeight: "500" },
  typingContainer: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 6, gap: 8 },
  typingBubble: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, gap: 8, elevation: 1 },
  typingText: { fontSize: 13, color: "#888" },
  inputBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderTopWidth: 0.5, borderTopColor: "#e5e7eb", paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  textInput: { flex: 1, backgroundColor: "#f5f7fa", borderWidth: 0.5, borderColor: "#d1d5db", borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: "#111" },
  sendButton: { backgroundColor: "#1e3448", borderRadius: 24, paddingHorizontal: 20, paddingVertical: 11, justifyContent: "center", alignItems: "center" },
  sendButtonDisabled: { backgroundColor: "#b0bec5" },
  sendButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
'@
Set-Content -Path "book-a-cut\src\screens\shared\ChatbotScreen.js" -Value $screen -Encoding UTF8
Write-Host "Created: book-a-cut/src/screens/shared/ChatbotScreen.js" -ForegroundColor Green

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "All 6 files created successfully!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. Add to backend/src/server.js:" -ForegroundColor White
Write-Host '   app.use("/api/chatbot", require("./routes/chatbotRoutes"));' -ForegroundColor Gray
Write-Host ""
Write-Host "2. Add to backend/.env:" -ForegroundColor White
Write-Host "   ML_API_URL=http://localhost:5001" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Run these commands:" -ForegroundColor White
Write-Host "   cd chatbot" -ForegroundColor Gray
Write-Host "   pip install flask scikit-learn nltk numpy" -ForegroundColor Gray
Write-Host "   python train.py" -ForegroundColor Gray
Write-Host "   python app.py" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Update API_URL in ChatbotScreen.js with your IP" -ForegroundColor White
Write-Host "   Run 'ipconfig' in CMD to find your IP address" -ForegroundColor Gray
Write-Host ""