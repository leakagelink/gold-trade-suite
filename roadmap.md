# Roadmap

- [ ] Build shared API key rotator (`supabase/functions/_shared/apiKeyRotator.ts`) — auto-switch to next key when limit/rate-limit hit
- [ ] Integrate rotator into edge functions using Marketaux, FMP, CoinGecko, CoinMarketCap, GoldPriceZ
- [ ] Request all API keys from user via secure form (numbered keys per service)
- [ ] Deploy updated edge functions and verify
