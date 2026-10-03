// Economic Calendar - High impact events for the current week.
// Source: Forex Factory public weekly feed (free, no API key).
// Trading Economics guest access was discontinued (HTTP 410).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FEED_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

const parseNumeric = (v: string | null | undefined): number | null => {
  if (!v) return null;
  const cleaned = String(v).replace(/[%$,KMBT]/gi, '').trim();
  if (cleaned === '' || cleaned === '-') return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
};

const extractUnit = (v: string | null | undefined): string => {
  if (!v) return '';
  const m = String(v).match(/[%KMBT]$/i);
  return m ? m[0].toUpperCase() : '';
};

// Forex Factory uses currency codes in `country`
const currencyToCountry: Record<string, string> = {
  USD: 'US', EUR: 'EU', GBP: 'UK', JPY: 'JP', CNY: 'CN', INR: 'IN',
  CAD: 'CA', AUD: 'AU', CHF: 'CH', NZD: 'NZ',
};

let cache: { at: number; body: string } | null = null;
const CACHE_MS = 30 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: string) =>
    new Response(body, { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  try {
    if (cache && Date.now() - cache.at < CACHE_MS) return json(cache.body);

    const response = await fetch(FEED_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Calendar feed failed [${response.status}]: ${text.slice(0, 200)}`);
    }
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Invalid calendar feed response');

    const events = data
      .filter((ev: any) => ev?.impact === 'High' && ev.title && ev.date && currencyToCountry[ev.country])
      .map((ev: any) => ({
        date: ev.date,
        country: currencyToCountry[ev.country],
        event: ev.title,
        currency: ev.country,
        impact: 'high',
        actual: parseNumeric(ev.actual),
        previous: parseNumeric(ev.previous),
        estimate: parseNumeric(ev.forecast),
        unit: extractUnit(ev.forecast) || extractUnit(ev.previous),
      }))
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const body = JSON.stringify({ events, source: 'forexfactory' });
    cache = { at: Date.now(), body };
    console.log(`Returning ${events.length} high-impact events`);
    return json(body);
  } catch (error) {
    console.error('Error fetching economic calendar:', error);
    if (cache) return json(cache.body);
    // Return 200 with empty list so the page never breaks
    return json(JSON.stringify({ events: [], error: error instanceof Error ? error.message : 'Unknown error' }));
  }
});
