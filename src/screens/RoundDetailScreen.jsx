import { useState, useMemo, useEffect } from 'react'
import { FT, SFR, MONO } from '../constants/colors'
import { ScreenShell } from '../components/layout/ScreenShell'
import { StatusBar, HomeIndicator, TopoBg, ParChip, Avatar, IconChevronLeft, IconTrash } from '../components/atoms'
import { useRounds } from '../hooks/useRounds'
import { useScores } from '../hooks/useScores'
import { useProfile } from '../hooks/useProfile'
import { useCourses } from '../hooks/useCourses'
import { playerTotal, playerVsPar, formatDuration, totalPar, initialsOf } from '../lib/gameLogic'

function TopBar({ onBack, label, step, right }) {
  return (
    <div style={{ padding: '6px 24px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
      {onBack ? (
        <button onClick={onBack} className="flat" style={{
          width: 36, height: 36, borderRadius: 12, background: FT.paper,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${FT.hair}`,
        }}><IconChevronLeft /></button>
      ) : <div style={{ width: 36 }} />}
      {label && <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: FT.dim }}>{label}</div>}
      {right || <div style={{ width: 36 }} />}
    </div>
  )
}

function Modal({ open, title, body, confirmLabel = 'OK', cancelLabel = 'Cancel', onConfirm, onCancel, danger = false }) {
  if (!open) return null;
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
  );
}

function RoundDetailScreen({ go, params, userId }) {
  const { rounds, loading: roundsLoading, abandonRound } = useRounds(userId)
  const { scores, loading: scoresLoading } = useScores(params.roundId)
  const { profile, loading: profileLoading } = useProfile(userId)
  const { courses, loading: coursesLoading } = useCourses(userId)

  const anyLoading = roundsLoading || scoresLoading || profileLoading || coursesLoading

  const rawRound = rounds.find((r) => r.id === params.roundId)

  const round = useMemo(() => {
    if (!rawRound || !profile) return null
    const course = courses.find((c) => c.id === rawRound.course_id)
    const pars = course?.pars ?? []
    if (!pars.length) return null
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
      id: rawRound.id,
      courseName: course?.name ?? '',
      startedAt: new Date(rawRound.started_at).getTime(),
      completedAt: rawRound.finished_at ? new Date(rawRound.finished_at).getTime() : null,
      pars,
      players,
      scores: scoreMap,
      status: rawRound.status,
    }
  }, [rawRound, profile, courses, scores, userId])

  useEffect(() => {
    if (!anyLoading && !round) go('home')
  }, [anyLoading, round])

  if (anyLoading || !round) {
    return (
      <ScreenShell>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: FT.orange, opacity: 0.8 }} />
        </div>
      </ScreenShell>
    )
  }

  const handleDelete = async () => {
    await abandonRound(params.roundId)
    go('home')
  }

  return <RoundDetailImpl go={go} params={params} round={round} onDelete={handleDelete} />
}

function RoundDetailImpl({ go, params, round, onDelete }) {
  const [confirmDel, setConfirmDel] = useState(false);

  const finals = useMemo(() => {
    return [...round.players]
      .map((p) => ({
        ...p,
        total: playerTotal(round, p.id),
        vs: playerVsPar(round, p.id),
      }))
      .sort((a, b) => a.total - b.total)
      .map((p, i, arr) => {
        let place = 1;
        if (i > 0) place = arr[i - 1].total === p.total ? arr[i - 1].place : i + 1;
        return { ...p, place };
      });
  }, [round]);

  const winner = finals[0];
  const winnerTie = finals.filter((f) => f.place === 1).length > 1;

  const cellTone = (s, par) => {
    if (typeof s !== 'number') return { bg: 'rgba(42,31,23,0.04)', fg: FT.dim };
    const d = s - par;
    if (d <= -2) return { bg: FT.orange, fg: FT.ink, ring: '50%' };
    if (d === -1) return { bg: FT.orange, fg: FT.ink };
    if (d === 0)  return { bg: 'transparent', fg: FT.ink };
    if (d === 1)  return { bg: 'transparent', fg: FT.ink, box: true };
    return { bg: FT.bark, fg: FT.cream, box: true };
  };

  const N = round.pars.length;
  const chunks = [];
  for (let start = 0; start < N; start += 9) chunks.push({ start, end: Math.min(N, start + 9) });

  const HoleRow = ({ start, end }) => (
    <div style={{ display: 'grid', gridTemplateColumns: `64px repeat(${end - start}, 1fr) 44px`, alignItems: 'center', borderBottom: `1px solid ${FT.hair}`, fontFamily: SFR }}>
      <div style={{ fontFamily: MONO, fontSize: 9, color: FT.dim, padding: '6px 0 6px 8px', letterSpacing: 1.5 }}>HOLE</div>
      {Array.from({ length: end - start }).map((_, i) => (
        <div key={i} style={{ textAlign: 'center', fontWeight: 700, fontSize: 11, color: FT.dim, padding: '6px 0' }}>{start + i + 1}</div>
      ))}
      <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 10, color: FT.dim, fontFamily: MONO, letterSpacing: 1 }}>
        {chunks.length === 1 ? 'TOT' : start === 0 ? 'OUT' : start === 9 ? 'IN' : '·'}
      </div>
    </div>
  );

  const ParRow = ({ start, end }) => (
    <div style={{ display: 'grid', gridTemplateColumns: `64px repeat(${end - start}, 1fr) 44px`, alignItems: 'center', borderBottom: `1px solid ${FT.hair}`, background: 'rgba(42,31,23,0.04)', fontFamily: SFR }}>
      <div style={{ fontFamily: MONO, fontSize: 9, color: FT.dim, padding: '6px 0 6px 8px', letterSpacing: 1.5 }}>PAR</div>
      {round.pars.slice(start, end).map((p, i) => (
        <div key={i} style={{ textAlign: 'center', fontWeight: 800, fontSize: 12, padding: '6px 0', color: FT.ink }}>{p}</div>
      ))}
      <div style={{ textAlign: 'center', fontWeight: 900, fontSize: 13, color: FT.ink }}>
        {round.pars.slice(start, end).reduce((a, b) => a + b, 0)}
      </div>
    </div>
  );

  const PlayerRow = ({ player, start, end }) => {
    const scores = (round.scores[player.id] || []).slice(start, end);
    const out = scores.reduce((a, b) => (a + (typeof b === 'number' ? b : 0)), 0);
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `64px repeat(${end - start}, 1fr) 44px`, alignItems: 'center', borderBottom: `1px solid ${FT.hair}`, fontFamily: SFR }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0 8px 8px' }}>
          <Avatar name={player.name} color={player.color} size={20} fontSize={9} />
          <span style={{ fontSize: 10, color: FT.dim, fontFamily: MONO, letterSpacing: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {initialsOf(player.name)}
          </span>
        </div>
        {scores.map((s, i) => {
          const t = cellTone(s, round.pars[start + i]);
          return (
            <div key={i} style={{ textAlign: 'center', padding: '4px 2px' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 22, height: 22, borderRadius: t.ring || (t.box ? 4 : 11),
                background: t.bg, color: t.fg,
                outline: t.box && t.bg === 'transparent' ? `1.5px solid ${FT.ink}` : 'none',
                outlineOffset: -2,
                fontWeight: 800, fontSize: 13,
              }}>{typeof s === 'number' ? s : '–'}</span>
            </div>
          );
        })}
        <div style={{ textAlign: 'center', fontWeight: 900, fontSize: 14, color: FT.ink }}>{out}</div>
      </div>
    );
  };

  const removeRound = async () => {
    setConfirmDel(false)
    await onDelete()
  }

  const isComplete = !!round.completedAt;
  const duration = round.completedAt ? formatDuration(round.completedAt - round.startedAt) : '—';

  return (
    <ScreenShell label="Round Detail">
      <StatusBar />
      <TopBar onBack={() => go('home')}
        label={isComplete ? 'FINAL' : 'IN PROGRESS'}
        right={
          <button onClick={() => setConfirmDel(true)} className="flat" style={{
            width: 36, height: 36, borderRadius: 12, background: FT.paper, border: `1px solid ${FT.hair}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><IconTrash /></button>
        } />

      <div className="ft-scroll">
        {/* Hero result */}
        <div style={{ padding: '4px 22px 16px' }}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: FT.dim, textTransform: 'uppercase' }}>
            {isComplete ? 'Final · ' : 'In progress · '}{round.courseName}
          </div>
          <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 38, letterSpacing: -1.4, lineHeight: 1, marginTop: 6 }}>
            {!isComplete ? "Still going." :
             winnerTie ? 'A tie at the top.' :
             `${winner.name} takes it.`}
          </div>
          <div style={{ fontSize: 13, color: FT.dim, marginTop: 4 }}>
            {duration} · {N} holes · par {totalPar(round.pars)}
          </div>
        </div>

        {/* Podium leaderboard */}
        <div style={{ padding: '0 16px' }}>
          <div style={{ background: FT.forest, borderRadius: 20, padding: 14, position: 'relative', overflow: 'hidden' }}>
            <TopoBg color="rgba(244,239,228,0.07)" />
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {finals.map((p) => {
                const isWinner = p.place === 1;
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px',
                    background: isWinner ? FT.orange : 'rgba(244,239,228,0.08)',
                    borderRadius: 14,
                    color: isWinner ? FT.ink : FT.cream,
                  }}>
                    <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 22, width: 22, textAlign: 'center', letterSpacing: -1 }}>
                      {p.place}
                    </div>
                    <Avatar name={p.name} color={p.color} size={34} fontSize={12}
                      border={isWinner ? `2px solid ${FT.ink}` : 'none'} />
                    <div style={{ flex: 1, fontFamily: SFR, fontWeight: 800, fontSize: 16, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 22, letterSpacing: -0.5 }}>{p.total}</div>
                    <ParChip value={p.vs} size="md" tone={isWinner ? 'par' : undefined} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scorecard table */}
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: FT.dim, textTransform: 'uppercase', marginBottom: 8 }}>Scorecard</div>
          {chunks.map((c, ci) => (
            <div key={ci} style={{ marginBottom: 6 }}>
              <div style={{ background: FT.paper, borderRadius: 14, border: `1px solid ${FT.hair}`, overflow: 'hidden' }}>
                <HoleRow start={c.start} end={c.end} />
                <ParRow start={c.start} end={c.end} />
                {round.players.map((p) => (
                  <PlayerRow key={p.id} player={p} start={c.start} end={c.end} />
                ))}
              </div>
            </div>
          ))}
          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', padding: '10px 0 4px', fontFamily: MONO, fontSize: 10, color: FT.dim, letterSpacing: 1 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: FT.orange }} />BIRDIE
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, outline: `1.5px solid ${FT.ink}`, outlineOffset: -2 }} />BOGEY
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: FT.bark }} />DBL+
            </span>
          </div>
        </div>

        <div style={{ height: 24 }} />
      </div>

      {params.justFinished && (
        <div style={{ padding: '12px 20px 28px', flexShrink: 0,
          background: 'linear-gradient(to top, rgba(244,239,228,1) 60%, rgba(244,239,228,0))' }}>
          <button onClick={() => go('home')} style={{
            width: '100%', height: 60, borderRadius: 18, border: 'none',
            background: FT.forest, color: FT.cream,
            fontFamily: SFR, fontWeight: 900, fontSize: 17, letterSpacing: -0.3,
            boxShadow: '0 6px 0 rgba(0,0,0,0.22)',
          }}>Done</button>
        </div>
      )}

      <Modal open={confirmDel}
        title="Delete this round?"
        body="The scorecard will be removed. This can't be undone."
        confirmLabel="Delete" danger
        onCancel={() => setConfirmDel(false)}
        onConfirm={removeRound} />

      <HomeIndicator />
    </ScreenShell>
  );
}

export { RoundDetailScreen }
