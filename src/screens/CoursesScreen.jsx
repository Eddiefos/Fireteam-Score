import { useState, useEffect } from 'react'
import { FT, SFR, MONO } from '../constants/colors'
import { ScreenShell } from '../components/layout/ScreenShell'
import {
  StatusBar, HomeIndicator,
  IconArrowBack, IconTrash, IconPlus, IconMapPin, IconBadge, EmptyState,
} from '../components/atoms'
import { useCourses } from '../hooks/useCourses'
import { useRecentCourses } from '../hooks/useRecentCourses'
import { totalPar } from '../lib/gameLogic'
import { formatLastPlayed } from '../lib/formatDate'

// ────────────────────────────────────────────────────────────────────────
//  Tiny modal (for confirms)
// ────────────────────────────────────────────────────────────────────────
function Modal({ open, title, body, confirmLabel = 'OK', cancelLabel = 'Cancel', onConfirm, onCancel, danger = false }) {
  if (!open) return null;
  return (
    <div onClick={onCancel} style={{
      position: 'absolute', inset: 0, background: FT.inkAlpha45,
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
            background: FT.barkAlpha08, color: FT.ink,
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

// ────────────────────────────────────────────────────────────────────────
//  TopBar — inlined (will move to atoms in a future task)
// ────────────────────────────────────────────────────────────────────────
function TopBar({ onBack, label, right }) {
  return (
    <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
      {onBack ? (
        <button onClick={onBack} className="flat" aria-label="Back" style={{
          width: 44, height: 44, borderRadius: 12, background: FT.paper,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${FT.hair}`,
        }}><IconArrowBack color={FT.ink} size={18} /></button>
      ) : <div style={{ width: 44 }} />}
      {label && <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: FT.dim }}>{label}</div>}
      {right || <div style={{ width: 44 }} />}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
//  Course Library — manage saved courses
// ────────────────────────────────────────────────────────────────────────
function CoursesScreen({ go, userId, onToast = () => {} }) {
  const { courses, loading, deleteCourse } = useCourses(userId, true)
  const [confirmDel, setConfirmDel] = useState(null)
  const [filter, setFilter] = useState('recent')
  const chips = ['recent', 'official', 'mine']
  const chipLabels = { recent: 'Recent', official: 'Official', mine: 'My Courses' }

  const { recentCourses, loading: recentLoading } = useRecentCourses(userId)

  const remove = async (id) => {
    try {
      await deleteCourse(id)
      setConfirmDel(null)
      onToast('Course deleted')
    } catch {
      setConfirmDel(null)
      onToast('Failed to delete course')
    }
  }

  if (loading) {
    return (
      <ScreenShell label="Course Library">
        <StatusBar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: FT.orange, opacity: 0.8 }} />
        </div>
      </ScreenShell>
    )
  }

  return (
    <ScreenShell label="Course Library">
      <StatusBar />
      <TopBar onBack={() => go('home')} label="COURSE LIBRARY" />

      <div style={{ padding: '8px 24px 16px' }}>
        <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 36, letterSpacing: -1.2, lineHeight: 1 }}>
          Course Library.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '0 14px 12px', overflowX: 'auto' }}>
        {chips.map(c => (
          <button
            key={c}
            onClick={() => {
              if (c === 'official') { go('officialCourses'); return }
              setFilter(c)
            }}
            style={{
              height: 44, padding: '0 16px', borderRadius: 22, fontSize: 13, fontWeight: filter === c ? 600 : 500,
              whiteSpace: 'nowrap', border: `1px solid ${filter === c && c !== 'official' ? FT.forest : FT.hair}`,
              background: filter === c && c !== 'official' ? FT.forest : FT.paper,
              color: filter === c && c !== 'official' ? FT.cream : FT.dim,
              cursor: 'pointer'
            }}
          >
            {chipLabels[c]}
          </button>
        ))}
      </div>

      <div className="ft-scroll">
        {filter === 'recent' && (
          <div style={{ padding: '0 10px' }}>
            {recentLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: FT.orange, opacity: 0.8 }} />
              </div>
            ) : recentCourses.length === 0 ? (
              <EmptyState
                icon={<IconBadge bg={FT.forest}><IconMapPin color={FT.cream} size={18} /></IconBadge>}
                title="No rounds played yet"
                body="Finish a round and your recent courses will appear here."
              />
            ) : (
              recentCourses.map(rc => (
                <div key={rc.courseId} style={{
                  background: FT.paper, border: `1px solid ${FT.hair}`,
                  borderRadius: 20, padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6,
                }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 14, background: FT.forest,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: SFR, fontWeight: 900, fontSize: 14, color: FT.cream, flexShrink: 0,
                  }}>
                    {rc.pars.length}H
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 16, color: FT.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {rc.courseName}
                    </div>
                    <div style={{ fontSize: 13, color: FT.dim, marginTop: 2 }}>
                      Par {totalPar(rc.pars)} · {formatLastPlayed(rc.lastPlayedAt)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {filter === 'mine' && (
        <div style={{ padding: '0 20px' }}>
          {courses.length === 0 ? (
            <EmptyState icon={<IconBadge bg={FT.forest}><IconMapPin color={FT.cream} size={18} /></IconBadge>} title="No courses yet"
              body="Add your first course — give it a name and dial in the par for each hole." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {courses.map((c) => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  background: FT.paper, borderRadius: 20, padding: '14px 16px',
                  border: `1px solid ${FT.hair}`,
                }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 14, background: FT.forest,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: SFR, fontWeight: 900, fontSize: 14, color: FT.cream,
                  }}>{c.pars.length}H</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: SFR, fontWeight: 600, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                    <div style={{ fontSize: 13, color: FT.dim, marginTop: 1 }}>Par {totalPar(c.pars)} · {c.pars.length} holes</div>
                  </div>
                  <button onClick={() => go('newCourse', { courseId: c.id })} className="flat" style={{
                    width: 44, height: 44, borderRadius: 12, border: 'none',
                    background: FT.barkAlpha06, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: SFR, fontWeight: 600, fontSize: 13, color: FT.dim,
                  }}>Edit</button>
                  <button onClick={() => setConfirmDel(c)} className="flat" aria-label="Delete course" style={{
                    width: 44, height: 44, borderRadius: 12, border: 'none',
                    background: FT.barkAlpha06, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}><IconTrash /></button>
                </div>
              ))}
            </div>
          )}
        </div>
        )}
      </div>

      <div style={{ padding: '12px 20px 28px', flexShrink: 0,
        background: `linear-gradient(to top, ${FT.cream} 60%, ${FT.creamAlpha00})` }}>
        <button onClick={() => go('newCourse')} style={{
          width: '100%', height: 60, borderRadius: 18, border: 'none',
          background: FT.orange, color: FT.ink,
          fontFamily: SFR, fontWeight: 900, fontSize: 17, letterSpacing: -0.3,
          boxShadow: `0 6px 0 ${FT.shadowDark}, 0 14px 24px ${FT.orangeAlpha35}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}><IconPlus /> Add a course</button>
      </div>

      <Modal open={!!confirmDel}
        title="Delete course?"
        body={confirmDel ? `"${confirmDel.name}" will be removed. Past rounds played here will keep their saved scores.` : ''}
        confirmLabel="Delete" danger
        onCancel={() => setConfirmDel(null)}
        onConfirm={() => remove(confirmDel.id)} />

      <HomeIndicator />
    </ScreenShell>
  );
}

// ────────────────────────────────────────────────────────────────────────
//  New / Edit Course
// ────────────────────────────────────────────────────────────────────────
function NewCourseScreen({ go, params, userId, onToast = () => {} }) {
  const { courses, loading, createCourse, updateCourse } = useCourses(userId, true)

  // Hooks first (always called)
  const [name, setName] = useState('')
  const [holeCount, setHoleCount] = useState(18)
  const [pars, setPars] = useState(() => Array(18).fill(3))

  // Derive editing after hooks
  const editing = !loading && params.courseId ? courses.find((c) => c.id === params.courseId) : null

  // Sync name/holeCount/pars to editing once loaded
  useEffect(() => {
    if (editing) {
      setName(editing.name)
      setHoleCount(editing.pars.length)
      setPars([...editing.pars])
    }
  }, [editing?.id]) // eslint-disable-line

  // sync pars when holeCount changes (preserve existing values)
  useEffect(() => {
    setPars((prev) => {
      if (prev.length === holeCount) return prev;
      if (prev.length < holeCount) return [...prev, ...Array(holeCount - prev.length).fill(3)];
      return prev.slice(0, holeCount);
    });
  }, [holeCount]);

  if (loading) {
    return (
      <ScreenShell label="New Course">
        <StatusBar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: FT.orange, opacity: 0.8 }} />
        </div>
      </ScreenShell>
    )
  }

  const setPar = (i, v) => {
    v = Math.max(2, Math.min(7, v));
    setPars((prev) => prev.map((p, idx) => idx === i ? v : p));
  };

  const canSave = name.trim() && pars.length >= 1 && pars.every((p) => p >= 2);

  const save = async () => {
    if (!canSave) return;
    try {
      if (editing) {
        await updateCourse(editing.id, { name: name.trim(), pars: [...pars] })
        onToast('Course updated')
      } else {
        await createCourse({ name: name.trim(), pars: [...pars] })
        onToast('Course saved')
      }
      go(params.returnTo || 'courses')
    } catch (err) {
      onToast('Failed to save course')
    }
  };

  return (
    <ScreenShell label="New Course">
      <StatusBar />
      <TopBar onBack={() => go(params.returnTo || 'courses')} label={editing ? 'EDIT COURSE' : 'NEW COURSE'} />

      <div style={{ padding: '8px 24px 14px' }}>
        <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 36, letterSpacing: -1.2, lineHeight: 1 }}>
          {editing ? 'Edit course.' : 'New course.'}
        </div>
      </div>

      <div className="ft-scroll">
        <div style={{ padding: '0 20px 14px' }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: FT.dim, marginBottom: 6 }}>NAME</div>
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Bear Creek"
            style={{
              width: '100%', height: 54, padding: '0 16px',
              background: FT.paper, border: `2px solid ${FT.hair}`, borderRadius: 14,
              fontFamily: SFR, fontWeight: 800, fontSize: 18, color: FT.ink,
              outline: 'none',
            }}
            onFocus={(e) => e.target.style.borderColor = FT.orange}
            onBlur={(e) => e.target.style.borderColor = FT.hair}
          />
        </div>

        <div style={{ padding: '0 20px 14px' }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: FT.dim, marginBottom: 8 }}>HOLE COUNT</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[9, 12, 18, 24].map((n) => {
              const sel = holeCount === n;
              return (
                <button key={n} onClick={() => setHoleCount(n)} className="flat" style={{
                  height: 50, borderRadius: 12, border: 'none',
                  background: sel ? FT.forest : FT.paper,
                  color: sel ? FT.cream : FT.ink,
                  fontFamily: SFR, fontWeight: 900, fontSize: 16,
                  border: sel ? `2px solid ${FT.forest}` : `1px solid ${FT.hair}`,
                }}>{n}</button>
              );
            })}
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: FT.dim }}>or custom:</span>
            <input type="number" min="1" max="36" value={holeCount}
              onChange={(e) => setHoleCount(Math.max(1, Math.min(36, parseInt(e.target.value) || 1)))}
              style={{
                width: 70, height: 36, padding: '0 10px',
                background: FT.paper, border: `1px solid ${FT.hair}`, borderRadius: 10,
                fontFamily: SFR, fontWeight: 800, fontSize: 15, color: FT.ink, outline: 'none',
                textAlign: 'center',
              }} />
          </div>
        </div>

        <div style={{ padding: '6px 20px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: FT.dim }}>PAR PER HOLE</div>
            <div style={{ fontFamily: SFR, fontWeight: 800, fontSize: 13, color: FT.ink }}>Total: {totalPar(pars)}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: 6 }}>
            {pars.map((p, i) => (
              <div key={i} style={{
                background: FT.paper, borderRadius: 12,
                border: `1px solid ${FT.hair}`,
                padding: '6px 4px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                minWidth: 0,
              }}>
                <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1, color: FT.dim }}>{i + 1}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', justifyContent: 'space-between' }}>
                  <button onClick={() => setPar(i, p - 1)} className="flat" style={{
                    width: 18, height: 24, borderRadius: 6, border: 'none', flexShrink: 0,
                    background: FT.barkAlpha07, color: FT.ink,
                    fontFamily: SFR, fontWeight: 900, fontSize: 13, padding: 0,
                  }}>–</button>
                  <span style={{ fontFamily: SFR, fontWeight: 900, fontSize: 17, textAlign: 'center', minWidth: 0, flex: 1 }}>{p}</span>
                  <button onClick={() => setPar(i, p + 1)} className="flat" style={{
                    width: 18, height: 24, borderRadius: 6, border: 'none', flexShrink: 0,
                    background: FT.barkAlpha07, color: FT.ink,
                    fontFamily: SFR, fontWeight: 900, fontSize: 13, padding: 0,
                  }}>+</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 20px 28px', flexShrink: 0,
        background: `linear-gradient(to top, ${FT.cream} 60%, ${FT.creamAlpha00})` }}>
        <button onClick={save} disabled={!canSave} style={{
          width: '100%', height: 60, borderRadius: 18, border: 'none',
          background: canSave ? FT.orange : FT.barkAlpha15,
          color: canSave ? FT.ink : FT.dim,
          fontFamily: SFR, fontWeight: 900, fontSize: 19, letterSpacing: -0.3,
          boxShadow: canSave ? `0 6px 0 ${FT.shadowDark}, 0 14px 24px ${FT.orangeAlpha35}` : 'none',
        }}>{editing ? 'Save changes' : 'Save course'}</button>
      </div>
      <HomeIndicator />
    </ScreenShell>
  );
}

export { CoursesScreen, NewCourseScreen }
