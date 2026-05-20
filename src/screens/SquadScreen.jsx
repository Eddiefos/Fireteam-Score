import { useState, useEffect } from 'react'
import { FT, SFR, SF, MONO } from '../constants/colors'
import { ScreenShell } from '../components/layout/ScreenShell'
import { StatusBar, HomeIndicator, Avatar } from '../components/atoms'
import { useFriends } from '../hooks/useFriends'
import { getFriendActivity } from '../services/friends'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeDate(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function ScoreChip({ vsPar }) {
  if (vsPar === null || vsPar === undefined) return null
  const label = vsPar === 0 ? 'E' : vsPar > 0 ? `+${vsPar}` : `${vsPar}`
  const style = vsPar <= -1
    ? { background: FT.orange, color: FT.ink }
    : vsPar === 0
    ? { background: 'rgba(42,31,23,0.08)', color: FT.ink }
    : vsPar === 1
    ? { background: 'rgba(42,31,23,0.8)', color: FT.cream }
    : { background: FT.bark, color: FT.cream }
  return (
    <div style={{ padding: '3px 8px', borderRadius: 7, fontSize: 11, fontWeight: 600, fontFamily: MONO, ...style }}>
      {label}
    </div>
  )
}

// ─── Activity Tab ─────────────────────────────────────────────────────────────

function ActivityTab({ friends }) {
  const [activityByFriend, setActivityByFriend] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!friends.length) { setLoading(false); return }
    let cancelled = false
    Promise.all(
      friends.map((f) =>
        getFriendActivity(f.userId)
          .then((rounds) => ({ id: f.userId, rounds }))
          .catch(() => ({ id: f.userId, rounds: [] }))
      )
    ).then((results) => {
      if (cancelled) return
      const map = {}
      for (const r of results) map[r.id] = r.rounds
      setActivityByFriend(map)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [friends.map((f) => f.userId).join(',')])

  if (loading) return (
    <div style={{ padding: '32px 20px', textAlign: 'center', color: FT.dim, fontSize: 13 }}>Loading…</div>
  )

  if (!friends.length) return (
    <div style={{ padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 30, marginBottom: 10 }}>🎯</div>
      <div style={{ fontFamily: SFR, fontWeight: 600, fontSize: 15, color: FT.ink }}>No friends yet</div>
      <div style={{ fontSize: 13, color: FT.dim, marginTop: 4 }}>Add friends to see their activity here</div>
    </div>
  )

  const activeFriends = friends.filter((f) => (activityByFriend[f.userId] ?? []).length > 0)

  if (!loading && activeFriends.length === 0) return (
    <div style={{ padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 30, marginBottom: 10 }}>🏌️</div>
      <div style={{ fontFamily: SFR, fontWeight: 600, fontSize: 15, color: FT.ink }}>No recent activity</div>
      <div style={{ fontSize: 13, color: FT.dim, marginTop: 4 }}>Your friends haven't played any rounds yet</div>
    </div>
  )

  return (
    <div>
      {activeFriends.map((friend, i) => {
        const rounds = activityByFriend[friend.userId] ?? []
        return (
          <div key={friend.userId}>
            {i > 0 && <div style={{ height: 1, background: FT.hair, margin: '0 20px' }} />}
            <div style={{ padding: '10px 20px 0' }}>
              {/* Friend name row — display only, not tappable */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
                <Avatar name={friend.displayName} color={friend.avatarColor} size={30} fontSize={10} />
                <div style={{ fontFamily: SF, fontWeight: 600, fontSize: 13, color: FT.ink }}>{friend.displayName}</div>
              </div>

              {/* Round rows */}
              <div style={{ paddingLeft: 39, display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 10 }}>
                {rounds.slice(0, 2).map((round) => (
                  <div key={round.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '7px 10px', background: FT.paper,
                    borderRadius: 10, border: `1px solid ${FT.hair}`,
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: FT.ink }}>{round.courseName}</div>
                      <div style={{ fontSize: 10, color: FT.dim, marginTop: 1 }}>
                        {relativeDate(round.startedAt)} · {round.holesPlayed} holes
                      </div>
                    </div>
                    <ScoreChip vsPar={round.scoreVsPar} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Friends Sub-tab ──────────────────────────────────────────────────────────

function FriendsSubTab({ friends, loading, searchQuery, setSearchQuery, searchResults, searching, sendRequest, go }) {
  const friendUserIds = new Set(friends.map((f) => f.userId))

  return (
    <>
      {/* Search */}
      <div style={{ margin: '10px 20px 0', background: 'rgba(42,31,23,0.07)', borderRadius: 14, padding: '9px 13px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 15 }}>🔍</span>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Find players by username…"
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontFamily: SF, fontSize: 13, color: FT.ink }}
        />
        {searchQuery.length > 0 && (
          <button onClick={() => setSearchQuery('')} className="flat" style={{ fontSize: 12, color: FT.dim }}>✕</button>
        )}
      </div>

      {/* Search results dropdown */}
      {searchQuery.length >= 2 && (
        <div style={{ margin: '4px 20px 0', background: FT.paper, borderRadius: 14, overflow: 'hidden', border: `1px solid ${FT.hair}` }}>
          {searching && <div style={{ padding: '12px 16px', color: FT.dim, fontSize: 13 }}>Searching…</div>}
          {!searching && searchResults.length === 0 && <div style={{ padding: '12px 16px', color: FT.dim, fontSize: 13 }}>No players found</div>}
          {!searching && searchResults.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: `1px solid ${FT.hair}` }}>
              <Avatar name={p.display_name} color={p.avatar_color} size={34} fontSize={11} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: SFR, fontWeight: 600, fontSize: 13, color: FT.ink }}>{p.display_name}</div>
                <div style={{ fontSize: 11, color: FT.dim }}>@{p.username}</div>
              </div>
              {friendUserIds.has(p.id)
                ? <div style={{ fontSize: 10, fontFamily: MONO, color: FT.dim, padding: '4px 10px' }}>FRIENDS</div>
                : <button onClick={() => sendRequest(p.id)} className="flat" style={{ height: 30, padding: '0 13px', borderRadius: 9, border: 'none', background: FT.orange, color: FT.ink, fontFamily: SFR, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ Add</button>
              }
            </div>
          ))}
        </div>
      )}

      {/* Friends list */}
      <div style={{ marginTop: 8 }}>
        {loading && <div style={{ padding: '24px 20px', textAlign: 'center', color: FT.dim, fontSize: 13 }}>Loading…</div>}
        {!loading && friends.length === 0 && searchQuery.length < 2 && (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>🎯</div>
            <div style={{ fontFamily: SFR, fontWeight: 600, fontSize: 15, color: FT.ink }}>Find your crew</div>
            <div style={{ fontSize: 13, color: FT.dim, marginTop: 4 }}>Search for players by username above</div>
          </div>
        )}
        {friends.map((f, i) => (
          <div key={f.id}>
            {i > 0 && <div style={{ height: 1, background: FT.hair, margin: '0 20px' }} />}
            <button
              onClick={() => go('friendProfile', {
                friendId: f.userId,
                friendshipId: f.id,
                displayName: f.displayName,
                username: f.username,
                initials: f.initials,
                avatarColor: f.avatarColor,
                roundsTogether: f.roundsTogether,
                avgVsPar: f.avgVsPar,
              })}
              className="flat"
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', width: '100%', cursor: 'pointer', background: 'none', border: 'none', textAlign: 'left' }}
            >
              <Avatar name={f.displayName} color={f.avatarColor} size={38} fontSize={12} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SF, fontWeight: 500, fontSize: 14, color: FT.ink }}>{f.displayName}</div>
                <div style={{ fontSize: 11, color: FT.dim, marginTop: 1 }}>
                  @{f.username}{f.roundsTogether > 0 ? ` · ${f.roundsTogether} rounds` : ''}
                </div>
              </div>
              {f.avgVsPar !== null && (
                <div style={{ background: 'rgba(42,31,23,0.07)', borderRadius: 8, padding: '3px 8px', fontSize: 10, fontWeight: 600, color: FT.dim, fontFamily: MONO }}>
                  {f.avgVsPar > 0 ? '+' : ''}{f.avgVsPar.toFixed(1)}
                </div>
              )}
            </button>
          </div>
        ))}
      </div>
    </>
  )
}

// ─── Requests Sub-tab ────────────────────────────────────────────────────────

function RequestsSubTab({ pendingRequests, sentRequests, acceptRequest, declineRequest, cancelRequest }) {
  if (pendingRequests.length === 0 && sentRequests.length === 0) return (
    <div style={{ padding: '40px 24px', textAlign: 'center', color: FT.dim, fontSize: 13 }}>No pending requests</div>
  )

  return (
    <>
      {pendingRequests.length > 0 && (
        <>
          <div style={{ padding: '14px 20px 4px', fontFamily: MONO, fontSize: 9, letterSpacing: 2.5, color: FT.dim, textTransform: 'uppercase' }}>Incoming</div>
          {pendingRequests.map((req) => (
            <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px' }}>
              <Avatar name={req.profile.display_name} color={req.profile.avatar_color} size={36} fontSize={11} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SF, fontWeight: 500, fontSize: 13, color: FT.ink }}>{req.profile.display_name}</div>
                <div style={{ fontSize: 11, color: FT.dim }}>@{req.profile.username}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => acceptRequest(req.id)} className="flat" style={{ height: 32, padding: '0 12px', borderRadius: 9, border: 'none', background: FT.forest, color: FT.cream, fontFamily: SFR, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Accept</button>
                <button onClick={() => declineRequest(req.id)} className="flat" style={{ height: 32, padding: '0 12px', borderRadius: 9, border: 'none', background: 'rgba(42,31,23,0.08)', color: FT.dim, fontFamily: SFR, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>✕</button>
              </div>
            </div>
          ))}
        </>
      )}

      {sentRequests.length > 0 && (
        <>
          <div style={{ padding: '14px 20px 4px', fontFamily: MONO, fontSize: 9, letterSpacing: 2.5, color: FT.dim, textTransform: 'uppercase' }}>Sent</div>
          {sentRequests.map((req) => (
            <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px', opacity: 0.65 }}>
              <Avatar name={req.profile.display_name} color={req.profile.avatar_color} size={36} fontSize={11} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SF, fontWeight: 500, fontSize: 13, color: FT.ink }}>{req.profile.display_name}</div>
                <div style={{ fontSize: 11, color: FT.dim }}>@{req.profile.username}</div>
              </div>
              <button onClick={() => cancelRequest(req.id)} className="flat" style={{ height: 32, padding: '0 12px', borderRadius: 9, border: 'none', background: 'rgba(42,31,23,0.08)', color: FT.dim, fontFamily: SFR, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
            </div>
          ))}
        </>
      )}
    </>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

function SquadScreen({ go, userId }) {
  const {
    friends, pendingRequests, sentRequests, loading,
    sendRequest, acceptRequest, declineRequest, cancelRequest, searchUsers,
  } = useFriends(userId)

  const [topTab, setTopTab] = useState('activity')   // 'activity' | 'friends'
  const [subTab, setSubTab] = useState('friends')    // 'friends' | 'requests'
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  const handleSearch = async (q) => {
    setSearchQuery(q)
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const results = await searchUsers(q)
      setSearchResults(results)
    } finally {
      setSearching(false)
    }
  }

  const pendingCount = pendingRequests.length

  const chipStyle = (active) => ({
    padding: '6px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600,
    border: 'none', cursor: 'pointer', fontFamily: SF,
    background: active ? FT.forest : 'rgba(42,31,23,0.08)',
    color: active ? FT.cream : FT.dim,
  })

  const subTabStyle = (active) => ({
    padding: '9px 16px', fontSize: 13, fontWeight: 600,
    border: 'none', background: 'none', cursor: 'pointer', fontFamily: SF,
    color: active ? FT.ink : FT.dim,
    borderBottom: active ? `2px solid ${FT.forest}` : '2px solid transparent',
    marginBottom: -1,
  })

  return (
    <ScreenShell label="Friends" bg={FT.cream}>
      <StatusBar />

      <div style={{ padding: '20px 24px 0' }}>
        <div style={{ fontFamily: SFR, fontWeight: 600, fontSize: 34, letterSpacing: -1.2, lineHeight: 1.05, color: FT.ink }}>Friends</div>
      </div>

      {/* Top chip tabs */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 20px 0' }}>
        <button className="flat" style={chipStyle(topTab === 'activity')} onClick={() => setTopTab('activity')}>Activity</button>
        <button className="flat" style={chipStyle(topTab === 'friends')} onClick={() => setTopTab('friends')}>Friends</button>
      </div>

      <div style={{ height: 1, background: FT.hair, marginTop: 10 }} />

      {/* Friends tab: underline sub-tabs */}
      {topTab === 'friends' && (
        <div style={{ display: 'flex', padding: '0 20px', borderBottom: `1px solid ${FT.hair}`, marginTop: 2 }}>
          <button className="flat" style={subTabStyle(subTab === 'friends')} onClick={() => setSubTab('friends')}>Friends</button>
          <button className="flat" style={subTabStyle(subTab === 'requests')} onClick={() => setSubTab('requests')}>
            Requests
            {pendingCount > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: FT.orange, color: FT.ink,
                fontSize: 9, fontWeight: 700, width: 16, height: 16,
                borderRadius: 8, marginLeft: 5,
              }}>{pendingCount}</span>
            )}
          </button>
        </div>
      )}

      <div className="ft-scroll">
        {topTab === 'activity' && (
          <ActivityTab friends={friends} />
        )}

        {topTab === 'friends' && subTab === 'friends' && (
          <FriendsSubTab
            friends={friends}
            loading={loading}
            searchQuery={searchQuery}
            setSearchQuery={handleSearch}
            searchResults={searchResults}
            searching={searching}
            sendRequest={sendRequest}
            go={go}
          />
        )}

        {topTab === 'friends' && subTab === 'requests' && (
          <RequestsSubTab
            pendingRequests={pendingRequests}
            sentRequests={sentRequests}
            acceptRequest={acceptRequest}
            declineRequest={declineRequest}
            cancelRequest={cancelRequest}
          />
        )}
      </div>

      <HomeIndicator />
    </ScreenShell>
  )
}

export { SquadScreen }
