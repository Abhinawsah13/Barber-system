import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Image,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { getToken } from '../../services/TokenManager';
import { BASE_URL } from '../../services/api';

export default function AIChatScreen({ navigation }) {
    const [messages, setMessages] = useState([
        {
            id: '1',
            text: "Hello! I'm your AI Barber Assistant. 🤖\nI can help you find a style, book a cut, or answer questions about our services. How can I help you today?",
            sender: 'ai',
            timestamp: new Date().toISOString(),
        }
    ]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [recording, setRecording] = useState();
    const [isRecording, setIsRecording] = useState(false);
    const flatListRef = useRef();

    const startRecording = async () => {
        if (isRecording || recording) return;
        try {
            console.log('Requesting permissions..');
            const perm = await Audio.requestPermissionsAsync();
            if (perm.status === 'granted') {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: true,
                    playsInSilentModeIOS: true,
                    shouldDuckAndroid: true,
                    playThroughEarpieceAndroid: false,
                    staysActiveInBackground: false,
                });
                console.log('Starting recording..');
                Speech.stop(); // Stop any AI talking
                
                const { recording: newRecording } = await Audio.Recording.createAsync(
                    Audio.RecordingOptionsPresets.HIGH_QUALITY
                );
                setRecording(newRecording);
                setIsRecording(true);
            }
        } catch (err) {
            console.error('Failed to start recording', err);
            setIsRecording(false);
            setRecording(null);
        }
    };

    const stopRecording = async () => {
        if (!recording) return;
        setIsRecording(false);
        console.log('Stopping recording..');
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setRecording(undefined);

        // Convert Audio to Base64
        console.log('Reading base64 from', uri);
        const base64Audio = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
        });

        // Send immediately to AI
        handleSend(base64Audio);
    };

    const handleSend = async (audioDataRaw = null) => {
        const isVoiceMode = typeof audioDataRaw === 'string';
        if (!isVoiceMode && inputText.trim().length === 0) return;

        const newUserMsg = {
            id: Date.now().toString(),
            text: isVoiceMode ? "🎤 Voice Message" : inputText,
            sender: 'user',
            timestamp: new Date().toISOString(),
        };

        setMessages(prev => [...prev, newUserMsg]);
        if (!isVoiceMode) setInputText('');
        setIsTyping(true);

        try {
            const token = await getToken();
            const apiUrl = `${BASE_URL}/v2/ai/chat`;
            console.log(`[AI] Sending request to: ${apiUrl}`);
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    message: isVoiceMode ? '' : inputText.trim(),
                    audioData: isVoiceMode ? audioDataRaw : null,
                    history: messages.map(m => ({ role: m.sender, text: m.text }))
                })
            });
            const data = await response.json();

            // Speak the reply out loud! 🗣️
            if (data.reply) {
                console.log('[AI] Assistant says:', data.reply);
                Speech.speak(data.reply, { language: 'en', rate: 1.05 });
            }

            const newAiMsg = {
                id: Date.now().toString(),
                text: data.reply || data.message || "I'm sorry, I couldn't process that.",
                sender: 'ai',
                timestamp: new Date().toISOString(),
                toolUsed: data.toolUsed
            };

            setMessages(prev => [...prev, newAiMsg]);
        } catch (error) {
            console.error('AI Chat Error:', error);
            const errorMsg = {
                id: Date.now().toString(),
                text: "Connection lost. Please try again later.",
                sender: 'ai',
                timestamp: new Date().toISOString(),
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    const renderMessage = ({ item }) => {
        const isUser = item.sender === 'user';
        return (
            <View style={[
                styles.messageBubble,
                isUser ? styles.userBubble : styles.aiBubble
            ]}>
                {!isUser && (
                    <View style={styles.botAvatar}>
                        <Text style={{ fontSize: 16 }}>🤖</Text>
                    </View>
                )}
                <View style={[
                    styles.messageContent,
                    isUser ? styles.userContent : styles.aiContent,
                    item.toolUsed && { borderColor: '#4CAF50', borderWidth: 2 } // Highlight if AI modified data
                ]}>
                    <Text style={[
                        styles.messageText,
                        isUser ? styles.userText : styles.aiText
                    ]}>{item.text}</Text>
                    
                    {item.toolUsed && (
                        <Text style={{ fontSize: 10, color: '#4CAF50', marginTop: 4 }}>
                            ✓ Data updated via {item.toolUsed}
                        </Text>
                    )}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>←</Text>
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>AI Assistant</Text>
                    <Text style={styles.headerSubtitle}>Powered by Google Gemini</Text>
                </View>
                <TouchableOpacity style={styles.moreBtn}>
                    <Text style={{ fontSize: 20 }}>⋮</Text>
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
                style={{ flex: 1 }}
            >
                {/* Chat Area */}
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.chatContent}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                />

                {/* Typing Indicator */}
                {isTyping && (
                    <View style={styles.typingContainer}>
                        <Text style={styles.typingText}>AI is typing...</Text>
                    </View>
                )}

                {/* Input Area */}
                <View style={{ paddingHorizontal: 15, paddingBottom: 5 }}>
                    <Text style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>
                        🎤 Use your keyboard's microphone or Hold the icon below
                    </Text>
                </View>
                <View style={[styles.inputContainer, { paddingBottom: Platform.OS === 'ios' ? 30 : 20 }]}>
                    <TouchableOpacity 
                        style={[
                            styles.attachBtn, 
                            isRecording && { backgroundColor: '#ff4444', borderRadius: 20, transform: [{ scale: 1.1 }] }
                        ]} 
                        onPressIn={startRecording}
                        onPressOut={stopRecording}
                    >
                        {isRecording ? (
                             <ActivityIndicator color="#fff" size="small" />
                        ) : (
                             <Text style={{ fontSize: 20 }}>🎙️</Text>
                        )}
                    </TouchableOpacity>
                    <TextInput
                        style={[styles.input, isRecording && { opacity: 0.5 }]}
                        placeholder={isRecording ? "🔴 Listening... Release to Send" : "Type a message..."}
                        placeholderTextColor={isRecording ? "#ff4444" : "#999"}
                        value={inputText}
                        onChangeText={setInputText}
                        editable={!isRecording}
                    />
                    <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
                        <Text style={{ fontSize: 18, color: '#FFF' }}>➤</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
    },
    backBtn: {
        padding: 10,
    },
    backText: {
        fontSize: 24,
        color: '#333',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#9C27B0',
        textAlign: 'center',
    },
    moreBtn: {
        padding: 10,
    },
    chatContent: {
        padding: 15,
        paddingBottom: 20,
    },
    messageBubble: {
        flexDirection: 'row',
        marginBottom: 15,
        maxWidth: '80%',
    },
    userBubble: {
        alignSelf: 'flex-end',
        justifyContent: 'flex-end',
    },
    aiBubble: {
        alignSelf: 'flex-start',
    },
    botAvatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#E1BEE7',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    messageContent: {
        padding: 12,
        borderRadius: 16,
    },
    userContent: {
        backgroundColor: '#9C27B0', // User bubble color (Purple)
        borderBottomRightRadius: 4,
    },
    aiContent: {
        backgroundColor: '#FFF', // AI bubble color
        borderTopLeftRadius: 4,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    messageText: {
        fontSize: 15,
        lineHeight: 22,
    },
    userText: {
        color: '#FFF',
    },
    aiText: {
        color: '#333',
    },
    typingContainer: {
        paddingHorizontal: 20,
        paddingBottom: 10,
    },
    typingText: {
        fontSize: 12,
        color: '#666',
        fontStyle: 'italic',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        backgroundColor: '#FFF',
        borderTopWidth: 1,
        borderTopColor: '#EEE',
    },
    attachBtn: {
        padding: 10,
    },
    input: {
        flex: 1,
        backgroundColor: '#F5F5F5',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 10,
        marginHorizontal: 10,
        maxHeight: 100,
    },
    sendBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#9C27B0',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
