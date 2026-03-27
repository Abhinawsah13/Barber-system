import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import BarberProfile from '../models/BarberProfile.js';
import Service from '../models/Service.js';
import User from '../models/User.js';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'AIzaSyC7_kKCcq3XiqKib3Td8snq6SwTUehsooU');

// TOOL DEFINITIONS
const tools = [
    {
        functionDeclarations: [
            {
                name: 'search_barbers_services',
                description: 'Searches for barbers or services based on style or max price.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        style: { type: 'STRING', description: 'Hairstyle or service name.' },
                        maxPrice: { type: 'NUMBER', description: 'Max price.' }
                    }
                }
            },
            {
                name: 'update_user_profile',
                description: 'Updates current user account data.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        username: { type: 'STRING' },
                        phone: { type: 'STRING' },
                        address: { type: 'STRING' }
                    }
                }
            },
            {
                name: 'create_barber_service',
                description: 'Barber creates a new service/product.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        name: { type: 'STRING' },
                        price: { type: 'NUMBER' },
                        description: { type: 'STRING' }
                    },
                    required: ['name', 'price', 'description']
                }
            }
        ]
    }
];

const toolFunctions = {
    search_barbers_services: async ({ style, maxPrice }) => {
        let query = {};
        if (style) query.name = new RegExp(style, 'i');
        if (maxPrice) query.price = { $lte: maxPrice };
        const services = await Service.find(query).populate({
            path: 'barberProfile',
            populate: { path: 'user', select: 'username averageRating address' }
        }).limit(3);
        if (services.length === 0) return { message: 'No services found.' };
        return services.map(s => ({
            service: s.name, price: s.price, barber: s.barberProfile?.user?.username, rating: s.barberProfile?.averageRating
        }));
    },
    update_user_profile: async ({ username, phone, address }, userId) => {
        const up = {}; if (username) up.username = username; if (phone) up.phone = phone; if (address) up.address = address;
        await User.findByIdAndUpdate(userId, up);
        return { success: true, message: 'Profile updated.' };
    },
    create_barber_service: async ({ name, price, description }, userId, userType) => {
        if (userType !== 'barber') return { error: 'Not a barber.' };
        const bp = await BarberProfile.findOne({ user: userId });
        if (!bp) return { error: 'No profile.' };
        await Service.create({ barberProfile: bp._id, name, price, description, serviceType: 'both' });
        return { success: true, message: `Created service: ${name}` };
    }
};


// ─── Helpers ──────────────────────────────────────────────────────────────────

// Extracts "retry after N seconds" from the Gemini API error message
const parseRetryDelay = (errorMessage = '') => {
    const match = errorMessage.match(/Please retry in ([\d.]+)s/i);
    if (match) return Math.ceil(parseFloat(match[1])) * 1000; // ms
    return null;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Core fetch to Gemini API — returns raw data object
const callGeminiAPI = async (url, body) => {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return response.json();
};

// ─── Main export ──────────────────────────────────────────────────────────────

export const handleAiVoiceChat = async (userId, userType, message, audioData, conversationHistory = []) => {
    const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyC7_kKCcq3XiqKib3Td8snq6SwTUehsooU';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const contents = [
        {
            role: 'user',
            parts: [{ text: `System Instruction: You are the Book-A-Cut Assistant. Talk to a ${userType}. UserID: ${userId}. Use tools to find barbers or update profile if needed. Keep replies brief and helpful.` }]
        },
        {
            role: 'model',
            parts: [{ text: 'Understood. I will help the user with Book-A-Cut services.' }]
        },
        ...conversationHistory.filter(h => h.text).map(h => ({
            role: h.role === 'ai' || h.role === 'model' ? 'model' : 'user',
            parts: [{ text: h.text }]
        }))
    ];

    const userParts = [];
    if (message) userParts.push({ text: message });
    if (audioData) {
        userParts.push({ inlineData: { data: audioData, mimeType: 'audio/m4a' } });
    }
    contents.push({ role: 'user', parts: userParts });

    const body = {
        contents,
        tools,
        tool_config: { function_calling_config: { mode: 'AUTO' } },
    };

    // ─── Retry loop (max 2 attempts) ─────────────────────────────────────────
    const MAX_ATTEMPTS = 2;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            console.log(`[AI Service] Attempt ${attempt}/${MAX_ATTEMPTS}...`);
            const data = await callGeminiAPI(url, body);

            // ── Handle API-level errors ──────────────────────────────────────
            if (data.error) {
                const errMsg = data.error.message || '';
                const errCode = data.error.code || 0;
                console.error(`[AI Service] API Error (attempt ${attempt}):`, errMsg);

                // Rate limit (429) — try to respect the suggested retry delay
                if (errCode === 429 || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('rate')) {
                    const retryDelayMs = parseRetryDelay(errMsg);

                    if (attempt < MAX_ATTEMPTS && retryDelayMs && retryDelayMs <= 30000) {
                        console.log(`[AI Service] Rate limited. Retrying in ${retryDelayMs / 1000}s...`);
                        await sleep(retryDelayMs);
                        continue; // retry
                    }

                    // Quota exhausted or retry delay too long — friendly message
                    return {
                        reply: "I'm a bit busy right now 🙏 The AI assistant has hit its usage limit. Please try again in a minute.",
                        isRateLimit: true,
                    };
                }

                // Model not found or other non-retryable error
                lastError = errMsg;
                return { reply: "Sorry, I'm having trouble connecting to the AI right now. Please try again shortly." };
            }

            // ── Process successful response ──────────────────────────────────
            const candidate = data.candidates?.[0];
            const parts = candidate?.content?.parts || [];

            // Check for function calls
            for (const part of parts) {
                if (part.functionCall) {
                    const call = part.functionCall;
                    console.log('[AI Service] Executing tool:', call.name, call.args);
                    try {
                        const func = toolFunctions[call.name];
                        const result = await func(call.args, userId, userType);
                        return {
                            reply: `Done! I've completed: ${call.name.replace(/_/g, ' ')}.`,
                            toolUsed: call.name,
                            toolResult: result,
                        };
                    } catch (ferr) {
                        console.error('[AI Service] Tool error:', ferr);
                        return { reply: "I tried to help but ran into an error processing that request." };
                    }
                }
            }

            const reply = parts[0]?.text || "I'm sorry, I couldn't process that.";
            return { reply };

        } catch (e) {
            lastError = e.message;
            console.error(`[AI Service] Network/parse error (attempt ${attempt}):`, e.message);
            if (attempt < MAX_ATTEMPTS) {
                await sleep(2000); // brief wait before network retry
            }
        }
    }

    // All attempts failed
    console.error('[AI Service] All attempts failed. Last error:', lastError);
    return { reply: "Connection failed. Please check your internet connection and try again." };
};

