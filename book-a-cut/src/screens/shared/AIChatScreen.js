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
    SafeAreaView
} from 'react-native';
import { THEME } from '../../theme/theme';
import { getToken } from '../../services/TokenManager';

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
    const flatListRef = useRef();

    const handleSend = async () => {
        if (inputText.trim().length === 0) return;

        const newUserMsg = {
            id: Date.now().toString(),
            text: inputText,
            sender: 'user',
            timestamp: new Date().toISOString(),
        };

        setMessages(prev => [...prev, newUserMsg]);
        setInputText('');
        setIsTyping(true);

        // Call Backend AI
        try {
            const token = await getToken();
            const response = await fetch('http://192.168.1.79:3000/api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ message: inputText.trim() })
            });
            const data = await response.json();

            const newAiMsg = {
                id: Date.now().toString(),
                text: data.reply || "I'm sorry, I couldn't process that.",
                sender: 'ai',
                timestamp: new Date().toISOString(),
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
                    isUser ? styles.userContent : styles.aiContent
                ]}>
                    <Text style={[
                        styles.messageText,
                        isUser ? styles.userText : styles.aiText
                    ]}>{item.text}</Text>
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
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
            >
                <View style={styles.inputContainer}>
                    <TouchableOpacity style={styles.attachBtn}>
                        <Text style={{ fontSize: 20 }}>📷</Text>
                    </TouchableOpacity>
                    <TextInput
                        style={styles.input}
                        placeholder="Type a message..."
                        placeholderTextColor="#999"
                        value={inputText}
                        onChangeText={setInputText}
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
