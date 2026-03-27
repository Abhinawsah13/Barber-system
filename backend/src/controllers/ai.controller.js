import { handleAiVoiceChat } from '../services/gemini.service.js';

export const getAiSuggestions = async (req, res) => {
    try {
        const { message, audioData, history } = req.body;
        const userId = req.user?._id;
        const userType = req.user?.user_type;

        if (!message && !audioData) {
            return res.status(400).json({ success: false, message: 'Message or Voice Audio is required' });
        }

        const aiResponse = await handleAiVoiceChat(userId, userType, message, audioData, history || []);
        console.log('[AI Controller] Response:', aiResponse);

        return res.json({
            success: true,
            reply: aiResponse?.reply,
            toolUsed: aiResponse?.toolUsed,
            toolResult: aiResponse?.toolResult
        });

    } catch (error) {
        console.error('AI Error:', error);
        res.status(500).json({ success: false, message: 'Assistant is currently resting. Please try again later.' });
    }
};
