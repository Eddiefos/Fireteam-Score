import { useState } from 'react'
import { useOfficialCourses } from '../hooks/useOfficialCourses'

const FT = {
  forest: '#1F3D2B', cream: '#F4EFE4', paper: '#FAF6EC',
  ink: '#15110D', orange: '#FF6B1F',
  dim: 'rgba(42,31,23,0.55)', hair: 'rgba(42,31,23,0.12)',
  error: '#c0392b',
}

export function OfficialCoursesScreen({ go, onToast }) {
  const { courses, loading, error, search } = useOfficialCourses()
  const [query, setQuery] = useState('')

  const results = search(query)

  return (
    <div style={{ background: FT.cream, minHeight: '100vh', fontFamily: '-apple-system, SF Pro Display, system-ui, sans-serif' }}>
      {/* Status bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 18px 6px', fontSize: 10, fontWeight: 600, color: FT.ink }}>
        <span>9:41</span><span>●●●</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 14px 6px' }}>
        <button
          onClick={() => go('courses')}
          style={{ width: 30, height: 30, borderRadius: 9, background: FT.paper, border: `1px solid ${FT.hair}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer' }}
        >‹</button>
        <span style={{ fontFamily: 'SF Mono, monospace', fontSize: 9, letterSpacing: 2, color: FT.dim }}>OFFICIAL COURSES</span>
        <div style={{ width: 30 }} />
      </div>

      {/* Title */}
      <div style={{ padding: '0 14px 12px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: -0.7, color: FT.ink, lineHeight: 1.1 }}>
          Official<br />Courses.
        </h1>
      </div>

      {/* Search */}
      <div style={{ margin: '0 12px 12px', background: FT.paper, border: `1.5px solid rgba(31,61,43,0.3)`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 7, padding: '9px 11px' }}>
        <span style={{ fontSize: 12, opacity: 0.5 }}>🔍</span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search official courses…"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: FT.ink }}
        />
        {query.length > 0 && (
          <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: FT.dim }}>✕</button>
        )}
      </div>

      {/* Course list */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 32, color: FT.dim, fontSize: 13 }}>Loading courses…</div>
      )}
      {error && (
        <div style={{ textAlign: 'center', padding: 32, color: FT.error, fontSize: 13 }}>{error}</div>
      )}
      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 10px' }}>
          {results.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 20px', color: FT.dim, fontSize: 13 }}>
              No courses match "{query}"
            </div>
          )}
          {results.map(course => (
            <button
              key={course.id}
              onClick={() => go('courseDetail', { courseId: course.id })}
              style={{ background: FT.paper, border: `1px solid ${FT.hair}`, borderRadius: 14, padding: '10px 11px', display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', textAlign: 'left', width: '100%' }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, background: FT.forest, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: FT.cream, flexShrink: 0 }}>
                {course.holes}H
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: FT.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{course.name}</div>
                <div style={{ fontSize: 10, color: FT.dim, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {course.location}
                  <span style={{ background: 'rgba(255,107,31,0.12)', color: FT.orange, fontSize: 8, fontWeight: 600, padding: '1px 4px', borderRadius: 3, fontFamily: 'SF Mono, monospace' }}>OFFICIAL</span>
                </div>
              </div>
              <span style={{ fontSize: 12, color: FT.dim, flexShrink: 0 }}>→</span>
            </button>
          ))}
        </div>
      )}

      {/* Submit link */}
      <div style={{ textAlign: 'center', padding: '16px 14px 24px', fontSize: 11, color: FT.orange, fontWeight: 500 }}>
        <button onClick={() => go('submitCourse')} style={{ background: 'none', border: 'none', color: FT.orange, fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
          Missing a course? Submit it →
        </button>
      </div>
    </div>
  )
}
