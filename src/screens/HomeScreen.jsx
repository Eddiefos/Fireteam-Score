import { useMemo } from 'react'
import { FT, SFR, MONO, PLAYER_COLORS } from '../constants/colors'
import { ScreenShell } from '../components/layout/ScreenShell'
import { StatusBar, HomeIndicator, TopoBg, ParChip, Avatar, IconArrow, EmptyState } from '../components/atoms'
import { useProfile } from '../hooks/useProfile'
import { useRounds } from '../hooks/useRounds'
import { usePlayerRounds } from '../hooks/usePlayerRounds'
import { useCourses } from '../hooks/useCourses'
import { useRoundPlayers } from '../hooks/useRoundPlayers'
import { useFireteam } from '../hooks/useFireteam'
import { formatDate, playerVsPar } from '../lib/gameLogic'

function HomeScreen({ go, userId }) {
  const { profile, loading: profileLoading } = useProfile(userId)
  const { rounds, activeRound, loading: roundsLoading } = useRounds(userId)
  const { courses } = useCourses(userId)
  const myCourseCount = courses.filter((c) => c.created_by === userId).length
  const { players: activePlayers } = useRoundPlayers(activeRound?.id)
  const { members: fireteamMembers } = useFireteam(userId)
  const { rounds: playerRounds } = usePlayerRounds(userId)

  const loading = profileLoading || roundsLoading

  // vs-par for the current user per finished round
  const vsByRound = useMemo(() => {
    const map = {}
    for (const r of playerRounds) {
      const me = r.players.find((p) => p.userId === userId)
      if (me) map[r.id] = playerVsPar(r, me.id)
    }
    return map
  }, [playerRounds, userId])

  const user = profile?.display_name ?? ''

  // completed rounds, sorted newest first
  const completed = useMemo(() =>
    [...rounds].filter((r) => r.finished_at)
      .sort((a, b) => new Date(b.finished_at).getTime() - new Date(a.finished_at).getTime()),
  [rounds])
  const recent = completed.slice(0, 4)

  const fireteam = useMemo(() => {
    if (fireteamMembers.length > 0)
      return fireteamMembers.map((m) => ({ name: m.display_name, color: m.avatar_color }))
    if (!profile) return []
    return [{ name: profile.display_name, color: profile.avatar_color || FT.orange }]
  }, [fireteamMembers, profile])

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
        <div style={{ padding: '20px 24px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 300, fontSize: 15, color: FT.dim, letterSpacing: 0.1, marginBottom: 2 }}>
                Good to see you,
              </div>
              <div style={{ fontWeight: 600, fontSize: 34, lineHeight: 1.05, letterSpacing: -1.0, color: FT.ink }}>
                {user || 'friend'} 👋
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
              fontFamily: SFR, fontWeight: 600, fontSize: 13,
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
                <div style={{ fontWeight: 600, fontSize: 16, marginTop: 2 }}>
                  Hole {Math.min(activeCourse?.holes || 18, (activeRound.holes_played || 0) + 1)} of {activeCourse?.holes || '?'}
                </div>
                {activePlayers.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
                    {activePlayers.slice(0, 4).map((p, i) => (
                      <div key={p.id} style={{ marginLeft: i ? -6 : 0 }}>
                        <Avatar name={p.displayName} color={p.color} size={20} fontSize={7} border={`1.5px solid ${FT.bark}`} />
                      </div>
                    ))}
                    {activePlayers.length > 4 && (
                      <div style={{ marginLeft: 4, fontSize: 10, color: 'rgba(244,239,228,0.5)', fontFamily: MONO }}>+{activePlayers.length - 4}</div>
                    )}
                  </div>
                )}
              </div>
            </button>
          </div>
        )}

        {/* Big start CTA */}
        <div style={{ padding: '0 20px' }}>
          <button onClick={() => go('start')} className="flat" style={{
            width: '100%', position: 'relative', overflow: 'hidden',
            background: FT.forest, color: FT.cream, border: 'none',
            borderRadius: 22, padding: '20px 22px', textAlign: 'left',
            boxShadow: '0 8px 20px rgba(31,61,43,0.26), inset 0 -3px 0 rgba(0,0,0,0.14)',
          }}>
            <TopoBg color="rgba(244,239,228,0.07)" />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 2.5, opacity: 0.55, marginBottom: 5 }}>TAP TO BEGIN</div>
                <div style={{ fontWeight: 600, fontSize: 26, lineHeight: 1.05, letterSpacing: -0.6 }}>
                  Start New Round
                </div>
              </div>
              <div style={{
                width: 48, height: 48, borderRadius: 24, background: FT.orange, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 0 rgba(0,0,0,0.2)',
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
            <div style={{ fontSize: 20, lineHeight: 1, marginBottom: 8 }}>📋</div>
            <div style={{ fontWeight: 600, fontSize: 15, color: FT.ink }}>History</div>
            <div style={{ fontSize: 12, color: FT.dim, marginTop: 2, fontWeight: 400 }}>{completed.length} {completed.length === 1 ? 'round' : 'rounds'}</div>
          </button>
          <button onClick={() => go('courses')} className="flat" style={{
            background: FT.paper, borderRadius: 16, padding: '14px 16px',
            border: `1px solid ${FT.hair}`, textAlign: 'left',
          }}>
            <div style={{ fontSize: 20, lineHeight: 1, marginBottom: 8 }}>🌲</div>
            <div style={{ fontWeight: 600, fontSize: 15, color: FT.ink }}>Courses</div>
            <div style={{ fontSize: 12, color: FT.dim, marginTop: 2, fontWeight: 400 }}>{myCourseCount} saved</div>
          </button>
        </div>

        {/* Recent rounds */}
        <div style={{ padding: '22px 20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: FT.dim, textTransform: 'uppercase' }}>Recent rounds</div>
            {completed.length > recent.length && (
              <button onClick={() => go('stats')} className="flat" style={{ background: 'none', border: 'none', fontSize: 13, color: FT.orange, fontWeight: 500, padding: 0 }}>See all</button>
            )}
          </div>
          {recent.length === 0 ? (
            <EmptyState icon="🥏" title="No rounds yet"
              body={'Tap “Start New Round” above to log your first round.'} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recent.map((r) => {
                const courseName = r.course_id === null ? 'Deleted course' : courses.find((c) => c.id === r.course_id)?.name || 'Course'
                return (
                  <button key={r.id} onClick={() => go('round', { roundId: r.id })} className="flat" style={{
                    display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
                    background: FT.paper, borderRadius: 14, padding: '12px 14px',
                    border: `1px solid ${FT.hair}`, width: '100%',
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 11, background: FT.forest, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 600, color: FT.cream, fontSize: 12,
                    }}>{r.holes_played || '?'}H</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 14, letterSpacing: -0.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: FT.ink }}>{courseName}</div>
                      <div style={{ fontSize: 11, color: FT.dim, marginTop: 2, fontWeight: 400 }}>
                        {formatDate(new Date(r.finished_at).getTime())}
                      </div>
                    </div>
                    {typeof vsByRound[r.id] === 'number' && (
                      <ParChip value={vsByRound[r.id]} size="sm" />
                    )}
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
