import express from 'express';
import puppeteer from 'puppeteer';
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
  // Remove old requests outside the window
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
    status: 'Instagram Scraper API is running',
    endpoints: ['/scrape', '/health'],
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Main scraping endpoint
app.post('/scrape', async (req, res) => {
  const { username, limit = 50 } = req.body;
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  console.log(`🚀 Starting scrape for @${username}, limit: ${limit}`);
  
  let browser;
  try {
    // Launch browser with Puppeteer (better for serverless)
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection'
      ]
    });

    const page = await browser.newPage();

    // Set user agent and viewport
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to Instagram profile
    console.log(`📱 Navigating to instagram.com/${username}`);
    await page.goto(`https://www.instagram.com/${username}/`, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    // Wait a bit for page to load
    await page.waitForTimeout(3000);

    // Check if profile exists
    const errorElement = await page.$('h2');
    if (errorElement) {
      const errorText = await page.evaluate(el => el.textContent, errorElement);
      if (errorText && errorText.includes("Sorry, this page isn't available")) {
        await browser.close();
        return res.status(404).json({ error: 'Instagram profile not found' });
      }
    }

    // Get profile info
    console.log(`👤 Extracting profile info for @${username}`);
    const profileInfo = await page.evaluate(() => {
      const getTextContent = (selector) => {
        const element = document.querySelector(selector);
        return element ? element.textContent.trim() : '';
      };

      // Try multiple selectors for follower count
      const followerSelectors = [
        'a[href*="/followers/"] span',
        'a[href$="/followers/"] span',
        'span:has-text("followers")',
        'meta[property="og:description"]'
      ];

      let followers = '';
      for (const selector of followerSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent) {
          followers = element.textContent.trim();
          break;
        }
      }

      return {
        username: window.location.pathname.replace(/\//g, ''),
        followers: followers,
        bio: getTextContent('div[data-testid="user-bio"] span') || getTextContent('.-vDIg span'),
        fullName: getTextContent('h1') || getTextContent('h2')
      };
    });

    // Scroll and collect posts
    console.log(`📸 Collecting posts (limit: ${limit})`);
    let posts = [];
    let scrollAttempts = 0;
    const maxScrolls = Math.ceil(limit / 12); // Instagram shows ~12 posts per scroll

    while (posts.length < limit && scrollAttempts < maxScrolls) {
      // Get current posts
      const currentPosts = await page.evaluate(() => {
        const postElements = document.querySelectorAll('article a[href*="/p/"]');
        return Array.from(postElements).map(link => {
          const img = link.querySelector('img');
          const href = link.getAttribute('href');

          return {
            url: href ? `https://www.instagram.com${href}` : '',
            imageUrl: img ? img.src : '',
            alt: img ? img.alt : '',
            timestamp: new Date().toISOString() // We'll get real timestamp later if needed
          };
        });
      });

      // Add new posts
      for (const post of currentPosts) {
        if (!posts.find(p => p.url === post.url) && posts.length < limit) {
          posts.push(post);
        }
      }

      console.log(`📊 Found ${posts.length} posts so far`);

      // Scroll down to load more
      if (posts.length < limit) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(2000); // Wait for new posts to load
        scrollAttempts++;
      }
    }

    await browser.close();

    const result = {
      success: true,
      profile: profileInfo,
      posts: posts.slice(0, limit),
      metadata: {
        scrapedAt: new Date().toISOString(),
        totalPosts: posts.length,
        requestedLimit: limit,
        source: 'playwright-scraper'
      }
    };

    console.log(`✅ Scrape complete: ${posts.length} posts for @${username}`);
    res.json(result);

  } catch (error) {
    console.error(`❌ Scrape failed for @${username}:`, error);
    
    if (browser) {
      await browser.close();
    }
    
    res.status(500).json({ 
      error: 'Failed to scrape Instagram profile',
      message: error.message,
      username: username
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Instagram Scraper API running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 Scrape endpoint: POST http://localhost:${PORT}/scrape`);
});
