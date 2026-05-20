import { useState, useMemo } from 'react'
import { FT, SFR, SF, MONO, PLAYER_COLORS } from '../constants/colors'
import { ScreenShell } from '../components/layout/ScreenShell'
import { StatusBar, HomeIndicator, ParChip, Avatar, TopoBg, EmptyState, IconChevronRight, IconChevronLeft } from '../components/atoms'
import { useProfile } from '../hooks/useProfile'
import { usePlayerRounds } from '../hooks/usePlayerRounds'
import { computePlayerStats, playerTotal, playerVsPar, formatShortDate } from '../lib/gameLogic'
import { hashCode } from '../lib/uid'

function StatsScreen({ go, userId }) {
  const { profile, loading: profileLoading } = useProfile(userId)
  const { rounds, loading: roundsLoading } = usePlayerRounds(userId)
  const [filter, setFilter] = useState('all') // 'all' | 'wins' | 'losses'

  const loading = profileLoading || roundsLoading

  const user = profile?.display_name ?? ''

  const completed = useMemo(() =>
    [...rounds].filter((r) => r.finished_at).sort((a, b) =>
      new Date(b.finished_at).getTime() - new Date(a.finished_at).getTime()
    ),
  [rounds])

  const stats = useMemo(() => {
    if (!profile) return null
    return computePlayerStats(rounds, user)
  }, [rounds, profile, user])

  const myRounds = useMemo(() => {
    if (!user) return []
    return completed
      .filter((r) => r.players?.some((p) => p.displayName === user))
      .map((r) => {
        const me = r.players.find((p) => p.displayName === user)
        const myScore = playerTotal(r, me.id)
        const myVs = playerVsPar(r, me.id)
        let strictlyBest = true
        for (const p of r.players) {
          if (p.id === me.id) continue
          if (playerTotal(r, p.id) <= myScore) strictlyBest = false
        }
        return { round: r, vs: myVs, win: strictlyBest }
      })
  }, [completed, user])

  const filtered = useMemo(() => {
    if (filter === 'all') return myRounds
    if (filter === 'wins') return myRounds.filter((m) => m.win)
    return myRounds.filter((m) => !m.win)
  }, [myRounds, filter])

  const noUser = !user
  const noRounds = completed.length === 0

  if (loading) {
    return (
      <ScreenShell label="Stats">
        <StatusBar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: FT.orange, opacity: 0.8 }} />
        </div>
      </ScreenShell>
    )
  }

  return (
    <ScreenShell label="Stats">
      <StatusBar />

      {/* Inlined TopBar */}
      <div style={{ padding: '6px 24px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <button onClick={() => go('home')} className="flat" style={{ width: 36, height: 36, borderRadius: 12, background: FT.paper, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${FT.hair}` }}>
          <IconChevronLeft />
        </button>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: FT.dim }}>HISTORY</div>
        <div style={{ width: 36 }} />
      </div>

      <div className="ft-scroll">
        <div style={{ padding: '4px 22px 12px' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 2.5, color: FT.dim, textTransform: 'uppercase' }}>Your stats</div>
          <div style={{ fontWeight: 600, fontSize: 34, letterSpacing: -1.0, lineHeight: 1, marginTop: 4 }}>
            {noUser ? 'Set your name.' : `The book on ${user.split(' ')[0]}.`}
          </div>
        </div>

        {noUser ? (
          <div style={{ padding: '0 16px' }}>
            <EmptyState icon="🪪" title="Tell us your name"
              body="Stats track rounds where you're playing — set your name to see them."
              cta={
                <button onClick={() => go('settings')} className="flat" style={{
                  marginTop: 14, padding: '10px 16px', borderRadius: 12, border: 'none',
                  background: FT.orange, color: FT.ink,
                  fontFamily: SFR, fontWeight: 600, fontSize: 14,
                }}>Set name</button>
              } />
          </div>
        ) : noRounds ? (
          <div style={{ padding: '0 16px' }}>
            <EmptyState icon="🎯" title="No rounds yet"
              body="Stats show up once you've finished a round."
              cta={
                <button onClick={() => go('start')} className="flat" style={{
                  marginTop: 14, padding: '10px 16px', borderRadius: 12, border: 'none',
                  background: FT.orange, color: FT.ink,
                  fontFamily: SFR, fontWeight: 600, fontSize: 14,
                }}>Start a round</button>
              } />
          </div>
        ) : (
          <>
            {/* Headline stats */}
            <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 8 }}>
              <div style={{ background: FT.forest, color: FT.cream, borderRadius: 18, padding: '14px 14px', position: 'relative', overflow: 'hidden' }}>
                <TopoBg color="rgba(244,239,228,0.08)" />
                <div style={{ position: 'relative' }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1.5, opacity: 0.6 }}>AVG vs PAR</div>
                  <div style={{ fontWeight: 700, fontSize: 40, letterSpacing: -2, lineHeight: 0.95, marginTop: 4 }}>
                    {stats.totalRounds === 0 ? '–' :
                     stats.avgVs === 0 ? 'E' :
                     stats.avgVs > 0 ? `+${stats.avgVs.toFixed(1)}` : stats.avgVs.toFixed(1)}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                    {stats.totalRounds} {stats.totalRounds === 1 ? 'round' : 'rounds'}
                  </div>
                </div>
              </div>
              <div style={{ background: FT.paper, borderRadius: 18, padding: '14px 14px', border: `1px solid ${FT.hair}` }}>
                <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1.5, color: FT.dim }}>BIRDIES</div>
                <div style={{ fontWeight: 700, fontSize: 30, letterSpacing: -1, lineHeight: 1, marginTop: 4, color: FT.orange }}>{stats.birdies}</div>
                <div style={{ fontSize: 11, color: FT.dim, marginTop: 4, fontWeight: 400 }}>career</div>
              </div>
              <div style={{ background: FT.paper, borderRadius: 18, padding: '14px 14px', border: `1px solid ${FT.hair}` }}>
                <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1.5, color: FT.dim }}>WIN %</div>
                <div style={{ fontWeight: 700, fontSize: 30, letterSpacing: -1, lineHeight: 1, marginTop: 4 }}>{stats.winPct}</div>
                <div style={{ fontSize: 11, color: FT.dim, marginTop: 4, fontWeight: 400 }}>{stats.wins} of {stats.totalRounds}</div>
              </div>
            </div>

            {/* Per-course averages */}
            {stats.perCourse.length > 0 && (
              <>
                <div style={{ padding: '20px 22px 8px' }}>
                  <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: FT.dim, textTransform: 'uppercase' }}>By course</div>
                </div>
                <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {stats.perCourse.map((c) => (
                    <div key={c.courseName} style={{
                      background: FT.paper, borderRadius: 14, padding: '10px 14px',
                      border: `1px solid ${FT.hair}`,
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: FT.ink }}>{c.courseName}</div>
                        <div style={{ fontSize: 10, color: FT.dim, marginTop: 2, fontFamily: MONO, letterSpacing: 0.5 }}>
                          {c.rounds} {c.rounds === 1 ? 'ROUND' : 'ROUNDS'} · BEST {c.best}
                        </div>
                      </div>
                      <ParChip value={Math.round(c.avgVs * 10) / 10} size="md" />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Head to head */}
            {stats.h2h.length > 0 && (
              <>
                <div style={{ padding: '20px 22px 8px' }}>
                  <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: FT.dim, textTransform: 'uppercase' }}>Head to head</div>
                </div>
                <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {stats.h2h.sort((a, b) => (b.w + b.l + b.t) - (a.w + a.l + a.t)).map((p) => {
                    const total = p.w + p.l + p.t
                    const pct = total > 0 ? (p.w / total) * 100 : 0
                    const lossPct = total > 0 ? (p.l / total) * 100 : 0
                    return (
                      <div key={p.name} style={{
                        background: FT.paper, borderRadius: 14, padding: '10px 12px',
                        border: `1px solid ${FT.hair}`,
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}>
                        <Avatar name={p.name} color={PLAYER_COLORS[Math.abs(hashCode(p.name)) % PLAYER_COLORS.length]} size={36} fontSize={12} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 500, fontSize: 14, color: FT.ink }}>vs {p.name}</span>
                            <span style={{ fontWeight: 600, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                              <span style={{ color: FT.forest }}>{p.w}</span>
                              <span style={{ color: FT.dim, margin: '0 4px' }}>—</span>
                              <span style={{ color: FT.bark }}>{p.l}</span>
                              {p.t > 0 && <span style={{ color: FT.dim, marginLeft: 6, fontSize: 12 }}>({p.t}T)</span>}
                            </span>
                          </div>
                          <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 6, background: 'rgba(42,31,23,0.08)' }}>
                            <div style={{ width: `${pct}%`, background: FT.forest }} />
                            <div style={{ width: `${lossPct}%`, background: FT.bark, opacity: 0.3 }} />
                          </div>
                        </div>
                        <div style={{
                          width: 22, height: 22, borderRadius: 11,
                          background: p.last === 'W' ? FT.orange : p.last === 'L' ? 'rgba(42,31,23,0.1)' : 'rgba(42,31,23,0.06)',
                          color: p.last === 'W' ? FT.ink : FT.dim,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 600, fontSize: 11, flexShrink: 0,
                        }}>{p.last}</div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Past rounds with filter */}
            <div style={{ padding: '20px 22px 8px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: FT.dim, textTransform: 'uppercase' }}>Past rounds</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'wins', label: 'Wins' },
                  { key: 'losses', label: 'Losses' },
                ].map((f) => (
                  <button key={f.key} onClick={() => setFilter(f.key)} className="flat" style={{
                    padding: '4px 10px', borderRadius: 999, border: 'none',
                    background: filter === f.key ? FT.ink : 'rgba(42,31,23,0.07)',
                    color: filter === f.key ? FT.cream : FT.ink,
                    fontFamily: SFR, fontWeight: 500, fontSize: 11,
                  }}>{f.label}</button>
                ))}
              </div>
            </div>
            <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.length === 0 ? (
                <div style={{ padding: 14, textAlign: 'center', color: FT.dim, fontSize: 13 }}>
                  No rounds matching that filter.
                </div>
              ) : filtered.map(({ round: r, vs, win }) => (
                <button key={r.id} onClick={() => go('round', { roundId: r.id })} className="flat" style={{
                  display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                  background: FT.paper, borderRadius: 12, padding: '10px 12px',
                  border: `1px solid ${FT.hair}`, width: '100%',
                }}>
                  <div style={{
                    width: 6, alignSelf: 'stretch', borderRadius: 3,
                    background: win ? FT.orange : 'rgba(42,31,23,0.2)',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: FT.ink }}>{r.course_name}</div>
                    <div style={{ fontSize: 11, color: FT.dim, marginTop: 2, fontFamily: MONO, letterSpacing: 0.5 }}>
                      {formatShortDate(new Date(r.finished_at).getTime()).toUpperCase()} · {r.players.length} PLAYERS
                    </div>
                  </div>
                  <ParChip value={vs} size="md" />
                  <IconChevronRight />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <HomeIndicator />
    </ScreenShell>
  )
}

export { StatsScreen }
