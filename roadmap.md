# Roadmap

- [x] Build shared API key rotator (`supabase/functions/_shared/apiKeyRotator.ts`) — auto-switch to next key when limit/rate-limit hit
- [x] Integrate rotator into edge functions using Marketaux, FMP, CoinGecko, CoinMarketCap, GoldPriceZ
- [x] Request all API keys from user via secure form (numbered keys per service)
- [x] Deploy updated edge functions
- [x] Verify rotation works live (fetch-market-news: key #1 invalid → auto-rotates to key #2; commodities: Yahoo source active, FMP/GoldPricez/CoinGecko rotation in place)
- [x] Fix Marketaux free-plan quirks (published_after rejected, industries empty, sort ignored) — Google News RSS fallback added for fresh headlines

