import { supabase } from './supabase'
import type { WeatherData } from '../types'

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  const url = `${supabaseUrl}/functions/v1/weather-proxy?lat=${lat}&lon=${lon}`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${supabaseKey}`,
      apikey: supabaseKey,
    }
  })

  if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`)

  return res.json() as Promise<WeatherData>
}

const SYMBOL_MAP: Record<string, string> = {
  clearsky: '☀️',
  fair: '🌤️',
  partlycloudy: '⛅',
  cloudy: '☁️',
  fog: '🌫️',
  lightrain: '🌦️',
  rain: '🌧️',
  heavyrain: '🌧️',
  lightsnow: '🌨️',
  snow: '❄️',
  heavysnow: '❄️',
  lightrainshowers: '🌦️',
  rainshowers: '🌧️',
  snowshowers: '🌨️',
  thunder: '⛈️',
  thundershowers: '⛈️',
}

export function weatherEmoji(symbolCode: string): string {
  const base = symbolCode.replace(/_day|_night|_polartwilight/, '')
  return SYMBOL_MAP[base] ?? '🌡️'
}

export function windCompass(degrees: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(degrees / 45) % 8]
}
