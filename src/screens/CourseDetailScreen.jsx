import { useState, useEffect, lazy, Suspense } from 'react'
import { FT, SFR, MONO } from '../constants/colors'
import { ScreenShell } from '../components/layout/ScreenShell'
import { StatusBar, HomeIndicator, IconChevronLeft } from '../components/atoms'
import { useOfficialCourses } from '../hooks/useOfficialCourses'
import { fetchWeather, weatherEmoji, windCompass } from '../services/weather'

// Lazy load MapLibre to keep initial bundle small
const CourseMap = lazy(() =>
  import('react-map-gl/maplibre').then((m) => {
    function Inner({ lat, lng, mapStyle }) {
      return (
        <m.Map
          initialViewState={{ longitude: lng, latitude: lat, zoom: 13 }}
          style={{ width: '100%', height: '100%' }}
          mapStyle={mapStyle}
        >
          <m.Marker longitude={lng} latitude={lat}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: FT.orange,
                border: '2.5px solid white',
                boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
              }}
            />
          </m.Marker>
        </m.Map>
      )
    }
    return { default: Inner }
  })
)

const KARTVERKET_STYLE = {
  version: 8,
  sources: {
    kartverket: {
      type: 'raster',
      tiles: [
        'https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png',
      ],
      tileSize: 256,
      attribution: '© Kartverket CC BY 4.0',
    },
  },
  layers: [{ id: 'kartverket-layer', type: 'raster', source: 'kartverket' }],
}

