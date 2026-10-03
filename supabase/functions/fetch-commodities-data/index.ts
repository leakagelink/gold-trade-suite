import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { gfxPriceNow, gfxChangePct } from "../_shared/gfxSynthetic.ts";
import { fetchJsonWithRotation, getServiceKeys } from "../_shared/apiKeyRotator.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Static fallback data for commodities - Updated with current market prices (Jan 2026)
const STATIC_FALLBACK_DATA = {
  commoditiesData: [
    { name: "Gold", symbol: "XAU", price: "4332.01", change: "+0.28%", isPositive: true, icon: "🥇", currencySymbol: "$", fullName: "Gold" },
    { name: "Silver", symbol: "XAG", price: "72.62", change: "+1.89%", isPositive: true, icon: "🥈", currencySymbol: "$", fullName: "Silver" },
    { name: "Crude Oil", symbol: "WTI", price: "57.32", change: "-0.17%", isPositive: false, icon: "🛢️", currencySymbol: "$", fullName: "Crude Oil WTI" },
    { name: "Natural Gas", symbol: "NG", price: "3.64", change: "-0.07%", isPositive: false, icon: "🔥", currencySymbol: "$", fullName: "Natural Gas" },
    { name: "Copper", symbol: "XCU", price: "5.65", change: "-1.02%", isPositive: false, icon: "🔶", currencySymbol: "$", fullName: "Copper" },
    { name: "Platinum", symbol: "XPT", price: "2142.50", change: "+4.21%", isPositive: true, icon: "💎", currencySymbol: "$", fullName: "Platinum" },
    { name: "Palladium", symbol: "XPD", price: "950.00", change: "-0.30%", isPositive: false, icon: "⬜", currencySymbol: "$", fullName: "Palladium" },
    { name: "Brent Oil", symbol: "BRENT", price: "60.75", change: "-0.16%", isPositive: false, icon: "🛢️", currencySymbol: "$", fullName: "Brent Crude Oil" },
  ]
};

// CoinGecko commodity-backed tokens mapping (FREE API - no key needed)
// PAXG = 1 troy ounce of gold, so price = gold price
const COINGECKO_COMMODITY_TOKENS = [
  { id: 'pax-gold', symbol: 'XAU', name: 'Gold', icon: '🥇', fullName: 'Gold' },
  { id: 'tether-gold', symbol: 'XAU_ALT', name: 'Gold Alt', icon: '🥇', fullName: 'Gold' }, // backup for gold
];

// Commodity configurations for API fetching
const COMMODITIES_CONFIG = [
  { name: "Gold", symbol: "XAU", apiSymbol: "XAU", icon: "🥇", fullName: "Gold" },
  { name: "Silver", symbol: "XAG", apiSymbol: "XAG", icon: "🥈", fullName: "Silver" },
  { name: "Platinum", symbol: "XPT", apiSymbol: "XPT", icon: "💎", fullName: "Platinum" },
  { name: "Palladium", symbol: "XPD", apiSymbol: "XPD", icon: "⬜", fullName: "Palladium" },
  { name: "Copper", symbol: "XCU", apiSymbol: "XCU", icon: "🔶", fullName: "Copper" },
  { name: "Crude Oil", symbol: "WTI", apiSymbol: "WTI", icon: "🛢️", fullName: "Crude Oil WTI" },
  { name: "Natural Gas", symbol: "NG", apiSymbol: "NG", icon: "🔥", fullName: "Natural Gas" },
  { name: "Brent Oil", symbol: "BRENT", apiSymbol: "BRENT", icon: "🛢️", fullName: "Brent Crude Oil" },
];

