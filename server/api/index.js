require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const User = require('../models/User');
const Chat = require('../models/Chat');

const app = express();

// --- 1. DYNAMIC CORS CONFIGURATION ---
const allowedOrigins = [
  "http://localhost:3000",
  "https://chat-bot-ai-sable.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    // Allow any Vercel subdomain
    if (origin.endsWith(".vercel.app") || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true
}));

// Handle preflight requests for ALL routes
app.options('*', cors());

app.use(express.json());

// --- 2. HEALTH CHECK ROUTE (Test if server is alive) ---
app.get('/', (req, res) => {
  res.send("Server is running successfully!");
});

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
    console.error(error);
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
    console.error(error);
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

    let userChat = await Chat.findOne({ userId });
    if (!userChat) {
      userChat = new Chat({ userId, history: [] });
    }

    const historyForGemini = userChat.history.map(entry => ({
      role: entry.role,
      parts: [{ text: entry.parts[0].text }]
    }));

    // Fixed Model Name: 1.5-flash
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const chat = model.startChat({
      history: historyForGemini,
    });

    let msgToSend = message;
    if (userChat.history.length === 0) {
      msgToSend = `My name is ${username}. ${message}`;
    }

    const result = await chat.sendMessage(msgToSend);
    const response = await result.response;
    const text = response.text();

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
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
