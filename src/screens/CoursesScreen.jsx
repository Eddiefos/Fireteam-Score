import { useState, useEffect } from 'react'
import { FT, SFR, SF, MONO } from '../constants/colors'
import { ScreenShell } from '../components/layout/ScreenShell'
import {
  StatusBar, HomeIndicator, ParChip,
  IconChevronLeft, IconTrash, IconPlus, EmptyState,
} from '../components/atoms'
import { useCourses } from '../hooks/useCourses'
import { totalPar } from '../lib/gameLogic'

// ────────────────────────────────────────────────────────────────────────
//  Tiny modal (for confirms)
// ────────────────────────────────────────────────────────────────────────
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

// ────────────────────────────────────────────────────────────────────────
//  TopBar — inlined (will move to atoms in a future task)
// ────────────────────────────────────────────────────────────────────────
function TopBar({ onBack, label, right }) {
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
  );
}

// ────────────────────────────────────────────────────────────────────────
//  Courses list — manage saved courses
// ────────────────────────────────────────────────────────────────────────
function CoursesScreen({ go, userId, onToast = () => {} }) {
  const { courses, loading, deleteCourse } = useCourses(userId)
  const [confirmDel, setConfirmDel] = useState(null)

  const remove = async (id) => {
    await deleteCourse(id)
    setConfirmDel(null)
    onToast('Course deleted')
  }

  return (
    <ScreenShell label="Courses">
      <StatusBar />
      <TopBar onBack={() => go('home')} label={`${courses.length} SAVED`} />

      <div style={{ padding: '6px 24px 16px' }}>
        <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 34, letterSpacing: -1.2, lineHeight: 1 }}>
          Your courses.
        </div>
      </div>

      <div className="ft-scroll">
        <div style={{ padding: '0 20px' }}>
          {courses.length === 0 ? (
            <EmptyState icon="🌲" title="No courses yet"
              body="Add your first course — give it a name and dial in the par for each hole." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {courses.map((c) => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  background: FT.paper, borderRadius: 16, padding: '14px 16px',
                  border: `1px solid ${FT.hair}`,
                }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 14, background: FT.forest,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: SFR, fontWeight: 900, fontSize: 14, color: FT.cream,
                  }}>{c.pars.length}H</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 17, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: FT.dim, marginTop: 1 }}>Par {totalPar(c.pars)} · {c.pars.length} holes</div>
                  </div>
                  <button onClick={() => go('newCourse', { courseId: c.id })} className="flat" style={{
                    width: 32, height: 32, borderRadius: 10, border: 'none',
                    background: 'rgba(42,31,23,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: SFR, fontWeight: 800, fontSize: 11, color: FT.dim,
                  }}>Edit</button>
                  <button onClick={() => setConfirmDel(c)} className="flat" style={{
                    width: 32, height: 32, borderRadius: 10, border: 'none',
                    background: 'rgba(42,31,23,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}><IconTrash /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '12px 20px 28px', flexShrink: 0,
        background: 'linear-gradient(to top, rgba(244,239,228,1) 60%, rgba(244,239,228,0))' }}>
        <button onClick={() => go('newCourse')} style={{
          width: '100%', height: 60, borderRadius: 18, border: 'none',
          background: FT.orange, color: FT.ink,
          fontFamily: SFR, fontWeight: 900, fontSize: 17, letterSpacing: -0.3,
          boxShadow: '0 6px 0 rgba(0,0,0,0.22), 0 14px 24px rgba(255,107,31,0.35)',
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
  const { courses, createCourse, updateCourse } = useCourses(userId)
  const editing = params.courseId ? courses.find((c) => c.id === params.courseId) : null

  const [name, setName] = useState(editing ? editing.name : '')
  const [holeCount, setHoleCount] = useState(editing ? editing.pars.length : 18)
  const [pars, setPars] = useState(() => editing ? [...editing.pars] : Array(18).fill(3))

  // sync pars when holeCount changes (preserve existing values)
  useEffect(() => {
    setPars((prev) => {
      if (prev.length === holeCount) return prev;
      if (prev.length < holeCount) return [...prev, ...Array(holeCount - prev.length).fill(3)];
      return prev.slice(0, holeCount);
    });
  }, [holeCount]);

  const setPar = (i, v) => {
    v = Math.max(2, Math.min(7, v));
    setPars((prev) => prev.map((p, idx) => idx === i ? v : p));
  };

  const canSave = name.trim() && pars.length >= 1 && pars.every((p) => p >= 2);

  const save = async () => {
    if (!canSave) return;
    if (editing) {
      await updateCourse(editing.id, { name: name.trim(), pars: [...pars] })
      onToast('Course updated')
    } else {
      await createCourse({ name: name.trim(), pars: [...pars] })
      onToast('Course saved')
    }
    go('courses')
  };

  return (
    <ScreenShell label="New Course">
      <StatusBar />
      <TopBar onBack={() => go('courses')} label={editing ? 'EDIT COURSE' : 'NEW COURSE'} />

      <div style={{ padding: '6px 24px 14px' }}>
        <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 34, letterSpacing: -1.2, lineHeight: 1 }}>
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
                    background: 'rgba(42,31,23,0.07)', color: FT.ink,
                    fontFamily: SFR, fontWeight: 900, fontSize: 13, padding: 0,
                  }}>–</button>
                  <span style={{ fontFamily: SFR, fontWeight: 900, fontSize: 17, textAlign: 'center', minWidth: 0, flex: 1 }}>{p}</span>
                  <button onClick={() => setPar(i, p + 1)} className="flat" style={{
                    width: 18, height: 24, borderRadius: 6, border: 'none', flexShrink: 0,
                    background: 'rgba(42,31,23,0.07)', color: FT.ink,
                    fontFamily: SFR, fontWeight: 900, fontSize: 13, padding: 0,
                  }}>+</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 20px 28px', flexShrink: 0,
        background: 'linear-gradient(to top, rgba(244,239,228,1) 60%, rgba(244,239,228,0))' }}>
        <button onClick={save} disabled={!canSave} style={{
          width: '100%', height: 60, borderRadius: 18, border: 'none',
          background: canSave ? FT.orange : 'rgba(42,31,23,0.15)',
          color: canSave ? FT.ink : FT.dim,
          fontFamily: SFR, fontWeight: 900, fontSize: 19, letterSpacing: -0.3,
          boxShadow: canSave ? '0 6px 0 rgba(0,0,0,0.22), 0 14px 24px rgba(255,107,31,0.35)' : 'none',
        }}>{editing ? 'Save changes' : 'Save course'}</button>
      </div>
      <HomeIndicator />
    </ScreenShell>
  );
}

export { CoursesScreen, NewCourseScreen }
