import { useState } from 'react'
import { FT, SFR, SF, MONO } from '../constants/colors'
import { ScreenShell } from '../components/layout/ScreenShell'
import { StatusBar, HomeIndicator, Avatar } from '../components/atoms'
import { useFriends } from '../hooks/useFriends'

function SquadScreen({ go, userId }) {
  const { friends, pendingRequests, sentRequests, loading, sendRequest, acceptRequest, declineRequest, cancelRequest, searchUsers } = useFriends(userId)
  const [tab, setTab] = useState('friends')
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

  const friendUserIds = new Set(friends.map((f) => f.userId))
  const pendingCount = pendingRequests.length

  return (
    <ScreenShell label="Squad" bg={FT.cream}>
      <StatusBar />

      <div style={{ padding: '6px 24px 0' }}>
        <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 34, letterSpacing: -1.2, lineHeight: 1.05, color: FT.ink }}>Squad</div>
      </div>

      {/* Search bar */}
      <div style={{ padding: '10px 20px 0' }}>
        <div style={{
          background: 'rgba(42,31,23,0.07)', borderRadius: 14, padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <input
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Find players by username…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontFamily: SF, fontSize: 14, color: FT.ink,
            }}
          />
        </div>
        {searchQuery.length >= 2 && (
          <div style={{ background: FT.paper, borderRadius: 14, marginTop: 6, overflow: 'hidden', border: `1px solid ${FT.hair}` }}>
            {searching && <div style={{ padding: '12px 16px', color: FT.dim, fontSize: 13 }}>Searching…</div>}
            {!searching && searchResults.length === 0 && <div style={{ padding: '12px 16px', color: FT.dim, fontSize: 13 }}>No players found</div>}
            {!searching && searchResults.map((p) => {
              const alreadyFriend = friendUserIds.has(p.id)
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${FT.hair}` }}>
                  <Avatar name={p.display_name} color={p.avatar_color} size={36} fontSize={12} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 14, color: FT.ink }}>{p.display_name}</div>
                    <div style={{ fontSize: 12, color: FT.dim }}>@{p.username}</div>
                  </div>
                  {alreadyFriend ? (
                    <div style={{ fontSize: 11, fontFamily: MONO, color: FT.dim, padding: '4px 10px' }}>FRIENDS</div>
                  ) : (
                    <button onClick={() => sendRequest(p.id)} className="flat" style={{
                      height: 32, padding: '0 14px', borderRadius: 10, border: 'none',
                      background: FT.orange, color: FT.ink, fontFamily: SFR, fontWeight: 800, fontSize: 13,
                    }}>+ Add</button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', padding: '12px 20px 0', gap: 0, borderBottom: `1px solid ${FT.hair}`, flexShrink: 0 }}>
        {[
          { key: 'friends', label: 'Friends' },
          { key: 'requests', label: `Requests${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} className="flat" style={{
            padding: '8px 16px', fontSize: 14, fontWeight: 700, fontFamily: SFR,
            color: tab === key ? FT.ink : FT.dim,
            background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: tab === key ? `2px solid ${FT.forest}` : '2px solid transparent',
            marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {/* Tab content */}
      <div className="ft-scroll">
        {tab === 'friends' && (
          <>
            {loading && <div style={{ padding: 24, textAlign: 'center', color: FT.dim, fontSize: 14 }}>Loading…</div>}
            {!loading && friends.length === 0 && (
              <div style={{ padding: '32px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🎯</div>
                <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 16, color: FT.ink }}>Find your crew</div>
                <div style={{ fontSize: 13, color: FT.dim, marginTop: 4 }}>Search for players by username above</div>
              </div>
            )}
            {friends.map((f) => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px' }}>
                <Avatar name={f.displayName} color={f.avatarColor} size={40} fontSize={13} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 15, color: FT.ink }}>{f.displayName}</div>
                  <div style={{ fontSize: 12, color: FT.dim, marginTop: 1 }}>
                    @{f.username}{f.roundsTogether > 0 ? ` · ${f.roundsTogether} rounds together` : ''}
                  </div>
                </div>
                {f.avgVsPar !== null && (
                  <div style={{
                    background: 'rgba(42,31,23,0.07)', borderRadius: 8, padding: '3px 8px',
                    fontSize: 11, fontWeight: 700, color: FT.dim, fontFamily: MONO,
                  }}>
                    {f.avgVsPar > 0 ? '+' : ''}{f.avgVsPar.toFixed(1)} avg
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {tab === 'requests' && (
          <>
            {pendingRequests.length > 0 && (
              <>
                <div style={{ padding: '14px 20px 4px', fontSize: 10, letterSpacing: 2, color: FT.dim, fontFamily: MONO }}>INCOMING</div>
                {pendingRequests.map((req) => (
                  <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px' }}>
                    <Avatar name={req.profile.display_name} color={req.profile.avatar_color} size={38} fontSize={12} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 14, color: FT.ink }}>{req.profile.display_name}</div>
                      <div style={{ fontSize: 12, color: FT.dim }}>@{req.profile.username}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => acceptRequest(req.id)} className="flat" style={{
                        height: 32, padding: '0 12px', borderRadius: 9, border: 'none',
                        background: FT.forest, color: FT.cream, fontFamily: SFR, fontWeight: 800, fontSize: 12,
                      }}>Accept</button>
                      <button onClick={() => declineRequest(req.id)} className="flat" style={{
                        height: 32, padding: '0 12px', borderRadius: 9, border: 'none',
                        background: 'rgba(42,31,23,0.08)', color: FT.dim, fontFamily: SFR, fontWeight: 700, fontSize: 12,
                      }}>Decline</button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {sentRequests.length > 0 && (
              <>
                <div style={{ padding: '14px 20px 4px', fontSize: 10, letterSpacing: 2, color: FT.dim, fontFamily: MONO }}>SENT</div>
                {sentRequests.map((req) => (
                  <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px', opacity: 0.65 }}>
                    <Avatar name={req.profile.display_name} color={req.profile.avatar_color} size={38} fontSize={12} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 14, color: FT.ink }}>{req.profile.display_name}</div>
                      <div style={{ fontSize: 12, color: FT.dim }}>@{req.profile.username}</div>
                    </div>
                    <button onClick={() => cancelRequest(req.id)} className="flat" style={{
                      height: 32, padding: '0 12px', borderRadius: 9, border: 'none',
                      background: 'rgba(42,31,23,0.08)', color: FT.dim, fontFamily: SFR, fontWeight: 700, fontSize: 12,
                    }}>Cancel</button>
                  </div>
                ))}
              </>
            )}

            {pendingRequests.length === 0 && sentRequests.length === 0 && (
              <div style={{ padding: '32px 24px', textAlign: 'center', color: FT.dim, fontSize: 14 }}>No pending requests</div>
            )}
          </>
        )}
      </div>

      <HomeIndicator />
    </ScreenShell>
  )
}

export { SquadScreen }
