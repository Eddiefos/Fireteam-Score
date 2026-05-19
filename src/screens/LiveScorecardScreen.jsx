import { useState, useEffect, useMemo } from 'react'
import { FT, SF, SFR, MONO } from '../constants/colors'
import { ScreenShell } from '../components/layout/ScreenShell'
import {
  StatusBar, HomeIndicator, TopoBg, ParChip, Avatar,
  IconHamburger,
} from '../components/atoms'
import { useRounds } from '../hooks/useRounds'
import { useScores } from '../hooks/useScores'
import { useProfile } from '../hooks/useProfile'
import { useCourses } from '../hooks/useCourses'
import { playerTotal, playerVsPar, liveTimer } from '../lib/gameLogic'

function Modal({ open, title, body, confirmLabel = 'OK', cancelLabel = 'Cancel', onConfirm, onCancel, danger = false }) {
  if (!open) return null
  return (
    <div onClick={onCancel} style={{
      position: 'absolute', inset: 0, background: 'rgba(21,17,13,0.45)',
      zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, animation: 'fadeIn 160ms ease-out',
    }}>
      <div onClick={(e) => e.stopPropagation()} className="pop-in" style={{
        background: FT.cream, borderRadius: 20, padding: 22,
        width: '100%', maxWidth: 340,
      }}>
        <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 19, letterSpacing: -0.4 }}>{title}</div>
        {body && <div style={{ fontSize: 14, color: FT.dim, marginTop: 8, lineHeight: 1.45 }}>{body}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={onCancel} style={{
            flex: 1, height: 44, borderRadius: 12, border: 'none',
            background: 'rgba(42,31,23,0.08)', color: FT.ink,
            fontFamily: SFR, fontWeight: 800, fontSize: 15,
          }}>{cancelLabel}</button>
          <button onClick={onConfirm} style={{
            flex: 1, height: 44, borderRadius: 12, border: 'none',
            background: danger ? FT.bark : FT.forest, color: FT.cream,
            fontFamily: SFR, fontWeight: 800, fontSize: 15,
          }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

function LiveScorecardScreen({ go, userId }) {
  const { activeRound, loading: roundsLoading, finishRound } = useRounds(userId)
  const { scores, submitScore } = useScores(activeRound?.id)
  const { profile, loading: profileLoading } = useProfile(userId)
  const { courses, loading: coursesLoading } = useCourses(userId)

  useEffect(() => {
    if (!roundsLoading && !activeRound) go('home')
  }, [roundsLoading, activeRound])

  const anyLoading = roundsLoading || profileLoading || coursesLoading
  const course = courses.find((c) => c.id === activeRound?.course_id)
  const pars = course?.pars ?? []

  const round = useMemo(() => {
    if (!activeRound || !profile || !pars.length) return null
    const players = [{ id: userId, name: profile.display_name, color: profile.avatar_color }]
    const scoreMap = {}
    for (const p of players) {
      scoreMap[p.id] = Array(pars.length).fill(null)
    }
    for (const s of scores) {
      if (scoreMap[s.user_id]) {
        scoreMap[s.user_id][s.hole_number - 1] = s.strokes
      }
    }
    return {
      id: activeRound.id,
      courseName: course?.name ?? '',
      startedAt: new Date(activeRound.started_at).getTime(),
      pars,
      players,
      scores: scoreMap,
    }
  }, [activeRound, profile, courses, scores, userId])

  if (anyLoading || !round) {
    return (
      <ScreenShell bg={FT.forest} dark>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: FT.orange, opacity: 0.8 }} />
        </div>
      </ScreenShell>
    )
  }

  const handleFinish = async () => {
    await finishRound(activeRound.id)
    go('round', { roundId: activeRound.id, justFinished: true })
  }

  const handleQuit = () => go('home')

  return (
    <LiveScorecardImpl
      key={activeRound.id}
      go={go}
      round={round}
      onSubmitScore={submitScore}
      onFinish={handleFinish}
      onQuit={handleQuit}
    />
  )
}