// Yahoo Finance chart endpoint (no API key, no auth crumb required)
async function fetchOneCommodityFromYahoo(meta: { yahoo: string; symbol: string; name: string; icon: string; fullName: string }): Promise<any | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(meta.yahoo)}?interval=1d&range=2d`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) {
      console.error(`Yahoo chart ${meta.yahoo} HTTP error:`, res.status);
      return null;
    }
    const data = await res.json();
    const m = data?.chart?.result?.[0]?.meta;
    const price = m?.regularMarketPrice;
    const prevClose = m?.chartPreviousClose ?? m?.previousClose;
    if (typeof price !== 'number') return null;
    const changePct = typeof prevClose === 'number' && prevClose > 0
      ? ((price - prevClose) / prevClose) * 100
      : 0;
    return {
      name: meta.name,
      symbol: meta.symbol,
      price: price.toFixed(2),
      change: `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`,
      isPositive: changePct >= 0,
      icon: meta.icon,
      currencySymbol: '$',
      fullName: meta.fullName,
    };
  } catch (e) {
    console.error(`Yahoo chart ${meta.yahoo} error:`, e);
    return null;
  }
}

async function fetchFromYahooFinance(): Promise<any[]> {
  const symbolMap = [
    // Spot prices (XAUUSD etc) — matches real market spot, not futures contango
    { yahoo: 'XAUUSD=X', symbol: 'XAU', name: 'Gold', icon: '🥇', fullName: 'Gold' },
    { yahoo: 'XAGUSD=X', symbol: 'XAG', name: 'Silver', icon: '🥈', fullName: 'Silver' },
    { yahoo: 'XPTUSD=X', symbol: 'XPT', name: 'Platinum', icon: '💎', fullName: 'Platinum' },
    { yahoo: 'XPDUSD=X', symbol: 'XPD', name: 'Palladium', icon: '⬜', fullName: 'Palladium' },
    { yahoo: 'HG=F', symbol: 'XCU', name: 'Copper', icon: '🔶', fullName: 'Copper' },
    { yahoo: 'CL=F', symbol: 'WTI', name: 'Crude Oil', icon: '🛢️', fullName: 'Crude Oil WTI' },
    { yahoo: 'BZ=F', symbol: 'BRENT', name: 'Brent Oil', icon: '🛢️', fullName: 'Brent Crude Oil' },
    { yahoo: 'NG=F', symbol: 'NG', name: 'Natural Gas', icon: '🔥', fullName: 'Natural Gas' },
  ];
  const results = await Promise.all(symbolMap.map(fetchOneCommodityFromYahoo));
  const filtered = results.filter((r) => r !== null);
  console.log(`Yahoo Finance returned ${filtered.length}/${symbolMap.length} commodities`);
  return filtered;
}

// Fetch commodity prices from CoinGecko — rotates across COINGECKO_API_KEY_1..N
// when a key hits its limit; falls back to keyless access if no keys are set.
// Uses commodity-backed tokens: PAXG (gold), calculates silver from gold/silver ratio
async function fetchFromCoinGecko(): Promise<any[]> {
  try {
    console.log('Fetching commodity prices from CoinGecko (with key rotation)...');

    // Fetch PAXG (gold-backed token) - 1 PAXG = 1 troy oz gold
    const { data, error } = await fetchJsonWithRotation(
      'COINGECKO',
      (apiKey) => ({
        url: 'https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=usd&include_24hr_change=true',
        headers: apiKey ? { 'x-cg-demo-api-key': apiKey } : undefined,
      }),
      { validate: (d: any) => d && d['pax-gold'], allowKeyless: true },
    );

    if (!data) {
      console.error('CoinGecko API error (all keys):', error);
      return [];
    }
    console.log('CoinGecko response:', JSON.stringify(data));
    
    const results: any[] = [];
    
    // Gold from PAXG (1 PAXG = 1 oz gold)
    if (data['pax-gold']) {
      const goldPrice = data['pax-gold'].usd;
      const goldChange = data['pax-gold'].usd_24h_change || 0;
      
      results.push({
        name: "Gold",
        symbol: "XAU",
        price: goldPrice.toFixed(2),
        change: `${goldChange >= 0 ? '+' : ''}${goldChange.toFixed(2)}%`,
        isPositive: goldChange >= 0,
        icon: "🥇",
        currencySymbol: "$",
        fullName: "Gold"
      });
      console.log(`CoinGecko Gold (PAXG): $${goldPrice.toFixed(2)} (${goldChange.toFixed(2)}%)`);
      
      // Calculate Silver using Gold/Silver ratio (historically ~80:1, current ~60:1)
      const goldSilverRatio = 59.65; // Current approximate ratio
      const silverPrice = goldPrice / goldSilverRatio;
      const silverChange = goldChange * 1.2; // Silver typically moves more than gold
      
      results.push({
        name: "Silver",
        symbol: "XAG",
        price: silverPrice.toFixed(2),
        change: `${silverChange >= 0 ? '+' : ''}${silverChange.toFixed(2)}%`,
        isPositive: silverChange >= 0,
        icon: "🥈",
        currencySymbol: "$",
        fullName: "Silver"
      });
      console.log(`Calculated Silver: $${silverPrice.toFixed(2)}`);
      
      // Calculate Platinum (typically 0.45-0.55x gold price)
      const platinumRatio = 0.495;
      const platinumPrice = goldPrice * platinumRatio;
      const platinumChange = goldChange * 0.9;
      
      results.push({
        name: "Platinum",
        symbol: "XPT",
        price: platinumPrice.toFixed(2),
        change: `${platinumChange >= 0 ? '+' : ''}${platinumChange.toFixed(2)}%`,
        isPositive: platinumChange >= 0,
        icon: "💎",
        currencySymbol: "$",
        fullName: "Platinum"
      });
      console.log(`Calculated Platinum: $${platinumPrice.toFixed(2)}`);
      
      // Calculate Palladium (typically 0.20-0.25x gold price currently)
      const palladiumRatio = 0.22;
      const palladiumPrice = goldPrice * palladiumRatio;
      const palladiumChange = goldChange * 0.8;
      
      results.push({
        name: "Palladium",
        symbol: "XPD",
        price: palladiumPrice.toFixed(2),
        change: `${palladiumChange >= 0 ? '+' : ''}${palladiumChange.toFixed(2)}%`,
        isPositive: palladiumChange >= 0,
        icon: "⬜",
        currencySymbol: "$",
        fullName: "Palladium"
      });
      console.log(`Calculated Palladium: $${palladiumPrice.toFixed(2)}`);
    }
    
    console.log(`Successfully fetched ${results.length} commodities from CoinGecko`);
    return results;
  } catch (error) {
    console.error('CoinGecko fetch error:', error);
    return [];
  }
}

// Fetch Oil & Gas from FMP (Financial Modeling Prep) — rotates across FMP_API_KEY_1..N
async function fetchFromFMP(): Promise<any[]> {
  try {
    console.log('Fetching oil & gas from FMP API (with key rotation)...');

    const results: any[] = [];

    // FMP commodity symbols
    const commoditySymbols = [
      { symbol: 'CLUSD', name: 'Crude Oil', appSymbol: 'WTI', icon: '🛢️', fullName: 'Crude Oil WTI' },
      { symbol: 'BZUSD', name: 'Brent Oil', appSymbol: 'BRENT', icon: '🛢️', fullName: 'Brent Crude Oil' },
      { symbol: 'NGUSD', name: 'Natural Gas', appSymbol: 'NG', icon: '🔥', fullName: 'Natural Gas' },
      { symbol: 'HGUSD', name: 'Copper', appSymbol: 'XCU', icon: '🔶', fullName: 'Copper' },
    ];

    for (const commodity of commoditySymbols) {
      try {
        const { data, keyIndex, error } = await fetchJsonWithRotation(
          'FMP',
          (apiKey) => ({
            url: `https://financialmodelingprep.com/api/v3/quote/${commodity.symbol}?apikey=${apiKey}`,
          }),
          { validate: (d: any) => Array.isArray(d) && d.length > 0 && d[0] && typeof d[0].price === 'number' },
        );

        if (!data || !Array.isArray(data) || data.length === 0) {
          console.error(`FMP ${commodity.name} error:`, error);
          continue;
        }

        const quote = data[0];
        const price = quote.price || 0;
        const changePercent = quote.changesPercentage || 0;

        results.push({
          name: commodity.name,
          symbol: commodity.appSymbol,
          price: price.toFixed(2),
          change: `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`,
          isPositive: changePercent >= 0,
          icon: commodity.icon,
          currencySymbol: "$",
          fullName: commodity.fullName
        });
        console.log(`FMP ${commodity.name}: $${price.toFixed(2)} (${changePercent.toFixed(2)}%) [key #${keyIndex + 1}]`);
      } catch (err) {
        console.error(`Error fetching ${commodity.name} from FMP:`, err);
      }
    }

    console.log(`Successfully fetched ${results.length} energy commodities from FMP`);
    return results;
  } catch (error) {
    console.error('FMP fetch error:', error);
    return [];
  }
}

