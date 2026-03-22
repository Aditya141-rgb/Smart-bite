// speech.js
const SpeechRecognition = require('speech-recognition');
const axios = require('axios');
const { exec } = require('child_process');

// ========== SPEECH RECOGNITION ==========
function listen() {
    return new Promise((resolve, reject) => {
        const recognition = new SpeechRecognition();
        
        console.log("🎤 Listening...");
        
        recognition.onresult = (event) => {
            const text = event.results[0][0].transcript;
            console.log("You:", text);
            resolve(text);
        };
        
        recognition.onerror = (event) => {
            resolve("Sorry, I didn't understand");
        };
        
        recognition.start();
    });
}

// ========== CHATBOT API ==========
const API_KEY = process.env.GROQ_API_KEY;
const CHATBOT_URL = "https://api.yourchatbot.com/chat";

async function askChatbot(userText) {
    const headers = {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
    };

    const data = {
        "message": userText
    };

    try {
        const response = await axios.post(CHATBOT_URL, data, { headers });
        return response.data.reply;
    } catch (error) {
        return "Error connecting to chatbot";
    }
}

// ========== TEXT TO SPEECH ==========
function speak(text) {
    return new Promise((resolve) => {
        // For Windows
        const command = `PowerShell -Command "Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('${text}')"`;
        
        // For macOS
        // const command = `say "${text}"`;
        
        // For Linux
        // const command = `espeak "${text}"`;
        
        exec(command, (error) => {
            if (error) {
                console.log("Text to speech error:", error);
            }
            resolve();
        });
    });
}

// ========== MAIN LOOP ==========
async function main() {
    while (true) {
        const userVoice = await listen();
        
        if (userVoice.toLowerCase() === "exit") {
            break;
        }
        
        const reply = await askChatbot(userVoice);
        console.log("Bot:", reply);
        await speak(reply);
    }
}

// Run the program
main();