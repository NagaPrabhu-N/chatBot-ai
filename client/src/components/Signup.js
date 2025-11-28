import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

export default function Signup() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/signup', { username, email, password });
      alert('Signup successful! Please login.');
      navigate('/login');
    } catch (err) {
      alert('Error signing up');
    }
  };

  return (
    <div className="auth-container">
      <h2>Create Account</h2>
      <form onSubmit={handleSignup}>
        <input 
          className="auth-input"
          placeholder="Username" 
          onChange={e => setUsername(e.target.value)} 
          required 
        />
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
        <button className="auth-btn" type="submit">Signup</button>
      </form>
      <p style={{ marginTop: '1rem' }}>
        Have an account? <Link to="/login" style={{ color: '#007bff', textDecoration: 'none' }}>Login</Link>
      </p>
    </div>
  );
}
