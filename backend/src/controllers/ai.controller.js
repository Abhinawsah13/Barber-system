import BarberProfile from '../models/BarberProfile.js';
import Service from '../models/Service.js';

// Simple "Gemini-like" simulation if no API key is provided
// or basic logic to return suggestions
export const getAiSuggestions = async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }

        const query = message.toLowerCase();

        // Basic keyword matching for suggestions
        let suggestions = "I can help you find the best grooming services! ";

        if (query.includes('haircut') || query.includes('cut')) {
            const services = await Service.find({ name: /haircut/i }).limit(2);
            if (services.length > 0) {
                suggestions += `I found some haircut services: ${services.map(s => s.name).join(', ')}. `;
            }
        }

        if (query.includes('fade') || query.includes('style')) {
            const barbers = await BarberProfile.find({ specialization: /Fade/i })
                .populate('user', 'username')
                .limit(2);
            if (barbers.length > 0) {
                suggestions += `Top rated barbers for Fades: ${barbers.map(b => b.user.username).join(', ')}. `;
            }
        }

        if (query.includes('price') || query.includes('cheap') || query.includes('cost')) {
            const cheapServices = await Service.find().sort({ price: 1 }).limit(2);
            suggestions += `Budget-friendly options start at $${cheapServices[0]?.price || 0}. `;
        }

        if (suggestions === "I can help you find the best grooming services! ") {
            suggestions += "Are you looking for a haircut, beard trim, or a specific barber style? I can recommend top-rated salons nearby.";
        }

        res.json({
            success: true,
            reply: suggestions
        });

    } catch (error) {
        console.error('AI Error:', error);
        res.status(500).json({ success: false, message: 'Assistant is currently resting. Try again later.' });
    }
};
