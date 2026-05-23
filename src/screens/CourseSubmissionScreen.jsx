import { useState } from 'react'
import { FT, SFR, MONO } from '../constants/colors'
import { StatusBar, HomeIndicator, IconArrowBack } from '../components/atoms'
import { ScreenShell } from '../components/layout/ScreenShell'
import { submitCourse } from '../services/courses'

export function CourseSubmissionScreen({ go, userId, onToast }) {
  const [form, setForm] = useState({ name: '', location: '', holes: '18', notes: '' })
  const [submitting, setSubmitting] = useState(false)

  const update = (field, val) => setForm(prev => ({ ...prev, [field]: val }))

  const handleSubmit = async () => {
    if (!form.name.trim()) { onToast?.('Course name is required'); return }
    const holesNum = parseInt(form.holes, 10)
    if (!holesNum || holesNum < 1 || holesNum > 36) {
      onToast?.('Holes must be between 1 and 36')
      return
    }
    setSubmitting(true)
    try {
      await submitCourse(userId, {
        name: form.name.trim(),
        location: form.location.trim() || null,
        lat: null,
        lng: null,
        holes: holesNum,
        holes_detail: null,
        notes: form.notes.trim() || null,
      })
      onToast?.('Course submitted! We\'ll review it soon.')
      go('officialCourses')
    } catch {
      onToast?.('Submission failed. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const labelStyle = {
    fontFamily: MONO,
    fontSize: 10,
    color: FT.dim,
    letterSpacing: 2,
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: 6,
  }

  const inputStyle = {
    width: '100%',
    height: 44,
    background: FT.paper,
    border: `1px solid ${FT.hair}`,
    borderRadius: 12,
    padding: '0 14px',
    fontSize: 16,
    color: FT.ink,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: '-apple-system, SF Pro Display, system-ui, sans-serif',
  }

  return (
    <ScreenShell>
      <StatusBar />

      {/* Nav header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 0' }}>
        <button
          aria-label="Back"
          onClick={() => go('officialCourses')}
          style={{ width: 44, height: 44, borderRadius: 12, background: FT.paper, border: `1px solid ${FT.hair}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        ><IconArrowBack color={FT.ink} size={18} /></button>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: FT.dim }}>SUBMIT COURSE</span>
        <div style={{ width: 44 }} />
      </div>

      {/* Heading */}
      <div style={{ padding: '8px 20px 4px' }}>
        <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1.2, color: FT.ink, lineHeight: 1.05, fontFamily: SFR, margin: 0 }}>
          Submit a Course.
        </h1>
      </div>

      {/* Subtitle */}
      <div style={{ padding: '0 20px 20px' }}>
        <p style={{ fontSize: 13, color: FT.dim, lineHeight: 1.45, margin: 0 }}>
          Found a course we're missing? Fill in what you know — we'll review and add it.
        </p>
      </div>

      {/* Form */}
      <div style={{ flex: 1, padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Course name */}
        <div>
          <label style={labelStyle}>Course Name <span style={{ color: FT.orange }}>*</span></label>
          <input
            type="text"
            value={form.name}
            onChange={e => update('name', e.target.value)}
            placeholder="e.g. Bølgane Frisbeegolfpark"
            style={inputStyle}
          />
        </div>

        {/* Location */}
        <div>
          <label style={labelStyle}>Location <span style={{ color: FT.dim, fontSize: 8, letterSpacing: 1 }}>optional</span></label>
          <input
            type="text"
            value={form.location}
            onChange={e => update('location', e.target.value)}
            placeholder="e.g. Kristiansand"
            style={inputStyle}
          />
        </div>

        {/* Number of holes */}
        <div>
          <label style={labelStyle}>Number of Holes <span style={{ color: FT.dim, fontSize: 8, letterSpacing: 1 }}>optional</span></label>
          <input
            type="number"
            min={1}
            max={36}
            value={form.holes}
            onChange={e => update('holes', e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Notes */}
        <div>
          <label style={labelStyle}>Notes <span style={{ color: FT.dim, fontSize: 8, letterSpacing: 1 }}>optional</span></label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={e => update('notes', e.target.value)}
            placeholder="Any extra info — tee layout, basket count, park name…"
            style={{ ...inputStyle, height: 'auto', padding: '10px 14px', resize: 'vertical', lineHeight: 1.4 }}
          />
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            width: '100%',
            height: 56,
            borderRadius: 18,
            border: 'none',
            background: submitting ? 'rgba(42,31,23,0.15)' : FT.orange,
            color: submitting ? FT.dim : FT.ink,
            fontFamily: SFR,
            fontWeight: 700,
            fontSize: 17,
            cursor: submitting ? 'not-allowed' : 'pointer',
            marginTop: 4,
          }}
        >
          {submitting ? 'Submitting…' : 'Submit Course'}
        </button>
      </div>

      <div style={{ height: 32 }} />
      <HomeIndicator />
    </ScreenShell>
  )
}
