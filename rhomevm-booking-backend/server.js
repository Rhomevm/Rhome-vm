app.post('/api/book', async (req, res) => {
  try {
    const {
      listingId,
      checkInDateLocalized,
      checkOutDateLocalized,
      guestsCount,
      guest
      // mode ignored for now – we're just creating a quote
    } = req.body;

    if (!listingId || !checkInDateLocalized || !checkOutDateLocalized || !guestsCount || !guest) {
      return res.status(400).json({ success: false, error: 'Missing required fields.' });
    }

    const token = await getGuestyAccessToken();

    // Create quote in Guesty
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
