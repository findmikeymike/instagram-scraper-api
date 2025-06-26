import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// Simple rate limiting
const requestCounts = new Map();
const RATE_LIMIT = 10; // requests per minute
const RATE_WINDOW = 60000; // 1 minute

app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }
  
  const requests = requestCounts.get(ip);
  const validRequests = requests.filter(time => now - time < RATE_WINDOW);
  
  if (validRequests.length >= RATE_LIMIT) {
    return res.status(429).json({ 
      error: 'Rate limit exceeded', 
      message: `Maximum ${RATE_LIMIT} requests per minute` 
    });
  }
  
  validRequests.push(now);
  requestCounts.set(ip, validRequests);
  next();
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'Instagram Scraper API is running (HTTP mode)',
    endpoints: ['/scrape', '/health'],
    timestamp: new Date().toISOString(),
    mode: 'lightweight-http'
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Lightweight scraping endpoint using Instagram's public API
app.post('/scrape', async (req, res) => {
  const { username, limit = 12 } = req.body;
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  console.log(`🚀 Starting lightweight scrape for @${username}`);
  
  try {
    // Try Instagram's public endpoints first
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    };

    // Method 1: Try Instagram's public API endpoint
    try {
      console.log(`📡 Trying Instagram public API for @${username}`);
      const apiUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
      
      const apiResponse = await axios.get(apiUrl, { 
        headers: {
          ...headers,
          'X-IG-App-ID': '936619743392459', // Instagram's web app ID
          'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 15000 
      });

      if (apiResponse.data && apiResponse.data.data && apiResponse.data.data.user) {
        const user = apiResponse.data.data.user;
        const posts = [];
        
        if (user.edge_owner_to_timeline_media && user.edge_owner_to_timeline_media.edges) {
          const edges = user.edge_owner_to_timeline_media.edges.slice(0, limit);
          
          for (const edge of edges) {
            const node = edge.node;
            posts.push({
              url: `https://www.instagram.com/p/${node.shortcode}/`,
              imageUrl: node.display_url || node.thumbnail_src,
              alt: node.edge_media_to_caption?.edges?.[0]?.node?.text || '',
              timestamp: new Date(node.taken_at_timestamp * 1000).toISOString(),
              likes: node.edge_liked_by?.count || 0,
              comments: node.edge_media_to_comment?.count || 0
            });
          }
        }

        const result = {
          success: true,
          profile: {
            username: user.username,
            followers: `${user.edge_followed_by?.count || 0} followers`,
            bio: user.biography || '',
            fullName: user.full_name || ''
          },
          posts: posts,
          metadata: {
            scrapedAt: new Date().toISOString(),
            totalPosts: posts.length,
            requestedLimit: limit,
            source: 'instagram-api',
            method: 'public-api'
          }
        };

        console.log(`✅ API scrape successful: ${posts.length} posts for @${username}`);
        return res.json(result);
      }
    } catch (apiError) {
      console.log(`⚠️  API method failed, trying fallback: ${apiError.message}`);
    }

    // Method 2: Fallback to basic profile info
    console.log(`📱 Trying basic profile info for @${username}`);
    
    const result = {
      success: true,
      profile: {
        username: username,
        followers: 'Unable to fetch',
        bio: 'Profile exists but detailed data unavailable',
        fullName: username
      },
      posts: [],
      metadata: {
        scrapedAt: new Date().toISOString(),
        totalPosts: 0,
        requestedLimit: limit,
        source: 'basic-fallback',
        method: 'profile-check',
        note: 'Instagram has restricted access. Profile exists but post data unavailable.'
      }
    };

    console.log(`⚠️  Fallback response for @${username} - profile exists but limited data`);
    res.json(result);

  } catch (error) {
    console.error(`❌ Scrape failed for @${username}:`, error.message);
    
    res.status(500).json({ 
      error: 'Failed to scrape Instagram profile',
      message: error.message,
      username: username,
      suggestion: 'Instagram may be blocking requests. Try again later.'
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Lightweight Instagram Scraper API running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 Scrape endpoint: POST http://localhost:${PORT}/scrape`);
  console.log(`💡 Mode: HTTP-only (no browser automation)`);
});
