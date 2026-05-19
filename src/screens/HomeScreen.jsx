import { useMemo } from 'react'
import { FT, SFR, MONO, PLAYER_COLORS } from '../constants/colors'
import { ScreenShell } from '../components/layout/ScreenShell'
import { StatusBar, HomeIndicator, TopoBg, ParChip, Avatar, IconArrow, EmptyState } from '../components/atoms'
import { useProfile } from '../hooks/useProfile'
import { useRounds } from '../hooks/useRounds'
import { useCourses } from '../hooks/useCourses'
import { formatDate } from '../lib/gameLogic'

function HomeScreen({ go, userId }) {
  const { profile, loading: profileLoading } = useProfile(userId)
  const { rounds, activeRound, loading: roundsLoading } = useRounds(userId)
  const { courses } = useCourses(userId)

  const loading = profileLoading || roundsLoading

  const user = profile?.display_name ?? ''

  // completed rounds, sorted newest first
  const completed = useMemo(() =>
    [...rounds].filter((r) => r.finished_at)
      .sort((a, b) => new Date(b.finished_at).getTime() - new Date(a.finished_at).getTime()),
  [rounds])
  const recent = completed.slice(0, 4)

  // simplified fireteam bar — just the current user until Fireteams
  const fireteam = useMemo(() => {
    if (!profile) return []
    return [{ name: profile.display_name, color: profile.avatar_color || FT.orange }]
  }, [profile])

  const namePrompt = !profile?.display_name

  // For resume card
  const activeCourse = activeRound ? courses.find((c) => c.id === activeRound.course_id) : null

  if (loading) {
    return (
      <ScreenShell label="Home" bg={FT.cream}>
        <StatusBar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: FT.orange, opacity: 0.8 }} />
        </div>
      </ScreenShell>
    )
  }

  return (
    <ScreenShell label="Home" bg={FT.cream}>
      <StatusBar />
      <div className="ft-scroll">
        {/* Hero block */}
        <div style={{ padding: '8px 24px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: FT.dim, textTransform: 'uppercase' }}>
                Fireteam · {fireteam.length || 0} {fireteam.length === 1 ? 'member' : 'members'}
              </div>
              <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 38, lineHeight: 0.95, marginTop: 6, letterSpacing: -1.5 }}>
                Hey,<br/>{user || 'friend'} 👋
              </div>
            </div>
            {fireteam.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {fireteam.map((p, i) => (
                  <div key={p.name} style={{ marginLeft: i ? -8 : 0 }}>
                    <Avatar name={p.name} color={p.color || PLAYER_COLORS[i % PLAYER_COLORS.length]}
                      size={32} fontSize={11} border={`2px solid ${FT.cream}`} />
                  </div>
                ))}
              </div>
            )}
          </div>
          {namePrompt && (
            <button onClick={() => go('settings')} className="flat" style={{
              marginTop: 12, padding: '8px 12px', borderRadius: 10, border: 'none',
              background: 'rgba(255,107,31,0.14)', color: FT.bark,
              fontFamily: SFR, fontWeight: 700, fontSize: 13,
            }}>Tap to set your name →</button>
          )}
        </div>

        {/* Resume in-progress round, if any */}
        {activeRound && activeRound.status === 'active' && (
          <div style={{ padding: '0 20px 12px' }}>
            <button onClick={() => go('live')} className="flat" style={{
              width: '100%', textAlign: 'left', border: 'none',
              background: FT.bark, color: FT.cream, padding: '14px 16px', borderRadius: 16,
              display: 'flex', alignItems: 'center', gap: 12,
              boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, background: FT.orange,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><IconArrow color={FT.ink} size={18} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, opacity: 0.6 }}>RESUME · {activeCourse?.name || 'Course'}</div>
                <div style={{ fontFamily: SFR, fontWeight: 800, fontSize: 16, marginTop: 2 }}>
                  Hole {Math.min(activeCourse?.holes || 18, (activeRound.holes_played || 0) + 1)} of {activeCourse?.holes || '?'}
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Big start CTA */}
        <div style={{ padding: '0 20px' }}>
          <button onClick={() => go('start')} className="flat" style={{
            width: '100%', position: 'relative', overflow: 'hidden',
            background: FT.forest, color: FT.cream, border: 'none',
            borderRadius: 24, padding: '24px 22px', textAlign: 'left',
            boxShadow: '0 12px 28px rgba(31,61,43,0.32), inset 0 -4px 0 rgba(0,0,0,0.18)',
          }}>
            <TopoBg color="rgba(244,239,228,0.09)" />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, opacity: 0.7, textTransform: 'uppercase' }}>Tap to begin</div>
                <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 32, lineHeight: 1, letterSpacing: -1, marginTop: 4 }}>
                  Start New Round
                </div>
              </div>
              <div style={{
                width: 56, height: 56, borderRadius: 28, background: FT.orange,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 6px 0 rgba(0,0,0,0.25)',
              }}><IconArrow /></div>
            </div>
          </button>
        </div>

        {/* Quick nav tiles */}
        <div style={{ padding: '14px 20px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button onClick={() => go('stats')} className="flat" style={{
            background: FT.paper, borderRadius: 18, padding: '14px 16px',
            border: `1px solid ${FT.hair}`, textAlign: 'left',
          }}>
            <div style={{ fontSize: 22, lineHeight: 1, marginBottom: 8 }}>📋</div>
            <div style={{ fontFamily: SFR, fontWeight: 800, fontSize: 17 }}>History</div>
            <div style={{ fontSize: 12, color: FT.dim, marginTop: 1 }}>{completed.length} {completed.length === 1 ? 'round' : 'rounds'}</div>
          </button>
          <button onClick={() => go('courses')} className="flat" style={{
            background: FT.paper, borderRadius: 18, padding: '14px 16px',
            border: `1px solid ${FT.hair}`, textAlign: 'left',
          }}>
            <div style={{ fontSize: 22, lineHeight: 1, marginBottom: 8 }}>🌲</div>
            <div style={{ fontFamily: SFR, fontWeight: 800, fontSize: 17 }}>Courses</div>
            <div style={{ fontSize: 12, color: FT.dim, marginTop: 1 }}>{courses.length} saved</div>
          </button>
        </div>

        {/* Recent rounds */}
        <div style={{ padding: '22px 20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: FT.dim, textTransform: 'uppercase' }}>Recent rounds</div>
            {completed.length > recent.length && (
              <button onClick={() => go('stats')} className="flat" style={{ background: 'none', border: 'none', fontSize: 13, color: FT.orange, fontWeight: 700, padding: 0 }}>See all</button>
            )}
          </div>
          {recent.length === 0 ? (
            <EmptyState icon="🥏" title="No rounds yet"
              body={'Tap “Start New Round” above to log your first round.'} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recent.map((r) => {
                const courseName = courses.find((c) => c.id === r.course_id)?.name || 'Course'
                return (
                  <button key={r.id} onClick={() => go('round', { roundId: r.id })} className="flat" style={{
                    display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
                    background: FT.paper, borderRadius: 14, padding: '12px 14px',
                    border: `1px solid ${FT.hair}`, width: '100%',
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, background: FT.forest,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: SFR, fontWeight: 900, color: FT.cream, fontSize: 13,
                    }}>{r.holes_played || '?'}H</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 16, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{courseName}</div>
                      <div style={{ fontSize: 12, color: FT.dim, marginTop: 1 }}>
                        {formatDate(new Date(r.finished_at).getTime())}
                      </div>
                    </div>
                    {/* ParChip removed — no vs-par data without scores */}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
      <HomeIndicator />
    </ScreenShell>
  )
}

export { HomeScreen }
