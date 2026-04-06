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
