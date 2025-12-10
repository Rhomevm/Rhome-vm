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
app.post('/api/book', async (req, res) => {
  try {
    const {
      listingId,
      checkInDateLocalized,
      checkOutDateLocalized,
      guestsCount,
      guest
      // mode ignored for now – we just create a quote
    } = req.body;

    if (!listingId || !checkInDateLocalized || !checkOutDateLocalized || !guestsCount || !guest) {
      return res.status(400).json({ success: false, error: 'Missing required fields.' });
    }

    const token = await getGuestyAccessToken();

    console.log('Creating Guesty quote with:', {
      listingId,
      checkInDateLocalized,
      checkOutDateLocalized,
      guestsCount,
      guest
    });

    const quoteResponse = await axios.post(
      'https://booking.guesty.com/api/reservations/quotes',
      {
        listingId,
        checkInDateLocalized,
        checkOutDateLocalized,
        guestsCount,
        guest
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json; charset=utf-8',
          'Content-Type': 'application/json'
        }
      }
    );

    const quote = quoteResponse.data;

    console.log('Guesty quote created:', quote);

    return res.json({
      success: true,
      quote
    });
  } catch (err) {
    console.error('Error in /api/book:', err.response?.data || err.message);

    return res.status(500).json({
      success: false,
      error: 'Booking failed.',
      details: err.response?.data || err.message
    });
  }
});


app.listen(PORT, () => {
  console.log(`Booking backend listening on port ${PORT}`);
});
