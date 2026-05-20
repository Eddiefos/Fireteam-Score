import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  const url = new URL(req.url)
  const lat = url.searchParams.get('lat')
  const lon = url.searchParams.get('lon')

  if (!lat || !lon) {
    return new Response(
      JSON.stringify({ error: 'lat and lon are required' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }

  const metUrl = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`

  const metRes = await fetch(metUrl, {
    headers: {
      'User-Agent': 'FireteamScore/1.0 edvard.fosseie@try.no',
    }
  })

  if (!metRes.ok) {
    return new Response(
      JSON.stringify({ error: `Met.no error: ${metRes.status}` }),
      { status: metRes.status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }

  const data = await metRes.json()
  const now = data.properties?.timeseries?.[0]?.data

  if (!now) {
    return new Response(
      JSON.stringify({ error: 'No weather data available' }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }

  const result = {
    temperature: now.instant.details.air_temperature,
    windSpeed: now.instant.details.wind_speed,
    windDirection: now.instant.details.wind_from_direction,
    symbolCode: now.next_1_hours?.summary?.symbol_code ?? now.next_6_hours?.summary?.symbol_code ?? 'cloudy',
    fetchedAt: Date.now(),
  }

  return new Response(JSON.stringify(result), {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=1800',  // 30 min browser cache
    }
  })
})
