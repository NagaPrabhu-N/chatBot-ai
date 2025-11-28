import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const navigate = useNavigate();
  const bottomRef = useRef(null); 
  const username = localStorage.getItem('username');
  const token = localStorage.getItem('token');

    // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!token) navigate('/login');
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await axios.get('http://localhost:5000/chat/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Transform DB format to UI friendly format
      const formattedHistory = res.data.map(msg => ({
        sender: msg.role === 'user' ? 'You' : 'chatBot',
        text: msg.parts[0].text
      }));
      setMessages(formattedHistory);
    } catch (err) {
      console.error('Failed to load history');
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { sender: 'You', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      const res = await axios.post('http://localhost:5000/chat', 
        { message: userMessage.text }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const botMessage = { sender: 'ChatBot', text: res.data.text };
      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      console.error('Error sending message');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    navigate('/login');
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h3>Chatting With {username}</h3>
        <button 
          onClick={handleLogout} 
          style={{background: 'transparent', border: '1px solid #ff4b4b', color: '#ff4b4b', padding: '5px 15px', borderRadius: '5px', cursor: 'pointer'}}
        >
          Logout
        </button>
      </div>
      
      <div className="chat-box">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.sender === 'You' ? 'user' : 'bot'}`}>
            <span className="sender-name">{msg.sender}</span>
            {msg.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="input-area">
        <input 
          className="chat-input"
          value={input} 
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message..."
          onKeyPress={e => e.key === 'Enter' && sendMessage()}
        />
        <button className="send-btn" onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
