import { useState, useMemo, useCallback } from 'react'
import { FT, SFR, SF, MONO } from '../constants/colors'
import { ScreenShell } from '../components/layout/ScreenShell'
import { StatusBar, HomeIndicator, Avatar } from '../components/atoms'
import { useFireteam } from '../hooks/useFireteam'
import { useFriends } from '../hooks/useFriends'
import { computeHeadToHead, computeFireteamLeaderboard, winnerOf, formatShortDate } from '../lib/gameLogic'

// ─────────────────────────────────────────────
//  Rivalry card
// ─────────────────────────────────────────────
function RivalryCard({ profile, wins, losses, streak, streakType }) {
  const total = wins + losses
  return (
    <div style={{
      flexShrink: 0, width: 148, background: FT.paper,
      border: `1px solid ${FT.hair}`, borderRadius: 20,
      padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <Avatar name={profile.display_name} color={profile.avatar_color} size={42} fontSize={14} />
      <div>
        <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 14, color: FT.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {profile.display_name}
        </div>
        {total === 0 ? (
          <div style={{ fontSize: 11, color: FT.dim, marginTop: 2 }}>No rounds yet</div>
        ) : (
          <div style={{ fontSize: 12, color: FT.dim, marginTop: 2 }}>
            <span style={{ fontFamily: MONO, fontWeight: 700, color: wins > losses ? FT.forest : wins < losses ? '#C0392B' : FT.dim }}>
              {wins}W
            </span>
            {' / '}
            <span style={{ fontFamily: MONO }}>{losses}L</span>
          </div>
        )}
      </div>
      {streak > 0 && streakType && (
        <div style={{
          background: streakType === 'win' ? 'rgba(31,61,43,0.1)' : 'rgba(192,57,43,0.08)',
          borderRadius: 8, padding: '4px 8px',
          fontSize: 10, fontFamily: MONO, fontWeight: 700,
          color: streakType === 'win' ? FT.forest : '#C0392B',
          letterSpacing: 0.5,
        }}>
          {streak}-{streakType === 'win' ? 'WIN' : 'LOSS'} STREAK
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
//  Invite modal
// ─────────────────────────────────────────────
function InviteModal({ friends, memberIds, onInvite, onClose }) {
  const [selected, setSelected] = useState(new Set())
  const [sending, setSending] = useState(false)

  const eligible = friends.filter((f) => !memberIds.has(f.userId))

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const send = async () => {
    if (!selected.size) return
    setSending(true)
    try {
      await Promise.all([...selected].map(onInvite))
      onClose()
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(21,17,13,0.5)' }} />
      <div style={{
        position: 'relative', background: FT.paper, borderRadius: '24px 24px 0 0',
        padding: '20px 20px 0', display: 'flex', flexDirection: 'column', maxHeight: '70%',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontFamily: SFR, fontWeight: 800, fontSize: 18, color: FT.ink }}>Invite members</div>
          <button onClick={onClose} className="flat" style={{
            width: 30, height: 30, borderRadius: 9, border: 'none',
            background: 'rgba(42,31,23,0.08)', color: FT.dim,
            fontFamily: SFR, fontWeight: 700, fontSize: 14,
          }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {eligible.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: FT.dim, fontSize: 14 }}>
              All your friends are already in the fireteam
            </div>
          ) : (
            eligible.map((f) => {
              const on = selected.has(f.userId)
              return (
                <div key={f.id} onClick={() => toggle(f.userId)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px',
                  cursor: 'pointer',
                }}>
                  <Avatar name={f.displayName} color={f.avatarColor} size={40} fontSize={13} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 15, color: FT.ink }}>{f.displayName}</div>
                    <div style={{ fontSize: 12, color: FT.dim }}>@{f.username}</div>
                  </div>
                  <div style={{
                    width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                    border: `2px solid ${on ? FT.forest : 'rgba(42,31,23,0.25)'}`,
                    background: on ? FT.forest : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {on && <span style={{ color: FT.cream, fontSize: 13, fontWeight: 700 }}>✓</span>}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div style={{ padding: '14px 0', paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
          <button
            onClick={send}
            disabled={!selected.size || sending}
            className="flat"
            style={{
              width: '100%', padding: '14px', borderRadius: 16, border: 'none',
              background: selected.size ? FT.forest : 'rgba(42,31,23,0.1)',
              color: selected.size ? FT.cream : FT.dim,
              fontFamily: SFR, fontWeight: 800, fontSize: 16,
            }}>
            {sending ? 'Sending…' : `Send ${selected.size > 0 ? `${selected.size} ` : ''}Invite${selected.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
//  Empty state — no fireteam
// ─────────────────────────────────────────────
function NoFireteamState({ pendingInvites, onAccept, onDecline, onCreate }) {
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return
    setCreating(true)
    try { await onCreate(name.trim()) } finally { setCreating(false) }
  }

  return (
    <div className="ft-scroll">
      {pendingInvites.length > 0 && (
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: FT.dim, fontFamily: MONO, marginBottom: 10 }}>INVITES</div>
          {pendingInvites.map((inv) => (
            <div key={inv.id} style={{
              background: FT.paper, border: `1px solid ${FT.hair}`, borderRadius: 18,
              padding: '14px 16px', marginBottom: 10,
            }}>
              <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 15, color: FT.ink }}>
                {inv.inviter_name} invited you to
              </div>
              <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 20, color: FT.forest, marginTop: 2 }}>
                {inv.fireteam_name}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={() => onAccept(inv)} className="flat" style={{
                  flex: 1, padding: '11px', borderRadius: 12, border: 'none',
                  background: FT.forest, color: FT.cream,
                  fontFamily: SFR, fontWeight: 800, fontSize: 14,
                }}>Accept</button>
                <button onClick={() => onDecline(inv.id)} className="flat" style={{
                  flex: 1, padding: '11px', borderRadius: 12, border: 'none',
                  background: 'rgba(42,31,23,0.08)', color: FT.dim,
                  fontFamily: SFR, fontWeight: 700, fontSize: 14,
                }}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: '40px 24px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🎯</div>
        <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 24, letterSpacing: -0.5, color: FT.ink }}>
          Start your fireteam
        </div>
        <div style={{ fontSize: 14, color: FT.dim, marginTop: 6, lineHeight: 1.5 }}>
          A fireteam tracks your crew's rivalry,{'\n'}leaderboard, and rounds together.
        </div>
      </div>

      <div style={{ padding: '24px 20px 0' }}>
        {showCreate ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Fireteam name…"
              style={{
                padding: '14px 16px', borderRadius: 14,
                border: `1.5px solid ${FT.forest}`, background: FT.paper,
                fontFamily: SFR, fontWeight: 700, fontSize: 16, color: FT.ink, outline: 'none',
              }}
            />
            <button onClick={handleCreate} disabled={!name.trim() || creating} className="flat" style={{
              padding: '14px', borderRadius: 14, border: 'none',
              background: name.trim() ? FT.forest : 'rgba(42,31,23,0.1)',
              color: name.trim() ? FT.cream : FT.dim,
              fontFamily: SFR, fontWeight: 800, fontSize: 16,
            }}>
              {creating ? 'Creating…' : 'Create Fireteam'}
            </button>
            <button onClick={() => setShowCreate(false)} className="flat" style={{
              padding: '10px', borderRadius: 14, border: 'none', background: 'none',
              color: FT.dim, fontFamily: SFR, fontWeight: 700, fontSize: 14,
            }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setShowCreate(true)} disabled={pendingInvites.length > 0} className="flat" style={{
            width: '100%', padding: '14px', borderRadius: 14, border: 'none',
            background: pendingInvites.length > 0 ? 'rgba(42,31,23,0.07)' : FT.orange,
            color: pendingInvites.length > 0 ? FT.dim : FT.ink,
            fontFamily: SFR, fontWeight: 800, fontSize: 16,
          }}>
            + Create a Fireteam
          </button>
        )}
      </div>
      <div style={{ height: 60 }} />
    </div>
  )
}

// ─────────────────────────────────────────────
//  Main screen
// ─────────────────────────────────────────────
function FireteamScreen({ go, userId }) {
  const {
    fireteam, members, rounds, pendingInvites, loading,
    createFireteam, inviteMember, acceptInvite, declineInvite,
  } = useFireteam(userId)
  const { friends } = useFriends(userId)
  const [showInvite, setShowInvite] = useState(false)

  const memberIds = useMemo(() => new Set(members.map((m) => m.id)), [members])

  const rivalryData = useMemo(() => {
    if (!userId) return []
    return members
      .filter((m) => m.id !== userId)
      .map((opp) => ({ profile: opp, ...computeHeadToHead(opp.id, userId, rounds) }))
  }, [userId, members, rounds])

  const leaderboard = useMemo(
    () => computeFireteamLeaderboard(members, rounds),
    [members, rounds],
  )

  const handleInvite = useCallback(async (inviteeId) => {
    await inviteMember(inviteeId)
  }, [inviteMember])

  if (loading) {
    return (
      <ScreenShell label="Fireteam" bg={FT.cream}>
        <StatusBar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: FT.orange, opacity: 0.8 }} />
        </div>
        <HomeIndicator />
      </ScreenShell>
    )
  }

  if (!fireteam) {
    return (
      <ScreenShell label="Fireteam" bg={FT.cream}>
        <StatusBar />
        <div style={{ padding: '6px 24px 0' }}>
          <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 34, letterSpacing: -1.2, color: FT.ink }}>Fireteam</div>
        </div>
        <NoFireteamState
          pendingInvites={pendingInvites}
          onAccept={acceptInvite}
          onDecline={declineInvite}
          onCreate={createFireteam}
        />
        <HomeIndicator />
      </ScreenShell>
    )
  }

  return (
    <ScreenShell label="Fireteam" bg={FT.cream}>
      <StatusBar />

      {/* Header */}
      <div style={{ padding: '6px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 2, color: FT.dim }}>FIRETEAM</div>
          <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 28, letterSpacing: -0.8, color: FT.ink, lineHeight: 1.1 }}>
            {fireteam.name}
          </div>
        </div>
        <button onClick={() => setShowInvite(true)} className="flat" style={{
          height: 34, padding: '0 14px', borderRadius: 12, border: 'none',
          background: FT.forest, color: FT.cream,
          fontFamily: SFR, fontWeight: 800, fontSize: 13,
        }}>+ Invite</button>
      </div>

      <div className="ft-scroll">

        {/* Rivalry strip */}
        {rivalryData.length > 0 && (
          <div style={{ padding: '16px 0 0' }}>
            <div style={{ padding: '0 20px', fontSize: 10, letterSpacing: 2, color: FT.dim, fontFamily: MONO, marginBottom: 10 }}>
              YOUR RIVALRY
            </div>
            <div style={{ display: 'flex', gap: 10, paddingLeft: 20, paddingRight: 20, overflowX: 'auto', paddingBottom: 4 }}>
              {rivalryData.map(({ profile, wins, losses, streak, streakType }) => (
                <RivalryCard key={profile.id}
                  profile={profile} wins={wins} losses={losses}
                  streak={streak} streakType={streakType}
                />
              ))}
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div style={{ padding: '20px 20px 0' }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: FT.dim, fontFamily: MONO, marginBottom: 10 }}>
            LEADERBOARD
          </div>
          {leaderboard.length === 0 ? (
            <div style={{ padding: '16px', background: FT.paper, borderRadius: 16, textAlign: 'center', color: FT.dim, fontSize: 13 }}>
              Play your first round together to see standings
            </div>
          ) : (
            <div style={{ background: FT.paper, borderRadius: 18, overflow: 'hidden', border: `1px solid ${FT.hair}` }}>
              {leaderboard.map((entry, i) => (
                <div key={entry.profile.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  borderBottom: i < leaderboard.length - 1 ? `1px solid ${FT.hair}` : 'none',
                }}>
                  <div style={{
                    width: 22, fontFamily: MONO, fontWeight: 700, fontSize: 13,
                    color: i === 0 ? FT.orange : FT.dim, textAlign: 'center', flexShrink: 0,
                  }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                  </div>
                  <Avatar name={entry.profile.display_name} color={entry.profile.avatar_color} size={36} fontSize={12} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 15, color: FT.ink }}>
                      {entry.profile.display_name}
                      {entry.profile.id === userId && (
                        <span style={{ marginLeft: 6, fontSize: 10, fontFamily: MONO, color: FT.dim }}>YOU</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: FT.dim, marginTop: 1 }}>
                      {entry.roundsPlayed} round{entry.roundsPlayed !== 1 ? 's' : ''}
                      {entry.roundsPlayed > 0 && entry.avgVsPar !== 0 && (
                        <span> · {entry.avgVsPar > 0 ? '+' : ''}{entry.avgVsPar.toFixed(1)} avg</span>
                      )}
                    </div>
                  </div>
                  <div style={{
                    fontFamily: MONO, fontWeight: 700, fontSize: 13,
                    color: FT.forest,
                  }}>
                    {entry.wins}W
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent rounds */}
        {rounds.length > 0 && (
          <div style={{ padding: '20px 20px 0' }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: FT.dim, fontFamily: MONO, marginBottom: 10 }}>
              RECENT ROUNDS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rounds.slice(0, 5).map((r) => {
                const winner = winnerOf(r)
                return (
                  <button key={r.id} onClick={() => go('round', { roundId: r.id })} className="flat" style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    background: FT.paper, border: `1px solid ${FT.hair}`, borderRadius: 16,
                    textAlign: 'left', cursor: 'pointer',
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, background: FT.forest,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <span style={{ fontSize: 18 }}>🥏</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 14, color: FT.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.course_name}
                      </div>
                      <div style={{ fontSize: 11, color: FT.dim, marginTop: 1 }}>
                        {formatShortDate(new Date(r.started_at).getTime())}
                        {winner && <span> · {winner.displayName} won</span>}
                      </div>
                    </div>
                    <span style={{ color: FT.dim, fontSize: 16 }}>›</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ height: 40 }} />
      </div>

      {showInvite && (
        <InviteModal
          friends={friends}
          memberIds={memberIds}
          onInvite={handleInvite}
          onClose={() => setShowInvite(false)}
        />
      )}

      <HomeIndicator />
    </ScreenShell>
  )
}

export { FireteamScreen }
