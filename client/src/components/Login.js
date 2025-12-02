import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import API_URL from '../apiConfig';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/login`, { email, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('username', res.data.username);
      // Reload/Redirect to chat to update auth state in App
      window.location.href = "/chat"; 
    } catch (err) {
      alert('Invalid credentials');
    }
  };

  return (
    <div className="auth-container">
      <h2>Welcome Back</h2>
      <form onSubmit={handleLogin}>
        <input 
          className="auth-input"
          placeholder="Email" 
          onChange={e => setEmail(e.target.value)} 
          required 
        />
        <input 
          className="auth-input"
          type="password" 
          placeholder="Password" 
          onChange={e => setPassword(e.target.value)} 
          required 
        />
        <button className="auth-btn" type="submit">Login</button>
      </form>
      <p style={{marginTop: '1rem'}}>
        No account? <Link to="/signup" style={{color: '#007bff'}}>Signup</Link>
      </p>
    </div>
  );
}
