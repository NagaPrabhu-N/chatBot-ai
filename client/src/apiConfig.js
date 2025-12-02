// client/src/apiConfig.js

const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000'  // Use this when running locally
  : 'https://chat-bot-ai-w4c5.vercel.app'; // REPLACE with your actual Vercel Backend URL

export default API_URL;
