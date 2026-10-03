# Project Technical Decisions

## API key rotation
All third-party market APIs (FMP, CoinGecko, CoinMarketCap, Marketaux, GoldPriceZ) must go through `supabase/functions/_shared/apiKeyRotator.ts` — never call the provider with a single `Deno.env.get('<S>_API_KEY')`. Keys are configured as `<S>_API_KEY` plus numbered `<S>_API_KEY_1.._10`; when one key returns 429/402/401/403 it is skipped (10-min cooldown) and the next key takes over automatically.
Why: the user runs multiple paid API accounts per provider and wants automatic failover when a key's quota is exhausted, without redeploys.
