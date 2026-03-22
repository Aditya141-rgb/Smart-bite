const express = require("express");
const axios = require("axios");
const router = express.Router();

router.post("/", async (req, res) => {
  const userMessage = req.body.message;

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama3-8b-8192",
        messages: [
          {
            role: "system",
            content:
              "You are SmartBit Restaurant AI assistant. Help users with menu, orders, offers, healthy food info."
          },
          { role: "user", content: userMessage }
        ]
      },
      {
        headers: {
         Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"

        }
      }
    );

    res.json({
      reply: response.data.choices[0].message.content
    });

  } catch (error) {
    console.error("Chatbot error:", error.message);
    res.json({ reply: "Sorry, I am busy right now 😕" });
  }
});

module.exports = router;
function speak(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-IN";
  speechSynthesis.speak(utterance);
}
addChatMessage(botReply, "bot");
speak(botReply);

