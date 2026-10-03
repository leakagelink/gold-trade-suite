// Marketaux news fetcher for Crypto, Forex, Commodities
import { fetchJsonWithRotation } from "../_shared/apiKeyRotator.ts";

// ============= Google News RSS fallback =============
// The Marketaux free plan returns only old relevance-ranked articles, so when
// nothing is fresh we pull real, current headlines from Google News RSS
// (free, no API key, no quota).
const RSS_QUERIES: Record<string, string> = {
  crypto: 'cryptocurrency OR bitcoin OR ethereum when:7d',
  forex: 'forex OR "currency market" OR "exchange rate" when:7d',
  commodities: 'gold price OR crude oil OR commodities market when:7d',
  all: 'stock market OR cryptocurrency OR forex OR commodities when:7d',
};

function decodeXmlEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function extractTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? decodeXmlEntities(m[1]).trim() : '';
}

async function fetchGoogleNews(query: string, limit: number) {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.error(`[News] Google News RSS HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    return items.slice(0, Math.min(limit, 20)).map((item, i) => {
      const title = extractTag(item, 'title');
      const link = extractTag(item, 'link');
      const pubDate = extractTag(item, 'pubDate');
      const source = extractTag(item, 'source') || 'Google News';
      const description = extractTag(item, 'description');
      // Google News descriptions are HTML; strip tags for a clean snippet.
      const snippet = description.replace(/<[^>]*>/g, '').slice(0, 300);
      const t = pubDate ? new Date(pubDate).getTime() : NaN;
      return {
        uuid: `gn-${i}-${pubDate}`,
        title,
        description: snippet || title,
        snippet,
        url: link,
        source,
        published_at: !isNaN(t) ? new Date(t).toISOString() : new Date().toISOString(),
        entities: [],
      };
    }).filter((a) => a.title && a.url);
  } catch (err) {
    console.error('[News] Google News RSS error:', String(err));
    return [];
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

let cache: { data: any; timestamp: number; category: string } | null = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

const FALLBACK_NEWS = [
  {
    uuid: "fb-1",
    title: "Bitcoin Holds Strong Above Key Support Level",
    description: "BTC continues to show resilience as institutional demand grows.",
    snippet: "Bitcoin maintains its position above critical support amid global market uncertainty.",
    url: "https://www.coindesk.com",
    image_url: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800",
    source: "CoinDesk",
    published_at: new Date().toISOString(),
    entities: [{ symbol: "BTC", name: "Bitcoin", type: "crypto" }],
  },
  {
    uuid: "fb-2",
    title: "Gold Prices Surge as Dollar Weakens",
    description: "Spot gold rallies on safe-haven demand and Fed rate cut expectations.",
    snippet: "Precious metals gain ground as investors seek refuge from market volatility.",
    url: "https://www.reuters.com",
    image_url: "https://images.unsplash.com/photo-1610375461246-83df859d849d?w=800",
    source: "Reuters",
    published_at: new Date(Date.now() - 3600000).toISOString(),
    entities: [{ symbol: "XAU", name: "Gold", type: "commodity" }],
  },
  {
    uuid: "fb-3",
    title: "EUR/USD Rebounds on ECB Policy Outlook",
    description: "Euro strengthens against dollar as ECB signals hawkish stance.",
    snippet: "Forex markets react to central bank communications across major economies.",
    url: "https://www.fxstreet.com",
    image_url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800",
    source: "FXStreet",
    published_at: new Date(Date.now() - 7200000).toISOString(),
    entities: [{ symbol: "EUR/USD", name: "Euro Dollar", type: "forex" }],
  },
  {
    uuid: "fb-4",
    title: "Ethereum Network Activity Hits New High",
    description: "ETH on-chain metrics signal growing adoption and network strength.",
    snippet: "Layer-2 solutions and DeFi continue to drive Ethereum's expansion.",
    url: "https://cointelegraph.com",
    image_url: "https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=800",
    source: "Cointelegraph",
    published_at: new Date(Date.now() - 10800000).toISOString(),
    entities: [{ symbol: "ETH", name: "Ethereum", type: "crypto" }],
  },
  {
    uuid: "fb-5",
    title: "Crude Oil Prices Climb on Supply Concerns",
    description: "WTI and Brent crude rise as geopolitical tensions impact supply chains.",
    snippet: "Energy markets remain volatile amid OPEC+ production decisions.",
    url: "https://www.bloomberg.com",
    image_url: "https://images.unsplash.com/photo-1582486225644-088c0a3ff908?w=800",
    source: "Bloomberg",
    published_at: new Date(Date.now() - 14400000).toISOString(),
    entities: [{ symbol: "WTI", name: "Crude Oil", type: "commodity" }],
  },
  {
    uuid: "fb-6",
    title: "USD/JPY Tests Multi-Year Highs",
    description: "Dollar-Yen pair extends gains on diverging monetary policy expectations.",
    snippet: "BoJ intervention concerns mount as the yen weakens further.",
    url: "https://www.dailyfx.com",
    image_url: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800",
    source: "DailyFX",
    published_at: new Date(Date.now() - 18000000).toISOString(),
    entities: [{ symbol: "USD/JPY", name: "Dollar Yen", type: "forex" }],
  },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const category = url.searchParams.get('category') || 'all'; // all | crypto | forex | commodities
    const limit = parseInt(url.searchParams.get('limit') || '12');

    // Serve cache if valid
    if (cache && cache.category === category && Date.now() - cache.timestamp < CACHE_DURATION_MS) {
      console.log(`[News] Serving cached ${category} news`);
      return new Response(JSON.stringify({ data: cache.data, cached: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build Marketaux query based on category.
    // Note: Marketaux free plan rejects timestamp-format published_after (HTTP 400)
    // and returns 0 results for date-only published_after — so we omit it entirely
    // and filter the last 24 hours locally (results are sorted published_desc).
    // MARKETAUX_API_KEY + MARKETAUX_API_KEY_1..N are tried in order; when a
    // key hits its rate limit the next one takes over automatically.
    const baseParams = new URLSearchParams({
      language: 'en',
      limit: String(Math.min(limit, 50)),
      filter_entities: 'true',
      sort: 'published_desc',
    });

    // Note: `industries` filter returns 0 results on the free plan — use `search` instead.
    if (category === 'crypto') {
      baseParams.set('search', 'crypto OR bitcoin OR ethereum OR cryptocurrency OR blockchain');
    } else if (category === 'forex') {
      baseParams.set('search', 'forex OR currency OR EUR OR USD OR JPY OR GBP');
    } else if (category === 'commodities') {
      baseParams.set('search', 'gold OR silver OR oil OR commodities OR crude');
    } else {
      baseParams.set('search', 'crypto OR forex OR gold OR oil OR bitcoin');
    }

    console.log(`[News] Fetching ${category} from Marketaux (with key rotation)`);
    const { data: json, keyIndex, error: marketauxError } = await fetchJsonWithRotation(
      'MARKETAUX',
      (apiKey) => {
        const params = new URLSearchParams(baseParams);
        params.set('api_token', apiKey);
        return { url: `https://api.marketaux.com/v1/news/all?${params.toString()}` };
      },
      { validate: (d: any) => d && Array.isArray(d.data), timeoutMs: 10000 },
    );

    if (!json || !Array.isArray(json.data)) {
      console.error(`[News] All Marketaux keys failed: ${marketauxError}`);
      return new Response(JSON.stringify({ data: FALLBACK_NEWS, fallback: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const allArticles = json.data;
    console.log(`[News] Marketaux returned ${allArticles.length} raw articles via key #${(keyIndex ?? 0) + 1}`);

    // Freshness filter: keep only articles from the last 24 hours.
    // The Marketaux free plan ignores sort/published_after and returns old
    // relevance-ranked articles, so when nothing is fresh we fall back to
    // Google News RSS (free, no key, always fresh) for real articles.
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const fresh = allArticles.filter((a: any) => {
      const t = new Date(a.published_at).getTime();
      return !isNaN(t) && t >= cutoff;
    });

    if (fresh.length > 0) {
      cache = { data: fresh, timestamp: Date.now(), category };
      return new Response(JSON.stringify({ data: fresh, cached: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[News] No fresh Marketaux articles (${allArticles.length} stale) — trying Google News RSS`);
    const rssArticles = await fetchGoogleNews(RSS_QUERIES[category] ?? RSS_QUERIES.all, limit);
    if (rssArticles.length > 0) {
      console.log(`[News] Google News RSS returned ${rssArticles.length} articles`);
      cache = { data: rssArticles, timestamp: Date.now(), category };
      return new Response(JSON.stringify({ data: rssArticles, cached: false, source: 'google-news' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ data: FALLBACK_NEWS, fallback: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[News] Error:', error);
    return new Response(JSON.stringify({ data: FALLBACK_NEWS, fallback: true, error: String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
