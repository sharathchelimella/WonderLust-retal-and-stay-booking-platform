/**
 * WonderLust AI Customer Support Chatbot Client
 * Handles toggle, message stream, markdown rendering, typing animation, and API communication.
 */

document.addEventListener("DOMContentLoaded", () => {
    const toggleBtn = document.getElementById("wonderlustChatToggleBtn");
    const container = document.getElementById("wonderlustChatContainer");
    const minimizeBtn = document.getElementById("chatbotMinimizeBtn");
    const closeBtn = document.getElementById("chatbotCloseBtn");
    const chatForm = document.getElementById("chatbotForm");
    const input = document.getElementById("chatbotInput");
    const sendBtn = document.getElementById("chatbotSendBtn");
    const messagesContainer = document.getElementById("chatbotMessages");
    const typingIndicator = document.getElementById("chatbotTypingIndicator");
    const unreadBadge = document.getElementById("chatUnreadBadge");
    const csrfInput = document.getElementById("chatbotCsrf");

    if (!toggleBtn || !container) return;

    let isOpen = false;
    let isWaitingResponse = false;

    // Helper: Format current time (e.g. "11:42 PM")
    function getCurrentTime() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Helper: Scroll messages to bottom smoothly
    function scrollToBottom() {
        if (!messagesContainer) return;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Helper: Simple Markdown to HTML parser for safe chat formatting
    function formatMarkdown(text) {
        if (!text) return "";
        let formatted = text
            // Escape HTML entities to prevent XSS
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Headers: ### Header
        formatted = formatted.replace(/^### (.*$)/gim, "<h5>$1</h5>");
        formatted = formatted.replace(/^## (.*$)/gim, "<h4>$1</h4>");
        
        // Bold: **text**
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        
        // Links: [label](url)
        formatted = formatted.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        
        // Bullet points: - item
        formatted = formatted.replace(/^\s*[-*]\s+(.*$)/gim, "<li>$1</li>");
        formatted = formatted.replace(/(<li>.*<\/li>)/gims, "<ul>$1</ul>");

        // Paragraph line breaks
        formatted = formatted.replace(/\n\n/g, "</p><p>");
        formatted = formatted.replace(/\n/g, "<br>");

        return `<p>${formatted}</p>`;
    }

    // Toggle Chat Window
    function openChat() {
        isOpen = true;
        container.classList.add("open");
        container.setAttribute("aria-hidden", "false");
        toggleBtn.classList.add("active");
        if (unreadBadge) unreadBadge.style.display = "none";
        scrollToBottom();
        setTimeout(() => input?.focus(), 250);
    }

    function closeChat() {
        isOpen = false;
        container.classList.remove("open");
        container.setAttribute("aria-hidden", "true");
        toggleBtn.classList.remove("active");
    }

    toggleBtn.addEventListener("click", () => {
        if (isOpen) {
            closeChat();
        } else {
            openChat();
        }
    });

    if (minimizeBtn) minimizeBtn.addEventListener("click", closeChat);
    if (closeBtn) closeBtn.addEventListener("click", closeChat);

    // Append User Message
    function appendUserMessage(text) {
        const msgDiv = document.createElement("div");
        msgDiv.className = "chat-message user-message";
        msgDiv.innerHTML = `
            <div class="message-bubble">
                <p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
                <div class="message-time">${getCurrentTime()}</div>
            </div>
            <div class="message-avatar">
                <i class="fa-solid fa-user"></i>
            </div>
        `;
        // Insert before typing indicator
        if (typingIndicator) {
            messagesContainer.insertBefore(msgDiv, typingIndicator);
        } else {
            messagesContainer.appendChild(msgDiv);
        }
        scrollToBottom();
    }

    // Append Bot Message
    function appendBotMessage(htmlReply, suggestions = []) {
        const msgDiv = document.createElement("div");
        msgDiv.className = "chat-message bot-message";
        
        let suggestionsHtml = "";
        if (suggestions && suggestions.length > 0) {
            const chips = suggestions.map(s => 
                `<span class="suggestion-chip" data-query="${s}">${s}</span>`
            ).join("");
            suggestionsHtml = `<div class="chat-suggestions mt-2">${chips}</div>`;
        }

        msgDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fa-solid fa-robot"></i>
            </div>
            <div class="message-bubble">
                ${htmlReply}
                ${suggestionsHtml}
                <div class="message-time">${getCurrentTime()}</div>
            </div>
        `;

        if (typingIndicator) {
            messagesContainer.insertBefore(msgDiv, typingIndicator);
        } else {
            messagesContainer.appendChild(msgDiv);
        }

        // Attach event listeners to new suggestion chips
        msgDiv.querySelectorAll(".suggestion-chip").forEach(chip => {
            chip.addEventListener("click", () => {
                const query = chip.dataset.query;
                if (query) sendMessage(query);
            });
        });

        scrollToBottom();
    }

    // Send Message Logic
    async function sendMessage(text) {
        if (!text || !text.trim() || isWaitingResponse) return;
        const userText = text.trim();

        // 1. Clear input & show user bubble
        if (input) input.value = "";
        appendUserMessage(userText);

        // 2. Show typing indicator
        isWaitingResponse = true;
        if (typingIndicator) typingIndicator.style.display = "flex";
        if (sendBtn) sendBtn.disabled = true;
        scrollToBottom();

        const csrfToken = csrfInput ? csrfInput.value : "";

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "X-CSRF-Token": csrfToken
                },
                body: JSON.stringify({
                    message: userText,
                    _csrf: csrfToken
                })
            });

            const data = await response.json();

            // 3. Hide typing indicator
            if (typingIndicator) typingIndicator.style.display = "none";
            isWaitingResponse = false;
            if (sendBtn) sendBtn.disabled = false;

            if (response.ok && data.reply) {
                const formattedHtml = formatMarkdown(data.reply);
                appendBotMessage(formattedHtml, data.suggestions || []);
            } else {
                appendBotMessage(`<p>${data.reply || "I apologize, but I could not process that request. Please try again or reach out to support@wanderlust.com."}</p>`);
            }
        } catch (err) {
            console.error("Chatbot fetch error:", err);
            if (typingIndicator) typingIndicator.style.display = "none";
            isWaitingResponse = false;
            if (sendBtn) sendBtn.disabled = false;
            appendBotMessage("<p>I'm experiencing a brief connection glitch. Please check your network or try again in a moment.</p>");
        }

        setTimeout(() => input?.focus(), 150);
    }

    // Handle Form Submit
    if (chatForm) {
        chatForm.addEventListener("submit", (e) => {
            e.preventDefault();
            if (input) {
                sendMessage(input.value);
            }
        });
    }

    // Handle initial suggestion chips
    document.querySelectorAll(".chat-suggestions .suggestion-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            const query = chip.dataset.query;
            if (query) sendMessage(query);
        });
    });
});
