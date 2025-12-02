require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const User = require('./models/User');
const Chat = require('./models/Chat');

// ... imports

const app = express();

// --- DYNAMIC CORS CONFIGURATION ---
const allowedOrigins = [
  "http://localhost:3000",
  "https://chat-bot-ai-w4c5.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (origin.endsWith(".vercel.app") || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE"], // Added common methods
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"], // Added X-Requested-With
  credentials: true
}));


// Handle preflight specifically
app.options('*', cors());

// ... rest of server.js


app.use(express.json());

// Connect DB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));


// --- AUTH ROUTES ---

// Signup
app.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: 'User created' });
  } catch (error) {
    res.status(500).json({ error: 'Error creating user' });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET);
    res.json({ token, username: user.username });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});


// --- CHAT ROUTES ---

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Get User Chat History
app.get('/chat/history', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    let chat = await Chat.findOne({ userId: decoded.id });
    if (!chat) {
      return res.json([]);
    }
    res.json(chat.history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Send Message to Gemini
app.post('/chat', async (req, res) => {
  const { message } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const username = decoded.username;

    // 1. Retrieve existing chat history
    let userChat = await Chat.findOne({ userId });
    if (!userChat) {
      userChat = new Chat({ userId, history: [] });
    }

    // 2. STRICT CLEANING: Convert Mongoose objects to plain JS objects
    const historyForGemini = userChat.history.map(entry => ({
      role: entry.role,
      parts: [{ text: entry.parts[0].text }]
    }));

    // 3. Start Chat Session
    // Fixed Model Name: "gemini-2.5-flash" does not exist yet. Use 1.5-flash.
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const chat = model.startChat({
      history: historyForGemini,
    });

    // 4. Send Message
    let msgToSend = message;
    if (userChat.history.length === 0) {
      msgToSend = `My name is ${username}. ${message}`;
    }

    const result = await chat.sendMessage(msgToSend);
    const response = await result.response;
    const text = response.text();

    // 5. Save new interaction to DB
    const newInteraction = [
      { role: 'user', parts: [{ text: message }] },
      { role: 'model', parts: [{ text: text }] }
    ];

    userChat.history.push(...newInteraction);
    await userChat.save();

    res.json({ text });

  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: 'Gemini API Error' });
  }
});

// --- VERCEL EXPORT ---
// For Vercel, we MUST export the app. 
// We ONLY listen if running locally (not in production)
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