// Fetch from GoldPricez API (primary source for metals — rotates across GOLDPRICEZ_API_KEY_1..N)
async function fetchFromGoldPricez(): Promise<any[]> {
  try {
    console.log('Fetching commodities from GoldPricez API (with key rotation)...');

    const results: any[] = [];
    const metalsToFetch = ['XAU', 'XAG', 'XPT', 'XPD'];

    for (const metal of metalsToFetch) {
      try {
        const { data, keyIndex, error } = await fetchJsonWithRotation(
          'GOLDPRICEZ',
          (apiKey) => ({
            url: `https://goldpricez.com/api/rates/${metal}/usd?api_key=${apiKey}`,
          }),
          { validate: (d: any) => d && typeof d.price !== 'undefined' },
        );

        if (!data) {
          console.error(`GoldPricez ${metal} error:`, error);
          continue;
        }

        console.log(`GoldPricez ${metal} response:`, JSON.stringify(data));

        if (data && data.price) {
          const config = COMMODITIES_CONFIG.find(c => c.apiSymbol === metal);
          if (config) {
            const changePercent = data.change_percent || data.ch_pct || 0;
            results.push({
              name: config.name,
              symbol: config.symbol,
              price: parseFloat(data.price).toFixed(2),
              change: `${changePercent >= 0 ? '+' : ''}${parseFloat(changePercent).toFixed(2)}%`,
              isPositive: changePercent >= 0,
              icon: config.icon,
              currencySymbol: "$",
              fullName: config.fullName
            });
            console.log(`GoldPricez ${config.name}: $${data.price} (${changePercent}%) [key #${keyIndex + 1}]`);
          }
        }
      } catch (metalError) {
        console.error(`Error fetching ${metal}:`, metalError);
      }
    }

    console.log(`Successfully fetched ${results.length} metals from GoldPricez`);
    return results;
  } catch (error) {
    console.error('GoldPricez fetch error:', error);
    return [];
  }
}

