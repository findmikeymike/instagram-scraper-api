# Instagram Scraper API

Playwright-based Instagram scraper that bypasses Cloudflare/bot detection by using a real browser.

## 🚀 Quick Deploy to Render

1. **Push to GitHub:**
   ```bash
   cd instagram-scraper-api
   git init
   git add .
   git commit -m "Initial Instagram scraper API"
   git remote add origin https://github.com/yourusername/instagram-scraper-api.git
   git push -u origin main
   ```

2. **Deploy on Render:**
   - Go to [render.com](https://render.com)
   - Click "New" → "Web Service"
   - Connect your GitHub repo
   - Settings:
     - **Runtime:** Node
     - **Build Command:** `npm install`
     - **Start Command:** `npm start`
     - **Plan:** Free

3. **Get your API URL:**
   - Render will give you a URL like: `https://instagram-scraper-api-xyz.onrender.com`

## 📡 API Endpoints

### POST /scrape
Scrape an Instagram profile for posts and profile info.

**Request:**
```json
{
  "username": "instagram_username",
  "limit": 50
}
```

**Response:**
```json
{
  "success": true,
  "profile": {
    "username": "instagram_username",
    "followers": "1.2M followers",
    "bio": "Profile bio text",
    "fullName": "Full Name"
  },
  "posts": [
    {
      "url": "https://www.instagram.com/p/ABC123/",
      "imageUrl": "https://instagram.com/image.jpg",
      "alt": "Post description",
      "timestamp": "2024-01-01T00:00:00.000Z"
    }
  ],
  "metadata": {
    "scrapedAt": "2024-01-01T00:00:00.000Z",
    "totalPosts": 50,
    "requestedLimit": 50,
    "source": "playwright-scraper"
  }
}
```

### GET /health
Health check endpoint.

## 🔧 Local Development

```bash
npm install
npm start
```

Test with:
```bash
curl -X POST http://localhost:3000/scrape \
  -H "Content-Type: application/json" \
  -d '{"username": "instagram", "limit": 10}'
```

## 🎯 Integration with Manny AI

Update your Netlify function to call this API:

```javascript
// In your /api/instagram/sync-bright-data endpoint
const response = await fetch('https://your-scraper-api.onrender.com/scrape', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    username: user.instagramUsername, 
    limit: 50 
  })
});

const data = await response.json();
// Process data.posts and store in your database
```

## ⚡ Why This Works

- **Real Browser:** Playwright runs actual Chromium, so Instagram can't detect it as a bot
- **Proper Headers:** Uses realistic user agent and browser fingerprint
- **No Rate Limits:** Each request is a fresh browser session
- **Reliable:** Works consistently unlike API-based scrapers that get blocked

## 🛡️ Notes

- This scrapes public Instagram profiles only
- Respects Instagram's public data (no private accounts)
- Use responsibly and consider Instagram's terms of service
- For production, consider adding rate limiting and caching
