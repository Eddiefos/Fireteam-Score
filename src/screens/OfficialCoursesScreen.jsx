import { useState } from 'react'
import { FT, SFR, SF, MONO } from '../constants/colors'
import { StatusBar, IconArrowBack, IconSearch, IconArrowForward } from '../components/atoms'
import { useOfficialCourses } from '../hooks/useOfficialCourses'

export function OfficialCoursesScreen({ go, onToast }) {
  const { courses, loading, error, search } = useOfficialCourses()
  const [query, setQuery] = useState('')

  const results = search(query)

  return (
    <div style={{ background: FT.cream, minHeight: '100vh', fontFamily: SF }}>
      <StatusBar />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 0' }}>
        <button
          onClick={() => go('courses')}
          style={{ width: 44, height: 44, borderRadius: 12, background: FT.paper, border: `1px solid ${FT.hair}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        ><IconArrowBack color={FT.ink} size={18} /></button>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: FT.dim, textTransform: 'uppercase' }}>Official Courses</span>
        <div style={{ width: 44 }} />
      </div>

      {/* Title */}
      <div style={{ padding: '8px 20px 12px' }}>
        <h1 style={{ fontFamily: SFR, fontSize: 36, fontWeight: 700, letterSpacing: -1.2, color: FT.ink, lineHeight: 1.05, margin: 0 }}>
          Official<br />Courses.
        </h1>
      </div>

      {/* Search */}
      <div style={{ margin: '0 20px 12px', background: FT.paper, border: `1.5px solid rgba(31,61,43,0.3)`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 44 }}>
        <IconSearch color={FT.dim} size={16} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search official courses…"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: FT.ink, fontFamily: SF }}
        />
        {query.length > 0 && (
          <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: FT.dim }}>✕</button>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px' }}>
          {results.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 20px', color: FT.dim, fontSize: 13 }}>
              No courses match "{query}"
            </div>
          )}
          {results.map(course => (
            <button
              key={course.id}
              onClick={() => go('courseDetail', { courseId: course.id })}
              style={{ background: FT.paper, border: `1px solid ${FT.hair}`, borderRadius: 20, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left', width: '100%' }}
            >
              <div style={{ width: 46, height: 46, borderRadius: 12, background: FT.forest, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 11, fontWeight: 600, color: FT.cream, flexShrink: 0 }}>
                {course.holes}H
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SF, fontWeight: 600, fontSize: 16, color: FT.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{course.name}</div>
                <div style={{ fontSize: 13, color: FT.dim, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {course.location}
                  <span style={{ background: 'rgba(255,107,31,0.12)', color: FT.orange, fontSize: 8, fontWeight: 600, padding: '2px 5px', borderRadius: 4, fontFamily: MONO, letterSpacing: 0.5 }}>OFFICIAL</span>
                </div>
              </div>
              <IconArrowForward color={FT.dim} size={18} />
            </button>
          ))}
        </div>
      )}

      {/* Submit link */}
      <div style={{ textAlign: 'center', padding: '16px 20px 24px' }}>
        <button onClick={() => go('submitCourse')} style={{ background: 'none', border: 'none', color: FT.orange, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: SF }}>
          Missing a course? Submit it →
        </button>
      </div>
    </div>
  )
}
