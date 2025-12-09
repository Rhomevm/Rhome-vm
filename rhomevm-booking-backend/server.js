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

    // 🔹 Pick a rate plan from the quote (first one)
    const ratePlans = quote.rates && Array.isArray(quote.rates.ratePlans)
      ? quote.rates.ratePlans
      : [];

    if (!ratePlans.length) {
      return res.status(500).json({
        success: false,
        error: "No rate plans returned in quote.",
        quote
      });
    }

    const ratePlanId = ratePlans[0]._id || ratePlans[0].id;

    // 🔹 Reservation payload for inquiry / instant
    const reservationBody = {
      ratePlanId,
      guest: {
        firstName: guest.firstName,
        lastName: guest.lastName,
        email: guest.email,
        phone: guest.phone || ""
      },
      policy: {
        accept: true
      }
      // ccToken can be added later if you do instant bookings with payments
    };

    // 2) Convert quote → reservation (inquiry or instant)
    let reservationUrl =
      mode === "instant"
        ? `https://booking.guesty.com/api/reservations/quotes/${quoteId}/instant`
        : `https://booking.guesty.com/api/reservations/quotes/${quoteId}/inquiry`;

    const reservationResponse = await axios.post(
      reservationUrl,
      reservationBody,
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
