const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Hostaway sandbox credentials
const HOSTAWAY_ACCOUNT_ID = "61148";
const HOSTAWAY_API_KEY = "f94377ebbbb479490bb3ec364649168dc443dda2e4830facaf5de2e74ccc9152";

// Status route for root path
app.get('/', (req, res) => {
  res.send('Flex Living Backend API is running. Use /api/reviews/hostaway to get reviews.');
});

// Helper: normalize reviews to match frontend expectation
function normalizeReviews(data) {
  return data.map((review) => ({
    id: review.id,
    type: review.type,
    channel: review.channel || "Unknown",
    status: review.status,
    rating: review.rating,
    guestName: review.guestName || "Anonymous",
    listingName: review.listingName || "Unknown Listing",
    submittedAt: review.submittedAt,
    reviewText: review.publicReview || review.reviewText || "",
    categories: review.reviewCategory || review.categories || []
  }));
}

// GET reviews route
app.get('/api/reviews/hostaway', async (req, res) => {
  const mockPath = path.join(__dirname, '../reviews.json');

  try {
    // 1) Try Hostaway sandbox API
    const resp = await axios.get('https://api.hostaway.com/v1/reviews', {
      headers: {
        "Authorization": `Bearer ${HOSTAWAY_API_KEY}`,
        "X-Hostaway-Account-Id": HOSTAWAY_ACCOUNT_ID
      },
      timeout: 5000
    });

let reviews = resp.data?.result || [];
if (!reviews || reviews.length === 0) {
  console.warn("Using mock data because API returned empty or failed");
  const mock = JSON.parse(fs.readFileSync(mockPath, 'utf8'));
  reviews = mock.result || mock;
}
    return res.json(normalizeReviews(reviews));

  } catch (err) {
    console.error("Error fetching from Hostaway:", err.message);

    // 2) Fallback to mock JSON
    try {
      const mock = JSON.parse(fs.readFileSync(mockPath, 'utf8'));
      return res.json(normalizeReviews(mock.result || mock));
    } catch (mockErr) {
      console.error("Error reading mock data:", mockErr.message);
      return res.status(500).json({ error: 'Failed to read reviews' });
    }
  }
});

// PATCH: Toggle status
app.patch('/api/reviews/hostaway/:id', (req, res) => {
  const reviewId = parseInt(req.params.id, 10);
  const { status } = req.body;
  const filePath = path.join(__dirname, '../mock/reviews.json');

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading mock data:', err);
      return res.status(500).json({ error: 'Failed to read data' });
    }

    try {
      const jsonData = JSON.parse(data);
      const reviewIndex = jsonData.result.findIndex((r) => r.id === reviewId);

      if (reviewIndex === -1) {
        return res.status(404).json({ error: 'Review not found' });
      }

      jsonData.result[reviewIndex].status = status;

      fs.writeFile(filePath, JSON.stringify(jsonData, null, 2), (writeErr) => {
        if (writeErr) {
          console.error('Error writing mock data:', writeErr);
          return res.status(500).json({ error: 'Failed to write data' });
        }

        res.json({ message: 'Review status updated successfully' });
      });
    } catch (parseErr) {
      console.error('Error parsing JSON:', parseErr);
      res.status(500).json({ error: 'Invalid JSON format' });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
});
