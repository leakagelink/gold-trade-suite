import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { fetchJsonWithRotation, getServiceKeys } from "../_shared/apiKeyRotator.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const keyCount = getServiceKeys('COINMARKETCAP').length;
  const { data, keyIndex, error } = await fetchJsonWithRotation(
    'COINMARKETCAP',
    (apiKey) => ({
      url: 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=PAXG,KAG&convert=USD',
      headers: { 'X-CMC_PRO_API_KEY': apiKey },
    }),
    { validate: (d: any) => d && d.data && (d.data.PAXG || d.data.KAG) },
  );
  const paxg = data?.data?.PAXG?.quote?.USD;
  const kag = data?.data?.KAG?.quote?.USD;
  return new Response(JSON.stringify({
    keysConfigured: keyCount,
    success: !!data,
    usedKeyIndex: keyIndex,
    error: error ?? null,
    paxgPrice: paxg?.price ?? null,
    kagPrice: kag?.price ?? null,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
