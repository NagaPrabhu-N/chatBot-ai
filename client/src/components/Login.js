import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:5000/login', { email, password });
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
