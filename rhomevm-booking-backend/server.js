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

app.use(cors());
app.use(express.json());

/**
 * Get Guesty Booking Engine Access Token
 */
async function getGuestyAccessToken() {
  const now = Date.now();

  if (tokenCache.accessToken && tokenCache.expiresAt > now) {
    return tokenCache.accessToken;
  }

  const url = "https://booking.guesty.com/oauth2/token";

  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("scope", "booking_engine:api");
  params.append("client_id", GUESTY_CLIENT_ID);
  params.append("client_secret", GUESTY_CLIENT_SECRET);

  const response = await axios.post(url, params, {
    headers: {
      "accept": "application/json",
      "cache-control": "no-cache,no-cache",
      "content-type": "application/x-www-form-urlencoded"
    }
  });

  const { access_token, expires_in } = response.data;

  tokenCache.accessToken = access_token;
  tokenCache.expiresAt = now + (expires_in - 60) * 1000;

  return access_token;
}

// Health check
app.get("/", (req, res) => {
  res.json({ success: true, service: "RhomeVM Booking Backend" });
});

/**
 * Main booking endpoint
 */
app.post("/api/book", async (req, res) => {
  try {
    const {
      listingId,
      checkInDateLocalized,
      checkOutDateLocalized,
      guestsCount,
      guest,
      mode
    } = req.body;

    if (!listingId || !checkInDateLocalized || !checkOutDateLocalized || !guestsCount || !guest) {
      return res.status(400).json({ success: false, error: "Missing required fields." });
    }

    const token = await getGuestyAccessToken();

    // 1) Create quote
    const quoteResponse = await axios.post(
      "https://booking.guesty.com/api/reservations/quotes",
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
          Accept: "application/json; charset=utf-8",
          "Content-Type": "application/json"
        }
      }
    );

    const quote = quoteResponse.data;
    const quoteId = quote.id || quote._id || quote.quoteId;

    if (!quoteId) {
      return res.status(500).json({
        success: false,
        error: "Could not determine quoteId.",
        quote
      });
    }

    // 2) Convert quote → reservation
    let reservationUrl =
      mode === "instant"
        ? `https://booking.guesty.com/api/reservations/quotes/${quoteId}/instant`
        : `https://booking.guesty.com/api/reservations/quotes/${quoteId}/inquiry`;

    const reservationResponse = await axios.post(
      reservationUrl,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json; charset=utf-8",
          "Content-Type": "application/json"
        }
      }
    );

    return res.json({
      success: true,
      quote,
      reservation: reservationResponse.data
    });

  } catch (err) {
    console.error("Error in /api/book:", err.response?.data || err.message);

    return res.status(500).json({
      success: false,
      error: "Booking failed.",
      details: err.response?.data || err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Booking backend listening on port ${PORT}`);
});