function LiveScorecardImpl({ go, round: r, onSubmitScore, onFinish, onQuit }) {
  const [hole, setHole] = useState(() => {
    const ids = r.players.map((p) => p.id)
    for (let i = 0; i < r.pars.length; i++) {
      if (!ids.every((pid) => typeof (r.scores[pid] || [])[i] === 'number')) return i
    }
    return r.pars.length - 1
  })
  const [range, setRange] = useState('low')
  const [showQuit, setShowQuit] = useState(false)
  const [localClears, setLocalClears] = useState(new Set())

  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const N = r.pars.length
  const par = r.pars[hole]

  const effectiveScores = useMemo(() => {
    const copy = {}
    for (const playerId of Object.keys(r.scores)) {
      copy[playerId] = r.scores[playerId].map((s, idx) =>
        localClears.has(`${playerId}:${idx + 1}`) ? null : s
      )
    }
    return copy
  }, [r.scores, localClears])

  const activePlayer = useMemo(() => {
    for (const p of r.players) {
      if (typeof (effectiveScores[p.id] || [])[hole] !== 'number') return p
    }
    return null
  }, [effectiveScores, hole, r.players])

  const setScore = (playerId, holeIdx, value) => {
    if (value === null) {
      setLocalClears((prev) => new Set([...prev, `${playerId}:${holeIdx + 1}`]))
    } else {
      setLocalClears((prev) => {
        const next = new Set(prev)
        next.delete(`${playerId}:${holeIdx + 1}`)
        return next
      })
      onSubmitScore(playerId, holeIdx + 1, value)
    }
  }

  const tapStroke = (n) => {
    if (!activePlayer) return
    setScore(activePlayer.id, hole, n)
    const ids = r.players.map((p) => p.id)
    const scoresAfter = ids.map((id) => id === activePlayer.id ? n : effectiveScores[id]?.[hole])
    const allScored = scoresAfter.every((s) => typeof s === 'number')
    if (allScored) {
      if (hole < N - 1) {
        setTimeout(() => setHole(hole + 1), 220)
      } else {
        setTimeout(() => onFinish(), 280)
      }
    }
  }

  const undoLast = () => {
    const ids = r.players.map((p) => p.id).reverse()
    for (let h = hole; h >= 0; h--) {
      for (const id of ids) {
        if (typeof effectiveScores[id][h] === 'number') {
          setScore(id, h, null)
          if (h < hole) setHole(h)
          return
        }
      }
    }
  }

  const quit = () => {
    setShowQuit(false)
    onQuit()
  }

  const nums = range === 'low' ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12]

  return (
    <ScreenShell label="Live" bg={FT.forest} dark>
      <TopoBg color="rgba(244,239,228,0.06)" />
      <StatusBar dark />

      {/* Header strip */}
      <div style={{ padding: '4px 22px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1, flexShrink: 0 }}>
        <button onClick={() => setShowQuit(true)} className="flat" style={{
          width: 36, height: 36, borderRadius: 12, border: 'none',
          background: 'rgba(244,239,228,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><IconHamburger /></button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, opacity: 0.55, textTransform: 'uppercase', color: FT.cream, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{r.courseName}</div>
          <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 13, marginTop: 1, color: FT.cream }}>
            <span style={{ color: FT.orange }}>● </span>LIVE · {liveTimer(r.startedAt)}
          </div>
        </div>
        <button onClick={() => go('home')} className="flat" style={{
          width: 36, height: 36, borderRadius: 12, border: 'none',
          background: 'rgba(244,239,228,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: FT.cream,
          fontFamily: SFR, fontWeight: 800, fontSize: 11,
        }}>·</button>
      </div>

      <div className="ft-scroll" style={{ paddingBottom: 0 }}>
        {/* Big hole banner */}
        <div style={{ padding: '0 22px 14px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 3, opacity: 0.6, textTransform: 'uppercase' }}>Hole</div>
              <div style={{
                fontFamily: SFR, fontWeight: 900, fontSize: 110, lineHeight: 0.85,
                letterSpacing: -5, color: FT.cream, marginTop: -2,
              }}>{String(hole + 1).padStart(2, '0')}</div>
            </div>
            <div style={{ textAlign: 'right', paddingBottom: 10 }}>
              <div style={{ display: 'flex', gap: 18, alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, opacity: 0.55 }}>PAR</div>
                  <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 32, color: FT.orange, lineHeight: 1 }}>{par}</div>
                </div>
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, opacity: 0.55 }}>OF</div>
                  <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 32, color: FT.cream, lineHeight: 1, opacity: 0.5 }}>{N}</div>
                </div>
              </div>
            </div>
          </div>
          {/* Hole pip strip — clickable for fast nav */}
          <div style={{ display: 'flex', gap: 3, marginTop: 8 }}>
            {Array.from({ length: N }).map((_, i) => {
              const allDone = r.players.every((p) => typeof effectiveScores[p.id][i] === 'number')
              const isCurrent = i === hole
              return (
                <button key={i} onClick={() => setHole(i)} className="flat" style={{
                  flex: 1, height: 8, padding: 0, border: 'none', cursor: 'pointer',
                  borderRadius: 2, background: 'transparent',
                }}>
                  <div style={{
                    height: 4, borderRadius: 2,
                    background: isCurrent ? FT.orange : allDone ? FT.fern : 'rgba(244,239,228,0.18)',
                  }} />
                </button>
              )
            })}
          </div>
          {/* Hole nav arrows */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, gap: 8 }}>
            <button onClick={() => setHole(Math.max(0, hole - 1))} disabled={hole === 0} className="flat" style={{
              flex: 1, height: 36, borderRadius: 10, border: 'none',
              background: hole === 0 ? 'rgba(244,239,228,0.05)' : 'rgba(244,239,228,0.12)',
              color: hole === 0 ? 'rgba(244,239,228,0.3)' : FT.cream,
              fontFamily: SFR, fontWeight: 800, fontSize: 12, letterSpacing: 0.3,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>← prev</button>
            <button onClick={() => setHole(Math.min(N - 1, hole + 1))} disabled={hole === N - 1} className="flat" style={{
              flex: 1, height: 36, borderRadius: 10, border: 'none',
              background: hole === N - 1 ? 'rgba(244,239,228,0.05)' : 'rgba(244,239,228,0.12)',
              color: hole === N - 1 ? 'rgba(244,239,228,0.3)' : FT.cream,
              fontFamily: SFR, fontWeight: 800, fontSize: 12, letterSpacing: 0.3,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>next →</button>
          </div>
        </div>

        {/* Player input cards */}
        <div style={{ padding: '6px 14px 16px', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', zIndex: 1 }}>
          {r.players.map((p) => {
            const score = effectiveScores[p.id][hole]
            const hasScore = typeof score === 'number'
            const active = !hasScore && activePlayer && activePlayer.id === p.id
            const rEff = { ...r, scores: effectiveScores }
            const total = playerTotal(rEff, p.id)
            const vs = playerVsPar(rEff, p.id)
            const through = (effectiveScores[p.id] || []).filter((s) => typeof s === 'number').length
            return (
              <div key={p.id} style={{
                background: active ? FT.cream : hasScore ? 'rgba(244,239,228,0.08)' : 'rgba(244,239,228,0.04)',
                color: active ? FT.ink : FT.cream,
                borderRadius: 18, padding: '12px 14px',
                border: active ? `2px solid ${FT.orange}` : '2px solid transparent',
                boxShadow: active ? '0 8px 24px rgba(0,0,0,0.25)' : 'none',
                display: 'flex', alignItems: 'center', gap: 12,
                transition: 'all 180ms ease-out',
              }}>
                <Avatar name={p.name} color={p.color} size={40} fontSize={13} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: SFR, fontWeight: 800, fontSize: 16, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>{p.name}</span>
                    {through > 0 && <ParChip value={vs} size="sm" />}
                  </div>
                  <div style={{ fontSize: 11, opacity: active ? 0.55 : 0.5, marginTop: 1, fontFamily: MONO, letterSpacing: 0.5 }}>
                    TOTAL {total} · THRU {through}
                  </div>
                </div>
                {hasScore ? (
                  <button onClick={() => setScore(p.id, hole, null)} className="flat" title="Edit score" style={{
                    width: 44, height: 44, borderRadius: 12, border: 'none',
                    background: score - par <= -1 ? FT.orange : 'rgba(244,239,228,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: SFR, fontWeight: 900, fontSize: 22,
                    color: score - par <= -1 ? FT.ink : FT.cream,
                  }}>{score}</button>
                ) : (
                  <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 28, color: active ? FT.orange : 'rgba(244,239,228,0.3)', paddingRight: 4 }}>—</div>
                )}
              </div>
            )
          })}
        </div>

        {/* leave room for stepper */}
        <div style={{ height: 220 }} />
      </div>

      {/* Stepper input for active player */}
      <div style={{ position: 'absolute', left: 14, right: 14, bottom: 'max(16px, env(safe-area-inset-bottom))', zIndex: 2 }}>
        <div style={{
          background: FT.cream, borderRadius: 22, padding: '10px 12px 12px',
          boxShadow: '0 12px 36px rgba(0,0,0,0.35)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 8px' }}>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: FT.dim, textTransform: 'uppercase' }}>
                {activePlayer ? `${activePlayer.name} throws` : 'Hole locked in'}
              </div>
              <div style={{ fontFamily: SFR, fontWeight: 800, fontSize: 15 }}>
                {activePlayer ? 'Tap the strokes' : (hole < N - 1 ? 'Next hole →' : 'Final hole — finish up')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setRange((r) => r === 'low' ? 'high' : 'low')} className="flat" style={{
                height: 30, padding: '0 10px', borderRadius: 8, border: 'none',
                background: 'rgba(42,31,23,0.07)', color: FT.ink, fontWeight: 700, fontSize: 12, fontFamily: SF,
              }}>{range === 'low' ? '7-12' : '1-6'}</button>
              <button onClick={undoLast} className="flat" style={{
                height: 30, padding: '0 10px', borderRadius: 8, border: 'none',
                background: 'rgba(42,31,23,0.07)', color: FT.ink, fontWeight: 700, fontSize: 12, fontFamily: SF,
              }}>Undo</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
            {nums.map((n) => {
              const tone = n - par
              const isPar = tone === 0
              const isBirdie = tone < 0
              const bg = isBirdie ? FT.orange : isPar ? FT.forest : tone === 1 ? 'rgba(42,31,23,0.85)' : FT.bark
              const fg = isBirdie ? FT.ink : FT.cream
              const disabled = !activePlayer
              return (
                <button key={n} disabled={disabled} onClick={() => tapStroke(n)} style={{
                  height: 56, borderRadius: 14, border: 'none',
                  background: disabled ? 'rgba(42,31,23,0.1)' : bg,
                  color: disabled ? FT.dim : fg,
                  fontFamily: SFR, fontWeight: 900, fontSize: 24, letterSpacing: -0.5,
                  boxShadow: disabled ? 'none' : 'inset 0 -3px 0 rgba(0,0,0,0.18)',
                  cursor: disabled ? 'default' : 'pointer',
                }}>{n}</button>
              )
            })}
          </div>
        </div>
      </div>

      <Modal open={showQuit}
        title="Leave round?"
        body="The round will be saved as in-progress and you can resume from Home."
        cancelLabel="Keep playing"
        confirmLabel="Save & exit"
        onCancel={() => setShowQuit(false)}
        onConfirm={quit} />

      <HomeIndicator dark />
    </ScreenShell>
  )
}

export { LiveScorecardScreen }
