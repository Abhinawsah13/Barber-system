import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

async function testGemini() {
    try {
        console.log('Testing key:', API_KEY.substring(0, 10) + '...');
        const genAI = new GoogleGenerativeAI(API_KEY);
        
        const models = ['gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-pro'];
        
        for (const m of models) {
            try {
                console.log(`Checking ${m}...`);
                const model = genAI.getGenerativeModel({ model: m });
                const result = await model.generateContent("Hi");
                console.log(`SUCCESS with ${m}:`, result.response.text());
                return;
            } catch (err) {
                console.log(`FAILED ${m}:`, err.message.substring(0, 80));
            }
        }
    } catch (e) {
        console.error('CRITICAL:', e);
    }
}

testGemini();