// ─────────────────────────────────────────────────────────────────────────────
//  CourseDetailScreen
// ─────────────────────────────────────────────────────────────────────────────
export function CourseDetailScreen({ go, params = {} }) {
  const { courseId, returnTo = 'officialCourses' } = params
  const { courses, loading: coursesLoading } = useOfficialCourses()
  const [weather, setWeather] = useState(null)
  const [weatherLoading, setWeatherLoading] = useState(false)

  const course = courses.find((c) => c.id === courseId) ?? null

  useEffect(() => {
    if (!course?.lat || !course?.lng) return
    setWeatherLoading(true)
    fetchWeather(course.lat, course.lng)
      .then(setWeather)
      .catch(() => {})
      .finally(() => setWeatherLoading(false))
  }, [course?.lat, course?.lng])

  // ── Loading state ──────────────────────────────────────────────────────────
  if (coursesLoading) {
    return (
      <ScreenShell label="Course">
        <StatusBar />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            color: FT.dim,
            fontSize: 13,
          }}
        >
          Loading…
        </div>
      </ScreenShell>
    )
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!course) {
    return (
      <ScreenShell label="Course">
        <StatusBar />
        <div style={{ padding: 24, color: FT.dim, fontSize: 13 }}>
          Course not found.
        </div>
      </ScreenShell>
    )
  }

  const parTotal =
    course.par_total ??
    course.course_holes?.reduce((s, h) => s + h.par, 0) ??
    0
  const holes = [...(course.course_holes ?? [])].sort(
    (a, b) => a.hole_number - b.hole_number
  )

  return (
    <ScreenShell label="Course Detail">
      <StatusBar />

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 20px 8px',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => go(returnTo)}
          className="flat"
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            background: FT.paper,
            border: `1px solid ${FT.hair}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <IconChevronLeft />
        </button>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: 2,
            color: FT.dim,
          }}
        >
          COURSE DETAIL
        </span>
        <div style={{ width: 36 }} />
      </div>

      {/* Scrollable body */}
      <div className="ft-scroll">
        {/* Title block */}
        <div style={{ padding: '2px 20px 12px' }}>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 900,
              fontFamily: SFR,
              letterSpacing: -0.8,
              color: FT.ink,
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            {course.name}
          </h1>
          <div
            style={{
              fontSize: 13,
              color: FT.dim,
              marginTop: 5,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            {course.location && <span>{course.location}</span>}
            <span
              style={{
                background: 'rgba(255,107,31,0.12)',
                color: FT.orange,
                fontSize: 9,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 5,
                fontFamily: MONO,
                letterSpacing: 1,
              }}
            >
              OFFICIAL
            </span>
            {course.pdga_id && (
              <span
                style={{
                  background: 'rgba(42,31,23,0.06)',
                  color: FT.dim,
                  fontSize: 9,
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: 5,
                  fontFamily: MONO,
                  letterSpacing: 1,
                }}
              >
                PDGA #{course.pdga_id}
              </span>
            )}
          </div>
        </div>

        {/* Map */}
        {course.lat && course.lng && (
          <div
            style={{
              margin: '0 16px 14px',
              borderRadius: 18,
              overflow: 'hidden',
              height: 190,
              border: `1px solid ${FT.hair}`,
            }}
          >
            <Suspense
              fallback={
                <div
                  style={{
                    height: 190,
                    background: FT.paper,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: FT.dim,
                    fontSize: 12,
                    fontFamily: MONO,
                    letterSpacing: 1,
                  }}
                >
                  MAP LOADING…
                </div>
              }
            >
              <CourseMap
                lat={course.lat}
                lng={course.lng}
                mapStyle={KARTVERKET_STYLE}
              />
            </Suspense>
          </div>
        )}

        {/* Stats row */}
        <div
          style={{ display: 'flex', gap: 8, padding: '0 16px 14px' }}
        >
          {/* Holes */}
          <div
            style={{
              flex: 1,
              background: FT.paper,
              border: `1px solid ${FT.hair}`,
              borderRadius: 14,
              padding: '10px 12px',
            }}
          >
            <div
              style={{
                fontFamily: MONO,
                fontSize: 8,
                letterSpacing: 1.5,
                color: FT.dim,
                marginBottom: 4,
              }}
            >
              HOLES
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                fontFamily: SFR,
                color: FT.ink,
              }}
            >
              {course.holes}
            </div>
          </div>

          {/* Par */}
          <div
            style={{
              flex: 1,
              background: FT.paper,
              border: `1px solid ${FT.hair}`,
              borderRadius: 14,
              padding: '10px 12px',
            }}
          >
            <div
              style={{
                fontFamily: MONO,
                fontSize: 8,
                letterSpacing: 1.5,
                color: FT.dim,
                marginBottom: 4,
              }}
            >
              PAR
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                fontFamily: SFR,
                color: FT.ink,
              }}
            >
              {parTotal || '–'}
            </div>
          </div>

          {/* Weather */}
          <div
            style={{
              flex: 2,
              background: FT.paper,
              border: `1px solid ${FT.hair}`,
              borderRadius: 14,
              padding: '10px 12px',
            }}
          >
            <div
              style={{
                fontFamily: MONO,
                fontSize: 8,
                letterSpacing: 1.5,
                color: FT.dim,
                marginBottom: 4,
              }}
            >
              WEATHER
            </div>
            {weatherLoading && (
              <div style={{ fontSize: 12, color: FT.dim }}>…</div>
            )}
            {!weatherLoading && weather && (
              <div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    fontFamily: SFR,
                    color: FT.ink,
                    lineHeight: 1,
                  }}
                >
                  {weatherEmoji(weather.symbolCode)}{' '}
                  {Math.round(weather.temperature)}°
                </div>
                <div
                  style={{ fontSize: 11, color: FT.dim, marginTop: 3 }}
                >
                  {weather.windSpeed.toFixed(1)} m/s{' '}
                  {windCompass(weather.windDirection)}
                  {weather.windSpeed >= 8 && (
                    <span
                      style={{ color: FT.orange, marginLeft: 5 }}
                    >
                      ⚠ Windy
                    </span>
                  )}
                </div>
              </div>
            )}
            {!weatherLoading && !weather && (
              <div style={{ fontSize: 12, color: FT.dim }}>–</div>
            )}
          </div>
        </div>

        {/* Hole-by-hole grid */}
        {holes.length > 0 && (
          <div style={{ padding: '0 16px 14px' }}>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 9,
                letterSpacing: 2,
                color: FT.dim,
                marginBottom: 10,
              }}
            >
              HOLE BY HOLE
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: 6,
              }}
            >
              {holes.map((h) => (
                <div
                  key={h.hole_number}
                  style={{
                    background: FT.paper,
                    border: `1px solid ${FT.hair}`,
                    borderRadius: 12,
                    padding: '8px 4px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontFamily: MONO,
                      fontSize: 8,
                      color: FT.dim,
                      letterSpacing: 0.5,
                    }}
                  >
                    {h.hole_number}
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 900,
                      fontFamily: SFR,
                      color: FT.ink,
                      marginTop: 3,
                    }}
                  >
                    P{h.par}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Spacer so CTA doesn't overlap last card */}
        <div style={{ height: 8 }} />
      </div>

      {/* CTA — pinned to bottom */}
      <div
        style={{
          padding: '10px 16px 12px',
          flexShrink: 0,
          background: `linear-gradient(to top, ${FT.cream} 65%, rgba(244,239,228,0))`,
        }}
      >
        <button
          onClick={() => go('start', { courseId: course.id })}
          style={{
            width: '100%',
            height: 58,
            borderRadius: 18,
            border: 'none',
            background: FT.orange,
            color: FT.ink,
            fontFamily: SFR,
            fontWeight: 900,
            fontSize: 17,
            letterSpacing: -0.3,
            cursor: 'pointer',
            boxShadow:
              '0 6px 0 rgba(0,0,0,0.22), 0 14px 24px rgba(255,107,31,0.35)',
          }}
        >
          Choose this course
        </button>
      </div>

      <HomeIndicator />
    </ScreenShell>
  )
}
