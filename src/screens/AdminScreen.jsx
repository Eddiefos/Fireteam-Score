import { useState, useEffect } from 'react'
import { FT, SFR, MONO } from '../constants/colors'
import { StatusBar, HomeIndicator } from '../components/atoms'
import { ScreenShell } from '../components/layout/ScreenShell'
import { getPendingSubmissions, approveSubmission, rejectSubmission } from '../services/courses'

export function AdminScreen({ go, userId, onToast }) {
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPendingSubmissions()
      .then(setSubmissions)
      .catch(() => onToast?.('Failed to load submissions'))
      .finally(() => setLoading(false))
  }, [])

  const handleApprove = async (sub) => {
    try {
      await approveSubmission(userId, sub)
      setSubmissions(prev => prev.filter(s => s.id !== sub.id))
      onToast?.(`${sub.name} approved!`)
    } catch {
      onToast?.('Approval failed. Try again.')
    }
  }

  const handleReject = async (sub) => {
    try {
      await rejectSubmission(userId, sub.id)
      setSubmissions(prev => prev.filter(s => s.id !== sub.id))
      onToast?.('Submission rejected.')
    } catch {
      onToast?.('Rejection failed. Try again.')
    }
  }

  return (
    <ScreenShell>
      <StatusBar />

      {/* Nav header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 14px 6px' }}>
        <button
          aria-label="Back"
          onClick={() => go('account')}
          style={{ width: 30, height: 30, borderRadius: 9, background: FT.paper, border: `1px solid ${FT.hair}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer' }}
        >‹</button>
        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 2, color: FT.dim }}>ADMIN</span>
        <div style={{ width: 30 }} />
      </div>

      {/* Heading */}
      <div style={{ padding: '0 14px 16px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.7, color: FT.ink, lineHeight: 1.15, fontFamily: SFR, margin: 0 }}>
          Course Submissions.
        </h1>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 32, color: FT.dim, fontSize: 13 }}>
          Loading submissions…
        </div>
      )}

      {/* Empty state */}
      {!loading && submissions.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 20px', color: FT.dim, fontSize: 13 }}>
          No pending submissions.
        </div>
      )}

      {/* Submission cards */}
      {!loading && submissions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 10px' }}>
          {submissions.map(sub => (
            <div
              key={sub.id}
              style={{ background: FT.paper, border: `1px solid ${FT.hair}`, borderRadius: 14, padding: '12px 13px' }}
            >
              {/* Name */}
              <div style={{ fontWeight: 700, fontSize: 14, color: FT.ink, marginBottom: 3 }}>
                {sub.name}
              </div>

              {/* Location + holes */}
              <div style={{ fontSize: 11, color: FT.dim, marginBottom: sub.notes ? 8 : 10 }}>
                {[sub.location, `${sub.holes} holes`].filter(Boolean).join(' · ')}
              </div>

              {/* Notes */}
              {sub.notes && (
                <div style={{ fontSize: 12, color: FT.dim, fontStyle: 'italic', marginBottom: 10, lineHeight: 1.4 }}>
                  "{sub.notes}"
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => handleApprove(sub)}
                  style={{
                    flex: 1,
                    padding: '9px 0',
                    borderRadius: 10,
                    border: 'none',
                    background: FT.forest,
                    color: FT.cream,
                    fontFamily: SFR,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Approve
                </button>
                <button
                  onClick={() => handleReject(sub)}
                  style={{
                    flex: 1,
                    padding: '9px 0',
                    borderRadius: 10,
                    border: 'none',
                    background: FT.barkAlpha06,
                    color: FT.ink,
                    fontFamily: SFR,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 32 }} />
      <HomeIndicator />
    </ScreenShell>
  )
}
