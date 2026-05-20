import { useState, useEffect } from 'react'
import { FT, SFR, SF, MONO } from '../constants/colors'
import { ScreenShell } from '../components/layout/ScreenShell'
import { StatusBar, HomeIndicator, Avatar, IconChevronLeft, useToast } from '../components/atoms'
import { getFriendActivity, removeFriend } from '../services/friends'

function ScoreChip({ vsPar }) {
  if (vsPar === null) return null
  if (vsPar <= -1) return (
    <div style={{ padding: '3px 8px', borderRadius: 7, background: FT.orange, color: FT.ink, fontSize: 11, fontWeight: 600, fontFamily: MONO }}>
      {vsPar}
    </div>
  )
  if (vsPar === 0) return (
    <div style={{ padding: '3px 8px', borderRadius: 7, background: 'rgba(42,31,23,0.08)', color: FT.ink, fontSize: 11, fontWeight: 600, fontFamily: MONO }}>
      E
    </div>
  )
  if (vsPar === 1) return (
    <div style={{ padding: '3px 8px', borderRadius: 7, background: 'rgba(42,31,23,0.8)', color: FT.cream, fontSize: 11, fontWeight: 600, fontFamily: MONO }}>
      +{vsPar}
    </div>
  )
  return (
    <div style={{ padding: '3px 8px', borderRadius: 7, background: FT.bark, color: FT.cream, fontSize: 11, fontWeight: 600, fontFamily: MONO }}>
      +{vsPar}
    </div>
  )
}

function ConfirmModal({ open, onConfirm, onCancel, name }) {
  if (!open) return null
  return (
    <div onClick={onCancel} style={{
      position: 'absolute', inset: 0, background: 'rgba(21,17,13,0.45)',
      zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: FT.cream, borderRadius: 20, padding: 22, width: '100%', maxWidth: 320,
      }}>
        <div style={{ fontFamily: SFR, fontWeight: 600, fontSize: 18, color: FT.ink, marginBottom: 8 }}>Remove {name}?</div>
        <div style={{ fontSize: 13, color: FT.dim, lineHeight: 1.5, marginBottom: 20 }}>
          They'll be removed from your friends list. You can always add them again later.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '11px 0', borderRadius: 12, border: `1px solid ${FT.hair}`,
            background: FT.paper, fontSize: 14, fontWeight: 600, color: FT.dim, cursor: 'pointer', fontFamily: SF,
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '11px 0', borderRadius: 12, border: 'none',
            background: '#b42828', fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: SF,
          }}>Remove</button>
        </div>
      </div>
    </div>
  )
}

function FriendProfileScreen({ go, params = {} }) {
  const { friendId, friendshipId, displayName, username, initials, avatarColor, roundsTogether, avgVsPar } = params
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [removing, setRemoving] = useState(false)
  const { node: toastNode, show: showToast } = useToast()

  useEffect(() => {
    if (!friendId) { setLoading(false); return }
    getFriendActivity(friendId)
      .then(setActivity)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [friendId])

  const handleRemove = async () => {
    setRemoving(true)
    try {
      await removeFriend(friendshipId)
      go('friends')
    } catch {
      showToast('Could not remove friend. Try again.')
      setRemoving(false)
      setConfirmOpen(false)
    }
  }

  const relativeDate = (iso) => {
    const diff = Date.now() - new Date(iso).getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    if (days < 30) return `${Math.floor(days / 7)}w ago`
    return `${Math.floor(days / 30)}mo ago`
  }

  return (
    <ScreenShell label="Friend" bg={FT.cream}>
      <StatusBar />

      {/* Back */}
      <div style={{ padding: '6px 20px 0', display: 'flex', alignItems: 'center' }}>
        <button onClick={() => go('friends')} className="flat" style={{
          width: 34, height: 34, borderRadius: 11, background: FT.paper,
          border: `1px solid ${FT.hair}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><IconChevronLeft /></button>
      </div>

      {/* Profile header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 22px 16px' }}>
        <Avatar name={displayName} color={avatarColor} size={52} fontSize={16} />
        <div>
          <div style={{ fontFamily: SFR, fontWeight: 600, fontSize: 22, color: FT.ink, letterSpacing: -0.5 }}>{displayName}</div>
          <div style={{ fontSize: 13, color: FT.dim, marginTop: 2 }}>@{username}</div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 8, padding: '0 20px 16px' }}>
        <div style={{ flex: 1, background: FT.paper, border: `1px solid ${FT.hair}`, borderRadius: 13, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 18, color: FT.ink }}>{roundsTogether ?? 0}</div>
          <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 1.5, color: FT.dim, marginTop: 2, textTransform: 'uppercase' }}>Rounds</div>
        </div>
        <div style={{ flex: 1, background: FT.paper, border: `1px solid ${FT.hair}`, borderRadius: 13, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 18, color: FT.ink }}>
            {avgVsPar !== null && avgVsPar !== undefined ? (avgVsPar > 0 ? `+${avgVsPar.toFixed(1)}` : avgVsPar.toFixed(1)) : '–'}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 1.5, color: FT.dim, marginTop: 2, textTransform: 'uppercase' }}>Avg vs par</div>
        </div>
      </div>

      {/* Recent activity */}
      <div style={{ padding: '0 20px 4px', fontFamily: MONO, fontSize: 9, letterSpacing: 2.5, color: FT.dim, textTransform: 'uppercase' }}>
        Recent Rounds
      </div>

      <div className="ft-scroll" style={{ paddingBottom: 16 }}>
        {loading && (
          <div style={{ padding: '24px 20px', color: FT.dim, fontSize: 13, textAlign: 'center' }}>Loading…</div>
        )}
        {!loading && activity.length === 0 && (
          <div style={{ padding: '24px 20px', color: FT.dim, fontSize: 13, textAlign: 'center' }}>No recent rounds yet.</div>
        )}
        {!loading && activity.map((round) => (
          <div key={round.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            margin: '4px 20px', padding: '9px 12px',
            background: FT.paper, borderRadius: 12, border: `1px solid ${FT.hair}`,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: FT.ink }}>{round.courseName}</div>
              <div style={{ fontSize: 11, color: FT.dim, marginTop: 2 }}>
                {relativeDate(round.startedAt)} · {round.holesPlayed} holes
              </div>
            </div>
            <ScoreChip vsPar={round.scoreVsPar} />
          </div>
        ))}

        {/* Remove friend */}
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={removing}
          style={{
            margin: '16px 20px 0', width: 'calc(100% - 40px)', display: 'block',
            padding: '13px', borderRadius: 14,
            border: '1.5px solid rgba(180,40,40,0.22)',
            background: 'rgba(180,40,40,0.05)',
            color: '#b42828', fontSize: 14, fontWeight: 600,
            cursor: removing ? 'not-allowed' : 'pointer', fontFamily: SF,
            opacity: removing ? 0.6 : 1,
          }}
        >
          Remove Friend
        </button>
      </div>

      <ConfirmModal
        open={confirmOpen}
        name={displayName}
        onConfirm={handleRemove}
        onCancel={() => setConfirmOpen(false)}
      />
      {toastNode}
      <HomeIndicator />
    </ScreenShell>
  )
}

export { FriendProfileScreen }
