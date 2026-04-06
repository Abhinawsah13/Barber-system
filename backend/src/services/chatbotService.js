// src/services/chatbotService.js
import axios from 'axios';

const ML_API_URL = process.env.ML_API_URL || 'http://localhost:5001';

export const getChatbotResponse = async (message) => {
  try {
    const response = await axios.post(
      `${ML_API_URL}/predict`,
      { message },
      { timeout: 8000 }
    );
    return response.data;
  } catch (error) {
    console.error('ML API error:', error.message);
    return {
      intent: 'error',
      confidence: 0,
      response: 'I am having a little trouble right now. Please try again in a moment.',
      entities: {},
    };
  }
};

export const checkMLHealth = async () => {
  try {
    const response = await axios.get(`${ML_API_URL}/health`, { timeout: 3000 });
    return response.data;
  } catch {
    return { status: 'offline' };
  }
};