function parsePercent(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value) || 0;
  return 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let commoditiesData: any[] = [];
    let energyData: any[] = [];
    let dataSource = 'static';

    // Try Yahoo Finance first (free, no key, covers metals + energy)
    console.log('Trying Yahoo Finance for commodities...');
    commoditiesData = await fetchFromYahooFinance();
    if (commoditiesData.length > 0) dataSource = 'Yahoo';

    // Try GoldPricez API for metals (if configured) - only if Yahoo missed metals
    const goldPricezApiKey = Deno.env.get('GOLDPRICEZ_API_KEY');
    const hasMetals = commoditiesData.some((c) => ['XAU','XAG','XPT','XPD'].includes(c.symbol));
    if (!hasMetals && goldPricezApiKey) {
      console.log('Trying GoldPricez API for metals...');
      const metals = await fetchFromGoldPricez(goldPricezApiKey);
      if (metals.length > 0) {
        commoditiesData = [...commoditiesData, ...metals];
        dataSource = dataSource === 'static' ? 'GoldPricez' : `${dataSource}+GoldPricez`;
      }
    }

    // CoinGecko fallback for metals if still missing
    const hasGold = commoditiesData.some((c) => c.symbol === 'XAU');
    if (!hasGold) {
      console.log('Trying CoinGecko (free API) for metals...');
      const cg = await fetchFromCoinGecko();
      if (cg.length > 0) {
        commoditiesData = [...commoditiesData, ...cg];
        dataSource = dataSource === 'static' ? 'CoinGecko' : `${dataSource}+CoinGecko`;
      }
    }

    // Try FMP API for Oil, Gas, Copper (uses existing FMP_API_KEY)
    const fmpApiKey = Deno.env.get('FMP_API_KEY');
    
    if (fmpApiKey) {
      console.log('Trying FMP API for energy commodities...');
      energyData = await fetchFromFMP(fmpApiKey);
      if (energyData.length > 0) {
        console.log(`Got ${energyData.length} energy commodities from FMP`);
        // Merge energy data
        for (const energy of energyData) {
          const existingIndex = commoditiesData.findIndex(c => c.symbol === energy.symbol);
          if (existingIndex >= 0) {
            commoditiesData[existingIndex] = energy; // Replace with FMP data
          } else {
            commoditiesData.push(energy);
          }
        }
        dataSource = dataSource === 'static' ? 'FMP' : `${dataSource}+FMP`;
      }
    } else {
      console.log('FMP_API_KEY not configured - using static data for energy commodities');
    }

    // Add static data for commodities we couldn't fetch
    const fetchedSymbols = commoditiesData.map(c => c.symbol);
    
    for (const fallback of STATIC_FALLBACK_DATA.commoditiesData) {
      if (!fetchedSymbols.includes(fallback.symbol)) {
        commoditiesData.push(fallback);
      }
    }

    // Sort commodities in consistent order
    const orderMap: Record<string, number> = {
      'XAU': 1, 'XAG': 2, 'WTI': 3, 'NG': 4, 'XCU': 5, 'XPT': 6, 'XPD': 7, 'BRENT': 8, 'GFXM': 99
    };
    commoditiesData.sort((a, b) => (orderMap[a.symbol] || 50) - (orderMap[b.symbol] || 50));

    // Append in-house GFXM (GrowFX Metal) synthetic commodity.
    const gfxmPrice = gfxPriceNow("GFXM");
    const gfxmChange = gfxChangePct("GFXM");
    commoditiesData.push({
      name: "GFX Metal",
      symbol: "GFXM",
      price: gfxmPrice.toFixed(2),
      change: `${gfxmChange >= 0 ? '+' : ''}${gfxmChange.toFixed(2)}%`,
      isPositive: gfxmChange >= 0,
      icon: "🪙",
      currencySymbol: "$",
      fullName: "GrowFX Metal",
    });

    console.log(`Returning ${commoditiesData.length} commodities (source: ${dataSource})`);
    
    return new Response(
      JSON.stringify({ commoditiesData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-commodities-data function:', error);
    return new Response(
      JSON.stringify(STATIC_FALLBACK_DATA),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }
});
