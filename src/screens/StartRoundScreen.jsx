import { useState, useCallback } from 'react'
import { FT, SFR, MONO, PLAYER_COLORS } from '../constants/colors'
import { ScreenShell } from '../components/layout/ScreenShell'
import {
  StatusBar, HomeIndicator, TopoBg,
  IconChevronLeft, IconCheck, IconPlus, EmptyState, Avatar,
} from '../components/atoms'
import { useCourses } from '../hooks/useCourses'
import { useOfficialCourses } from '../hooks/useOfficialCourses'
import { useRounds } from '../hooks/useRounds'
import { useProfile } from '../hooks/useProfile'
import { useFriends } from '../hooks/useFriends'
import { useFireteam } from '../hooks/useFireteam'
import { totalPar } from '../lib/gameLogic'

function StartRoundScreen({ go, userId, params = {} }) {
  const { courses, loading: coursesLoading } = useCourses(userId, true)
  const { startRound } = useRounds(userId)
  const { profile } = useProfile(userId)
  const { friends, loading: friendsLoading } = useFriends(userId)
  const { fireteam } = useFireteam(userId)
  const { courses: officialCourses } = useOfficialCourses()

  const [mode, setMode] = useState(() => params?.courseId ? 'ready' : 'pick')
  const [selectedCourseId, setSelectedCourseId] = useState(null)
  const [starting, setStarting] = useState(false)
  const [guestInput, setGuestInput] = useState('')
  const [showGuestInput, setShowGuestInput] = useState(false)

  const myPlayer = profile ? {
    roundPlayerId: 'me',
    userId,
    guestName: null,
    displayName: profile.display_name,
    initials: profile.initials,
    color: profile.avatar_color,
    isGuest: false,
  } : null

  const [addedPlayers, setAddedPlayers] = useState([])

  const allPlayers = myPlayer ? [myPlayer, ...addedPlayers] : addedPlayers
  const addedIds = new Set(addedPlayers.map((p) => p.userId).filter(Boolean))

  const addFriend = useCallback((friend) => {
    if (addedIds.has(friend.userId)) return
    setAddedPlayers((prev) => {
      const color = PLAYER_COLORS[(prev.length + (myPlayer ? 1 : 0)) % PLAYER_COLORS.length]
      return [...prev, {
        roundPlayerId: `friend-${friend.userId}`,
        userId: friend.userId,
        guestName: null,
        displayName: friend.displayName,
        initials: friend.initials,
        color,
        isGuest: false,
      }]
    })
  }, [addedIds, myPlayer])

  const removePlayer = useCallback((roundPlayerId) => {
    setAddedPlayers((prev) => prev.filter((p) => p.roundPlayerId !== roundPlayerId))
  }, [])

  const addGuest = () => {
    const name = guestInput.trim()
    if (!name) return
    const initials = name.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2)
    const color = PLAYER_COLORS[allPlayers.length % PLAYER_COLORS.length]
    setAddedPlayers((prev) => [...prev, {
      roundPlayerId: `guest-${Date.now()}`,
      userId: null,
      guestName: name,
      displayName: name,
      initials,
      color,
      isGuest: true,
    }])
    setGuestInput('')
    setShowGuestInput(false)
  }

  const preselectedCourse = params?.courseId ? officialCourses.find(c => c.id === params.courseId) ?? null : null
  const selectedCourse = mode === 'ready'
    ? preselectedCourse
    : courses.find((c) => c.id === selectedCourseId)
  const canStart = !!selectedCourse && !starting && !!myPlayer

  const start = async () => {
    if (!canStart) return
    setStarting(true)
    try {
      const players = allPlayers.map((p) => ({
        userId: p.userId ?? undefined,
        guestName: p.guestName ?? undefined,
        displayName: p.displayName,
        initials: p.initials,
        color: p.color,
        isGuest: p.isGuest,
      }))
      await startRound(selectedCourseId, players, fireteam?.id)
      go('live')
    } catch {
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

      <div style={{ padding: '6px 24px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <button onClick={() => go('home')} className="flat" style={{
          width: 36, height: 36, borderRadius: 12, background: FT.paper,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${FT.hair}`,
        }}>
          <IconChevronLeft />
        </button>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: FT.dim }}>START ROUND</div>
        <div style={{ width: 36 }} />
      </div>

      <div className="ft-scroll">
        {/* ─── PICK MODE: type selector tiles ─── */}
        {mode === 'pick' && (
          <div style={{ padding: '6px 24px 16px' }}>
            <div style={{ fontWeight: 600, fontSize: 32, letterSpacing: -1.0, lineHeight: 1.05, marginBottom: 20 }}>
              Pick your<br/>course.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Official tile */}
              <button
                onClick={() => go('officialCourses')}
                className="flat"
                style={{
                  background: FT.forest, borderRadius: 20, padding: '18px 18px',
                  position: 'relative', overflow: 'hidden', cursor: 'pointer',
                  border: 'none', textAlign: 'left', color: FT.cream, width: '100%',
                }}
              >
                <TopoBg color="rgba(244,239,228,0.06)" />
                <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 2, opacity: 0.55, textTransform: 'uppercase', marginBottom: 4, position: 'relative', zIndex: 1 }}>Browse</div>
                <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.4, paddingRight: 40, position: 'relative', zIndex: 1 }}>Official Courses</div>
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 3, paddingRight: 40, position: 'relative', zIndex: 1 }}>Norwegian courses with par data</div>
                <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: 16, background: FT.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: FT.ink, fontWeight: 700, zIndex: 1 }}>→</div>
              </button>

              {/* My Courses tile */}
              <button
                onClick={() => setMode('mine')}
                className="flat"
                style={{
                  background: FT.paper, border: `1px solid ${FT.hair}`, borderRadius: 20, padding: '18px 18px',
                  position: 'relative', overflow: 'hidden', cursor: 'pointer',
                  textAlign: 'left', color: FT.ink, width: '100%',
                }}
              >
                <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 2, opacity: 0.55, textTransform: 'uppercase', marginBottom: 4 }}>Your saved</div>
                <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.4, paddingRight: 40 }}>My Courses</div>
                <div style={{ fontSize: 12, opacity: 0.5, marginTop: 3, paddingRight: 40 }}>Custom courses you&#39;ve created</div>
                <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: 16, background: 'rgba(42,31,23,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: FT.dim, fontWeight: 700 }}>→</div>
              </button>
            </div>
          </div>
        )}

        {/* ─── MINE MODE: personal course list ─── */}
        {mode === 'mine' && (
          <>
            <div style={{ padding: '6px 24px 16px' }}>
              <button onClick={() => setMode('pick')} className="flat" style={{ background: 'none', border: 'none', color: FT.orange, fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: 0, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                ← Back
              </button>
              <div style={{ fontWeight: 600, fontSize: 32, letterSpacing: -1.0, lineHeight: 1.05 }}>
                My<br/>Courses.
              </div>
            </div>

            {courses.length === 0 ? (
              <div style={{ padding: '0 20px' }}>
                <EmptyState icon="🌲" title="No courses yet"
                  body="Add a course first — name and par for each hole."
                  cta={
                    <button onClick={() => go('newCourse', { returnTo: 'start' })} className="flat" style={{
                      marginTop: 14, padding: '10px 16px', borderRadius: 12, border: 'none',
                      background: FT.orange, color: FT.ink,
                      fontFamily: SFR, fontWeight: 600, fontSize: 14,
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
                        fontWeight: 600, fontSize: 13,
                        color: sel ? FT.ink : FT.cream, position: 'relative', zIndex: 1, flexShrink: 0,
                      }}>{c.pars.length}H</div>
                      <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 16, letterSpacing: -0.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2, fontWeight: 400 }}>Par {totalPar(c.pars)}</div>
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
                <button onClick={() => go('newCourse', { returnTo: 'start' })} className="flat" style={{
                  padding: '12px 16px', borderRadius: 14, border: `1px dashed ${FT.hair}`,
                  background: 'transparent', color: FT.dim,
                  fontFamily: SFR, fontWeight: 500, fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  <IconPlus size={14} /> Add course
                </button>
              </div>
            )}
          </>
        )}

        {/* ─── READY MODE: pre-selected official course ─── */}
        {mode === 'ready' && preselectedCourse && (
          <div style={{ padding: '6px 24px 16px' }}>
            <div style={{ fontWeight: 600, fontSize: 32, letterSpacing: -1.0, lineHeight: 1.05, marginBottom: 16 }}>
              Ready to<br/>play.
            </div>
            <div style={{
              background: FT.paper, border: `2px solid ${FT.forest}`, borderRadius: 18,
              padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
              position: 'relative', overflow: 'hidden',
            }}>
              <TopoBg color="rgba(31,61,43,0.04)" />
              <div style={{
                width: 46, height: 46, borderRadius: 14, background: FT.forest,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 600, fontSize: 13, color: FT.cream, flexShrink: 0, position: 'relative', zIndex: 1,
              }}>{preselectedCourse.holes}H</div>
              <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 16, letterSpacing: -0.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: FT.ink }}>{preselectedCourse.name}</div>
                <div style={{ fontSize: 12, color: FT.dim, marginTop: 2 }}>{preselectedCourse.location}</div>
              </div>
              <button
                onClick={() => go('start')}
                className="flat"
                style={{ fontSize: 11, color: FT.orange, background: 'none', border: 'none', cursor: 'pointer', position: 'relative', zIndex: 1, flexShrink: 0 }}
              >
                Change
              </button>
            </div>
          </div>
        )}

        {/* Players section */}
        {(mode === 'mine' || mode === 'ready') && (
          <div style={{ padding: '20px 20px 0' }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: FT.dim, marginBottom: 10 }}>PLAYING</div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {allPlayers.map((p, i) => (
                <div key={p.roundPlayerId} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: FT.paper, border: `1px solid ${FT.hair}`, borderRadius: 20,
                  padding: '5px 10px 5px 6px',
                }}>
                  <Avatar name={p.displayName} color={p.color} size={24} fontSize={9} />
                  <span style={{ fontWeight: 500, fontSize: 13, color: FT.ink }}>{p.displayName}</span>
                  {i > 0 && (
                    <button onClick={() => removePlayer(p.roundPlayerId)} className="flat" style={{
                      background: 'none', border: 'none', padding: 0, marginLeft: 2,
                      color: 'rgba(42,31,23,0.35)', fontSize: 13, lineHeight: 1, cursor: 'pointer',
                    }}>✕</button>
                  )}
                </div>
              ))}
            </div>

            {!friendsLoading && friends.length > 0 && (
              <>
                <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 2, color: FT.dim, marginBottom: 6 }}>FRIENDS</div>
                {friends.map((f) => {
                  const added = addedIds.has(f.userId)
                  return (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
                      <Avatar name={f.displayName} color={f.avatarColor} size={34} fontSize={11} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: 14, color: FT.ink }}>{f.displayName}</div>
                        <div style={{ fontSize: 11, color: FT.dim, fontWeight: 400 }}>@{f.username}</div>
                      </div>
                      <button
                        onClick={() => added ? removePlayer(`friend-${f.userId}`) : addFriend(f)}
                        className="flat"
                        style={{
                          width: 30, height: 30, borderRadius: 9, border: 'none',
                          background: added ? 'rgba(31,61,43,0.1)' : 'rgba(255,107,31,0.12)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: added ? 14 : 18, color: added ? FT.forest : FT.orange, fontWeight: 700,
                        }}>
                        {added ? '✓' : '+'}
                      </button>
                    </div>
                  )
                })}
              </>
            )}

            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${FT.hair}` }}>
              {showGuestInput ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    autoFocus
                    value={guestInput}
                    onChange={(e) => setGuestInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addGuest()}
                    placeholder="Guest name…"
                    style={{
                      flex: 1, padding: '10px 14px', borderRadius: 12,
                      border: `1.5px solid ${FT.hair}`, background: FT.paper,
                      fontFamily: SFR, fontSize: 15, color: FT.ink, outline: 'none',
                    }}
                  />
                  <button onClick={addGuest} className="flat" style={{
                    height: 40, padding: '0 14px', borderRadius: 12, border: 'none',
                    background: FT.forest, color: FT.cream, fontFamily: SFR, fontWeight: 600, fontSize: 13,
                  }}>Add</button>
                  <button onClick={() => setShowGuestInput(false)} className="flat" style={{
                    height: 40, padding: '0 10px', borderRadius: 12, border: 'none',
                    background: 'rgba(42,31,23,0.08)', color: FT.dim, fontFamily: SFR, fontWeight: 500, fontSize: 13,
                  }}>✕</button>
                </div>
              ) : (
                <button onClick={() => setShowGuestInput(true)} className="flat" style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0',
                  background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                    border: `1.5px dashed rgba(42,31,23,0.25)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, color: 'rgba(42,31,23,0.3)',
                  }}>+</div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14, color: 'rgba(42,31,23,0.5)' }}>Add guest player</div>
                    <div style={{ fontSize: 11, color: FT.dim, fontWeight: 400 }}>No account needed</div>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        <div style={{ height: 100 }} />
      </div>

      {mode !== 'pick' && (
        <div style={{ padding: '10px 20px', paddingBottom: 'max(20px, env(safe-area-inset-bottom))', flexShrink: 0, borderTop: `1px solid ${FT.hair}` }}>
          <button
            onClick={start}
            disabled={!canStart}
            className="flat"
            style={{
              width: '100%', padding: '16px', borderRadius: 18, border: 'none',
              background: canStart ? FT.forest : 'rgba(42,31,23,0.1)',
              color: canStart ? FT.cream : FT.dim,
              fontFamily: SFR, fontWeight: 600, fontSize: 16, letterSpacing: -0.2,
            }}>
            {starting ? 'Starting…' : `Start Round${allPlayers.length > 1 ? ` · ${allPlayers.length} players` : ''} →`}
          </button>
        </div>
      )}

      <HomeIndicator />
    </ScreenShell>
  )
}

export { StartRoundScreen }
