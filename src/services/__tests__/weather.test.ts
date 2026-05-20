import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchWeather, weatherEmoji, windCompass } from '../weather'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('fetchWeather', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('calls the weather-proxy edge function with lat/lon', async () => {
    const mockWeather = {
      temperature: 14,
      windSpeed: 3.5,
      windDirection: 180,
      symbolCode: 'partlycloudy_day',
      fetchedAt: Date.now()
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockWeather
    } as Response)

    const result = await fetchWeather(58.14, 7.99)

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/weather-proxy?lat=58.14&lon=7.99'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
          apikey: 'test-key',
        })
      })
    )
    expect(result.temperature).toBe(14)
    expect(result.symbolCode).toBe('partlycloudy_day')
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502
    } as Response)

    await expect(fetchWeather(58.14, 7.99)).rejects.toThrow('Weather fetch failed: 502')
  })
})

describe('weatherEmoji', () => {
  it('strips _day suffix and maps to emoji', () => {
    expect(weatherEmoji('clearsky_day')).toBe('☀️')
  })

  it('strips _night suffix', () => {
    expect(weatherEmoji('rain_night')).toBe('🌧️')
  })

  it('returns fallback for unknown codes', () => {
    expect(weatherEmoji('unknown_condition')).toBe('🌡️')
  })
})

describe('windCompass', () => {
  it('returns correct cardinal directions', () => {
    expect(windCompass(0)).toBe('N')
    expect(windCompass(90)).toBe('E')
    expect(windCompass(180)).toBe('S')
    expect(windCompass(270)).toBe('W')
  })

  it('rounds correctly', () => {
    expect(windCompass(45)).toBe('NE')
    expect(windCompass(315)).toBe('NW')
  })
})
