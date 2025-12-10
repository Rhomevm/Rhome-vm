require('dotenv').config();

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

const GUESTY_CLIENT_ID = process.env.GUESTY_CLIENT_ID;
const GUESTY_CLIENT_SECRET = process.env.GUESTY_CLIENT_SECRET;

// Simple in-memory token cache
let tokenCache = {
  accessToken: null,
  expiresAt: 0
};

const corsOptions = {
  origin: '*', // can be restricted later
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

/**
 * Get Guesty Booking Engine access token
 */
async function getGuestyAccessToken() {
  const now = Date.now();

  if (tokenCache.accessToken && tokenCache.expiresAt > now) {
    return tokenCache.accessToken;
  }

  const url = 'https://booking.guesty.com/oauth2/token';

  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('scope', 'booking_engine:api');
  params.append('client_id', GUESTY_CLIENT_ID);
  params.append('client_secret', GUESTY_CLIENT_SECRET);

  const response = await axios.post(url, params, {
    headers: {
      accept: 'application/json',
      'cache-control': 'no-cache,no-cache',
      'content-type': 'application/x-www-form-urlencoded'
    }
  });

  const { access_token, expires_in } = response.data;

  tokenCache.accessToken = access_token;
  tokenCache.expiresAt = now + (expires_in - 60) * 1000;

  return access_token;
}

// Health check
app.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'RhomeVM Booking Backend',
    version: 'v2-echo-test'
  });
});

/**
 * TEMP: echo-only booking endpoint to verify deployment wiring.
 * Does NOT call Guesty yet.
 */
app.post('/api/book', (req, res) => {
  console.log('Hit /api/book with body:', req.body);

  return res.json({
    success: true,
    mode: 'echo-only-test',
    received: req.body
  });
});

app.listen(PORT, () => {
  console.log(`Booking backend listening on port ${PORT}`);
});
