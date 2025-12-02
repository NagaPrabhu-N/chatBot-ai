require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const User = require('./models/User');
const Chat = require('./models/Chat');

const app = express();
app.use(cors());
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
      // Return empty history if new user
      return res.json([]);
    }
    res.json(chat.history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Send Message to Gemini
// ... inside server.js

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
    // Gemini crashes if you send database fields like '_id'
    const historyForGemini = userChat.history.map(entry => ({
      role: entry.role,
      parts: [{ text: entry.parts[0].text }] // Ensure strict format
    }));

    // 3. Start Chat Session with CLEAN history
    // Use "gemini-1.5-flash" (it is faster and more reliable for free tier)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const chat = model.startChat({
      history: historyForGemini,
    });

    // 4. Send Message
    let msgToSend = message;
    // Add context only for the very first message
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
    console.error("Gemini Error:", error); // This will print the REAL error in your terminal
    res.status(500).json({ error: 'Gemini API Error' });
  }
});


app.listen(5000, () => console.log('Server running on port 5000'));

// module.exports = app;