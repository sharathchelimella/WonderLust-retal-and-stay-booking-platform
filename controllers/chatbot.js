/**
 * Chatbot Controller
 * Handles incoming chat messages from the floating AI assistant
 */

const chatbotEngine = require("../utility/chatbotEngine");
const logger = require("../config/logger");

module.exports.chat = async (req, res) => {
    try {
        const { message = "", history = [] } = req.body;

        if (!message || typeof message !== "string" || !message.trim()) {
            return res.status(400).json({
                success: false,
                reply: "Please enter a message.",
                suggestions: ["How do I book a stay?", "What is the cancellation policy?", "How does AI Trip Planner work?"]
            });
        }

        const result = await chatbotEngine.processChatMessage({
            message: message.trim(),
            user: req.user || null,
            conversationHistory: Array.isArray(history) ? history : []
        });

        return res.json({
            success: true,
            reply: result.reply,
            suggestions: result.suggestions || [],
            links: result.links || []
        });
    } catch (err) {
        logger.error(`Chatbot error: ${err.message}\n${err.stack}`);
        return res.status(500).json({
            success: false,
            reply: "I'm having a momentary connection glitch. Please feel free to ask your question again, or email us at support@wanderlust.com.",
            suggestions: ["How do I book a stay?", "What is the cancellation policy?"]
        });
    }
};
