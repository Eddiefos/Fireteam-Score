import { useState } from 'react'
import { FT, SFR, MONO } from '../constants/colors'
import { ScreenShell } from '../components/layout/ScreenShell'
import {
  StatusBar, HomeIndicator, TopoBg,
  IconChevronLeft, IconCheck, IconPlus, EmptyState,
} from '../components/atoms'
import { useCourses } from '../hooks/useCourses'
import { useRounds } from '../hooks/useRounds'
import { totalPar } from '../lib/gameLogic'

function StartRoundScreen({ go, userId }) {
  const { courses, loading: coursesLoading } = useCourses(userId)
  const { startRound } = useRounds(userId)
  const [selectedCourseId, setSelectedCourseId] = useState(null)
  const [starting, setStarting] = useState(false)

  const selectedCourse = courses.find((c) => c.id === selectedCourseId)
  const canStart = !!selectedCourse && !starting

  const start = async () => {
    if (!canStart) return
    setStarting(true)
    try {
      await startRound(selectedCourseId)
      go('live')
    } catch (err) {
      setStarting(false)
    }
  }

  if (coursesLoading) {
    return (
      <ScreenShell label="Start Round">
        <StatusBar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: FT.orange, opacity: 0.8 }} />
        </div>
      </ScreenShell>
    )
  }

  return (
    <ScreenShell label="Start Round">
      <StatusBar />

      {/* Top bar */}
      <div style={{ padding: '6px 24px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <button onClick={() => go('home')} className="flat" style={{
          width: 36, height: 36, borderRadius: 12, background: FT.paper,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${FT.hair}`,
        }}>
          <IconChevronLeft />
        </button>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: FT.dim }}>PICK A COURSE</div>
        <div style={{ width: 36 }} />
      </div>

      <div className="ft-scroll">
        <div style={{ padding: '6px 24px 16px' }}>
          <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 34, letterSpacing: -1.2, lineHeight: 1 }}>
            Pick your<br/>course.
          </div>
        </div>

        {/* Courses */}
        {courses.length === 0 ? (
          <div style={{ padding: '0 20px' }}>
            <EmptyState icon="🌲" title="No courses yet"
              body="Add a course first — name and par for each hole."
              cta={
                <button onClick={() => go('newCourse')} className="flat" style={{
                  marginTop: 14, padding: '10px 16px', borderRadius: 12, border: 'none',
                  background: FT.orange, color: FT.ink,
                  fontFamily: SFR, fontWeight: 800, fontSize: 14,
                }}>+ Add a course</button>
              } />
          </div>
        ) : (
          <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {courses.map((c) => {
              const sel = c.id === selectedCourseId
              return (
                <button key={c.id} onClick={() => setSelectedCourseId(c.id)} className="flat" style={{
                  padding: '14px 16px', borderRadius: 18,
                  background: sel ? FT.forest : FT.paper,
                  color: sel ? FT.cream : FT.ink,
                  border: sel ? `2px solid ${FT.forest}` : `1px solid ${FT.hair}`,
                  display: 'flex', alignItems: 'center', gap: 14, position: 'relative', overflow: 'hidden',
                  textAlign: 'left',
                }}>
                  {sel && <TopoBg color="rgba(244,239,228,0.08)" />}
                  <div style={{
                    width: 46, height: 46, borderRadius: 14,
                    background: sel ? FT.orange : FT.forest,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: SFR, fontWeight: 900, fontSize: 14,
                    color: sel ? FT.ink : FT.cream, position: 'relative', zIndex: 1, flexShrink: 0,
                  }}>{c.pars.length}H</div>
                  <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
                    <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 17, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 1 }}>Par {totalPar(c.pars)}</div>
                  </div>
                  <div style={{
                    width: 22, height: 22, borderRadius: 11, position: 'relative', zIndex: 1, flexShrink: 0,
                    border: `2px solid ${sel ? FT.cream : 'rgba(42,31,23,0.3)'}`,
                    background: sel ? FT.cream : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {sel && <IconCheck color={FT.forest} />}
                  </div>
                </button>
              )
            })}
            <button onClick={() => go('newCourse')} className="flat" style={{
              padding: '12px 16px', borderRadius: 14, border: `1px dashed ${FT.hair}`,
              background: 'transparent', color: FT.dim,
              fontFamily: SFR, fontWeight: 700, fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}><IconPlus color={FT.dim} /> Add a new course</button>
          </div>
        )}

        <div style={{ height: 100 }} />
      </div>

      {/* Sticky CTA */}
      <div style={{ padding: '16px 20px 28px', flexShrink: 0,
        background: 'linear-gradient(to top, rgba(244,239,228,1) 60%, rgba(244,239,228,0))' }}>
        <button onClick={start} disabled={!canStart} style={{
          width: '100%', height: 60, borderRadius: 18, border: 'none',
          background: canStart ? FT.orange : 'rgba(42,31,23,0.15)',
          color: canStart ? FT.ink : FT.dim,
          fontFamily: SFR, fontWeight: 900, fontSize: 19, letterSpacing: -0.3,
          boxShadow: canStart ? '0 6px 0 rgba(0,0,0,0.22), 0 14px 24px rgba(255,107,31,0.35)' : 'none',
        }}>
          {starting ? 'Starting…' :
           canStart ? `Tee it up · ${selectedCourse.name}` :
           courses.length === 0 ? 'Add a course first' : 'Pick a course'}
        </button>
      </div>

      <HomeIndicator />
    </ScreenShell>
  )
}

export { StartRoundScreen }
