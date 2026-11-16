const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const wrapAsync = require("../utility/wrapAsync");
const chatbotController = require("../controllers/chatbot");

// Rate limiting for chatbot queries
const chatbotLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 60, // limit each IP to 60 chat questions per 15 minutes
    message: {
        success: false,
        reply: "You have sent several messages recently. Please wait a few moments before sending more.",
        suggestions: ["How do I book a stay?", "What is the cancellation policy?"]
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test"
});

// Chatbot Query Endpoint
router.post("/chat", chatbotLimiter, wrapAsync(chatbotController.chat));

module.exports = router;
