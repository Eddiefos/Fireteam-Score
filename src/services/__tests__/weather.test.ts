import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchWeather } from '../weather'

vi.mock('../supabase', () => ({
  supabase: {
    supabaseUrl: 'https://test.supabase.co',
    supabaseKey: 'test-key',
  }
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('fetchWeather', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
