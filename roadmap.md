# Roadmap

- [x] Build shared API key rotator (`supabase/functions/_shared/apiKeyRotator.ts`) — auto-switch to next key when limit/rate-limit hit
- [x] Integrate rotator into edge functions using Marketaux, FMP, CoinGecko, CoinMarketCap, GoldPriceZ
- [x] Request all API keys from user via secure form (numbered keys per service)
- [x] Deploy updated edge functions
- [ ] Verify rotation works live (invoke fetch-market-news / fetch-commodities-data)
