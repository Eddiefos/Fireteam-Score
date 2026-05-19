import { useState, useEffect, useMemo, useRef, useCallback } from 'react';


// ────────────────────────────────────────────────────────────────────────
//  Palette + type — taken from the design
// ────────────────────────────────────────────────────────────────────────
const FT = {
  forest: '#1F3D2B',
  moss:   '#3A5A40',
  fern:   '#588157',
  cream:  '#F4EFE4',
  paper:  '#FAF6EC',
  bark:   '#2A1F17',
  ink:    '#15110D',
  orange: '#FF6B1F',
  amber:  '#FFB627',
  sky:    '#4A7CB6',
  rose:   '#E5556A',
  dim:    'rgba(42,31,23,0.55)',
  hair:   'rgba(42,31,23,0.12)',
};
const PLAYER_COLORS = [FT.orange, FT.fern, FT.amber, FT.sky, FT.rose, FT.bark];

const SF  = '-apple-system, "SF Pro Display", "SF Pro Text", system-ui, sans-serif';
const SFR = '-apple-system, "SF Pro Rounded", "SF Pro Display", system-ui, sans-serif';
const MONO = '"SF Mono", ui-monospace, Menlo, monospace';

// ────────────────────────────────────────────────────────────────────────
//  Storage layer — wraps localStorage with namespaced keys + JSON helpers
// ────────────────────────────────────────────────────────────────────────
const KEY = {
  courses: 'ft_courses_v1',
  rounds:  'ft_rounds_v1',
  current: 'ft_current_round_v1',
  user:    'ft_user_name_v1',
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const storage = {
  read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      console.warn('storage.read failed', key, e);
      return fallback;
    }
  },
  write(key, value) {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('storage.write failed', key, e);
    }
  },
};

// Reactive store — tiny pubsub so screens stay in sync after writes
function makeStore() {
  const state = {
    courses: storage.read(KEY.courses, []),
    rounds:  storage.read(KEY.rounds, []),
    current: storage.read(KEY.current, null),
    user:    storage.read(KEY.user, ''),
  };
  const subs = new Set();
  const emit = () => subs.forEach((fn) => fn());
  return {
    get: () => state,
    sub: (fn) => { subs.add(fn); return () => subs.delete(fn); },
    setCourses: (next) => { state.courses = next; storage.write(KEY.courses, next); emit(); },
    setRounds:  (next) => { state.rounds  = next; storage.write(KEY.rounds, next);  emit(); },
    setCurrent: (next) => { state.current = next; storage.write(KEY.current, next); emit(); },
    setUser:    (next) => { state.user    = next; storage.write(KEY.user, next);    emit(); },
  };
}
const store = makeStore();

function useStore() {
  const [, setT] = useState(0);
  useEffect(() => store.sub(() => setT((t) => t + 1)), []);
  return store.get();
}

// ────────────────────────────────────────────────────────────────────────
//  Domain helpers
// ────────────────────────────────────────────────────────────────────────
const initialsOf = (name) => {
  if (!name) return '··';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const totalPar = (pars) => pars.reduce((a, b) => a + (b || 0), 0);

const playerTotal = (round, playerId, throughHole = null) => {
  const arr = (round.scores && round.scores[playerId]) || [];
  const upTo = throughHole == null ? arr.length : throughHole;
  let sum = 0;
  for (let i = 0; i < upTo; i++) {
    const v = arr[i];
    if (typeof v === 'number') sum += v;
  }
  return sum;
};

const playerVsPar = (round, playerId, throughHole = null) => {
  const arr = (round.scores && round.scores[playerId]) || [];
  const upTo = throughHole == null ? arr.length : throughHole;
  let v = 0;
  for (let i = 0; i < upTo; i++) {
    const s = arr[i];
    if (typeof s === 'number') v += s - (round.pars[i] || 0);
  }
  return v;
};

const holesCompleted = (round) => {
  if (!round || !round.scores) return 0;
  const playerIds = round.players.map((p) => p.id);
  let n = round.pars.length;
  for (let i = 0; i < round.pars.length; i++) {
    if (!playerIds.every((pid) => typeof (round.scores[pid] || [])[i] === 'number')) {
      n = i; break;
    }
  }
  return n;
};

const isRoundComplete = (round) => round && holesCompleted(round) === round.pars.length;

const winnerOf = (round) => {
  if (!round || !round.players.length) return null;
  let best = round.players[0];
  let bestScore = playerTotal(round, best.id);
  for (let i = 1; i < round.players.length; i++) {
    const p = round.players[i];
    const s = playerTotal(round, p.id);
    if (s < bestScore) { best = p; bestScore = s; }
  }
  return best;
};

const formatDate = (ts) => {
  const d = new Date(ts);
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${days[d.getDay()]} · ${months[d.getMonth()]} ${d.getDate()}`;
};
const formatShortDate = (ts) => {
  const d = new Date(ts);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
};
const formatDuration = (ms) => {
  if (!ms || ms < 0) return '—';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};
const liveTimer = (startedAt) => {
  const ms = Math.max(0, Date.now() - startedAt);
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

// ────────────────────────────────────────────────────────────────────────
//  Stats — player aggregates across all completed rounds
// ────────────────────────────────────────────────────────────────────────
function computePlayerStats(rounds, playerName) {
  const completed = rounds.filter((r) => r.completedAt);
  const mine = completed.filter((r) => r.players.some((p) => p.name === playerName));
  let totalVs = 0, totalRounds = 0, birdies = 0, wins = 0;
  const perCourse = {};
  const h2h = {}; // opponentName → {w,l,t,last}
  for (const r of mine) {
    const me = r.players.find((p) => p.name === playerName);
    if (!me) continue;
    const myScore = playerTotal(r, me.id);
    const myVs = playerVsPar(r, me.id);
    totalVs += myVs;
    totalRounds += 1;
    // birdies
    const myArr = r.scores[me.id] || [];
    for (let i = 0; i < myArr.length; i++) {
      if (typeof myArr[i] === 'number' && myArr[i] - r.pars[i] <= -1) birdies += 1;
    }
    // wins
    let isWinner = true;
    for (const p of r.players) {
      if (p.id === me.id) continue;
      if (playerTotal(r, p.id) <= myScore - 0.0001) { isWinner = false; }
    }
    // tie-aware: only call it a win if strictly less than all others
    let strictlyBest = true;
    for (const p of r.players) {
      if (p.id === me.id) continue;
      if (playerTotal(r, p.id) <= myScore) strictlyBest = false;
    }
    if (strictlyBest) wins += 1;

    // per course
    const ck = r.courseId || ('name:' + r.courseName);
    if (!perCourse[ck]) perCourse[ck] = { courseName: r.courseName, rounds: 0, sumVs: 0, best: null };
    perCourse[ck].rounds += 1;
    perCourse[ck].sumVs += myVs;
    if (perCourse[ck].best == null || myScore < perCourse[ck].best) perCourse[ck].best = myScore;

    // head to head
    for (const p of r.players) {
      if (p.id === me.id) continue;
      const opp = h2h[p.name] || { w: 0, l: 0, t: 0, last: '–' };
      const oppScore = playerTotal(r, p.id);
      if (myScore < oppScore) { opp.w += 1; opp.last = 'W'; }
      else if (myScore > oppScore) { opp.l += 1; opp.last = 'L'; }
      else { opp.t += 1; opp.last = 'T'; }
      h2h[p.name] = opp;
    }
  }
  return {
    totalRounds,
    avgVs: totalRounds ? totalVs / totalRounds : 0,
    birdies,
    wins,
    winPct: totalRounds ? Math.round((wins / totalRounds) * 100) : 0,
    perCourse: Object.values(perCourse).map((c) => ({ ...c, avgVs: c.sumVs / c.rounds })),
    h2h: Object.entries(h2h).map(([name, v]) => ({ name, ...v })),
  };
}

// ────────────────────────────────────────────────────────────────────────
//  Shared atoms (StatusBar, ParChip, TopoBg, Disc, Avatar, Pip)
// ────────────────────────────────────────────────────────────────────────
// Spacer that respects iOS safe area at the top (notch / Dynamic Island).
// The previous design used a fake status bar — the real OS chrome handles that now.
function StatusBar() {
  return <div style={{ height: 'env(safe-area-inset-top, 0px)', flexShrink: 0 }} />;
}

// Real iOS home indicator handles itself — render nothing.
function HomeIndicator() { return null; }

function TopoBg({ color = 'rgba(255,255,255,0.08)', opacity = 1 }) {
  return (
    <svg viewBox="0 0 380 320" preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity, pointerEvents: 'none' }}>
      {[0, 18, 36, 54, 72, 90, 108, 126, 144, 162].map((r, i) => (
        <path key={i} d={`M -20 ${80 + r * 1.1} C 80 ${50 + r}, 180 ${130 + r}, 280 ${70 + r} S 420 ${110 + r}, 520 ${90 + r}`}
          stroke={color} strokeWidth={1} fill="none" />
      ))}
      {[0, 16, 32, 48, 64, 80, 96].map((r, i) => (
        <ellipse key={'e' + i} cx={300} cy={250} rx={60 + r * 1.4} ry={26 + r * 0.7}
          stroke={color} strokeWidth={1} fill="none" />
      ))}
    </svg>
  );
}

function ParChip({ value, size = 'md', tone }) {
  const v = value;
  const auto = tone || (v < 0 ? 'birdie' : v === 0 ? 'par' : v === 1 ? 'bogey' : 'overbogey');
  const palette = {
    birdie:    { bg: FT.orange, fg: FT.ink },
    par:       { bg: 'rgba(42,31,23,0.08)', fg: FT.ink },
    bogey:     { bg: 'rgba(42,31,23,0.85)', fg: FT.cream },
    overbogey: { bg: FT.bark, fg: FT.cream },
  }[auto];
  const sizes = {
    sm: { h: 22, fs: 12, pad: '0 7px',  r: 6 },
    md: { h: 28, fs: 14, pad: '0 10px', r: 8 },
    lg: { h: 36, fs: 17, pad: '0 12px', r: 10 },
  }[size];
  const txt = v === 0 ? 'E' : v > 0 ? `+${v}` : `${v}`;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      height: sizes.h, padding: sizes.pad, borderRadius: sizes.r,
      background: palette.bg, color: palette.fg,
      fontFamily: SFR, fontWeight: 800, fontSize: sizes.fs,
      letterSpacing: -0.2, fontVariantNumeric: 'tabular-nums', flexShrink: 0,
    }}>{txt}</span>
  );
}

function Avatar({ name, color, size = 32, fontSize, border }) {
  const s = size;
  return (
    <div style={{
      width: s, height: s, borderRadius: Math.round(s * 0.34),
      background: color, color: FT.ink,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: SFR, fontWeight: 900, fontSize: fontSize || Math.round(s * 0.35),
      flexShrink: 0,
      border: border || 'none',
    }}>{initialsOf(name)}</div>
  );
}

function ScreenShell({ children, bg = FT.cream, dark = false, label }) {
  return (
    <div data-screen={label} style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: bg, color: dark ? FT.cream : FT.ink,
      position: 'relative', overflow: 'hidden',
    }}>{children}</div>
  );
}

function IconChevronLeft({ color = FT.ink, size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function IconChevronRight({ color = FT.dim, size = 11 }) {
  return <svg width={Math.round(size * 7/11)} height={size} viewBox="0 0 7 11" fill="none"><path d="M1 1l4 4.5L1 10" stroke={color} strokeWidth="1.6" strokeLinecap="round"/></svg>;
}
function IconArrow({ color = FT.ink, size = 22 }) {
  return <svg width={size} height={size} viewBox="0 0 22 22" fill="none"><path d="M5 11h12M12 5l6 6-6 6" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function IconClose({ color = FT.dim, size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke={color} strokeWidth="2" strokeLinecap="round"/></svg>;
}
function IconPlus({ color = FT.ink, size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke={color} strokeWidth="2.2" strokeLinecap="round"/></svg>;
}
function IconCheck({ color = FT.forest, size = 12 }) {
  return <svg width={size} height={Math.round(size * 9/12)} viewBox="0 0 12 9" fill="none"><path d="M1 4l3.5 3.5L11 1" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function IconTrash({ color = FT.dim, size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path d="M3 4h10M6 4V2.5A.5.5 0 016.5 2h3a.5.5 0 01.5.5V4M5 4l.5 9a1 1 0 001 1h3a1 1 0 001-1L11 4" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}
function IconHamburger({ color = FT.cream, size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 14 14" fill="none"><path d="M3 3h8M3 7h8M3 11h5" stroke={color} strokeWidth="2" strokeLinecap="round"/></svg>;
}

function Pill({ children, dark = false, onClick, style }) {
  return (
    <button onClick={onClick} className="flat" style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 30, padding: '0 12px', borderRadius: 999,
      border: 'none',
      background: dark ? 'rgba(244,239,228,0.12)' : 'rgba(42,31,23,0.07)',
      color: dark ? FT.cream : FT.ink,
      fontFamily: SF, fontWeight: 700, fontSize: 12,
      ...style,
    }}>{children}</button>
  );
}

function EmptyState({ icon, title, body, cta }) {
  return (
    <div className="fade-in" style={{
      margin: '14px 16px', padding: '28px 22px',
      background: FT.paper, borderRadius: 22,
      border: `1px dashed ${FT.hair}`,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontFamily: SFR, fontWeight: 800, fontSize: 18, letterSpacing: -0.3 }}>{title}</div>
      {body && <div style={{ fontSize: 13, color: FT.dim, marginTop: 6, lineHeight: 1.4 }}>{body}</div>}
      {cta}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
//  Tiny Toast — used for "round saved" etc.
// ────────────────────────────────────────────────────────────────────────
function useToast() {
  const [msg, setMsg] = useState(null);
  const show = useCallback((text) => {
    setMsg(text);
    setTimeout(() => setMsg((m) => (m === text ? null : m)), 1800);
  }, []);
  const node = msg ? (
    <div className="pop-in" style={{
      position: 'fixed', left: '50%', bottom: 110, transform: 'translateX(-50%)',
      background: FT.bark, color: FT.cream, padding: '10px 16px', borderRadius: 12,
      fontFamily: SFR, fontWeight: 700, fontSize: 13, zIndex: 100,
      boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
    }}>{msg}</div>
  ) : null;
  return { show, node };
}

// App-level toast portal — exposed so any screen can call it
let _toastFn = () => {};
const toast = (m) => _toastFn(m);

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
//  TopBar — used on most non-hero screens
// ────────────────────────────────────────────────────────────────────────
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
  );
}

// ────────────────────────────────────────────────────────────────────────
//  1. HOME
// ────────────────────────────────────────────────────────────────────────
function HomeScreen({ go }) {
  const { courses, rounds, current, user } = useStore();
  const completed = useMemo(() =>
    [...rounds].filter((r) => r.completedAt).sort((a, b) => b.completedAt - a.completedAt),
  [rounds]);
  const recent = completed.slice(0, 4);
  const namePrompt = !user;

  // collect a small avatar bar: distinct named players seen across all rounds, capped to 4
  const fireteam = useMemo(() => {
    const seen = new Map();
    for (const r of rounds) for (const p of r.players) if (!seen.has(p.name)) seen.set(p.name, p);
    if (user && !seen.has(user)) seen.set(user, { name: user, color: FT.orange });
    return [...seen.values()].slice(0, 4);
  }, [rounds, user]);

  return (
    <ScreenShell label="Home" bg={FT.cream}>
      <StatusBar />
      <div className="ft-scroll">
        {/* Hero block */}
        <div style={{ padding: '8px 24px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: FT.dim, textTransform: 'uppercase' }}>
                Fireteam · {fireteam.length || 0} {fireteam.length === 1 ? 'member' : 'members'}
              </div>
              <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 38, lineHeight: 0.95, marginTop: 6, letterSpacing: -1.5 }}>
                Hey,<br/>{user || 'friend'} 👋
              </div>
            </div>
            {fireteam.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {fireteam.map((p, i) => (
                  <div key={p.name} style={{ marginLeft: i ? -8 : 0 }}>
                    <Avatar name={p.name} color={p.color || PLAYER_COLORS[i % PLAYER_COLORS.length]}
                      size={32} fontSize={11} border={`2px solid ${FT.cream}`} />
                  </div>
                ))}
              </div>
            )}
          </div>
          {namePrompt && (
            <button onClick={() => go('settings')} className="flat" style={{
              marginTop: 12, padding: '8px 12px', borderRadius: 10, border: 'none',
              background: 'rgba(255,107,31,0.14)', color: FT.bark,
              fontFamily: SFR, fontWeight: 700, fontSize: 13,
            }}>Tap to set your name →</button>
          )}
        </div>

        {/* Resume in-progress round, if any */}
        {current && !isRoundComplete(current) && (
          <div style={{ padding: '0 20px 12px' }}>
            <button onClick={() => go('live')} className="flat" style={{
              width: '100%', textAlign: 'left', border: 'none',
              background: FT.bark, color: FT.cream, padding: '14px 16px', borderRadius: 16,
              display: 'flex', alignItems: 'center', gap: 12,
              boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, background: FT.orange,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><IconArrow color={FT.ink} size={18} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, opacity: 0.6 }}>RESUME · {current.courseName}</div>
                <div style={{ fontFamily: SFR, fontWeight: 800, fontSize: 16, marginTop: 2 }}>
                  Hole {Math.min(current.pars.length, holesCompleted(current) + 1)} of {current.pars.length}
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Big start CTA */}
        <div style={{ padding: '0 20px' }}>
          <button onClick={() => go('start')} className="flat" style={{
            width: '100%', position: 'relative', overflow: 'hidden',
            background: FT.forest, color: FT.cream, border: 'none',
            borderRadius: 24, padding: '24px 22px', textAlign: 'left',
            boxShadow: '0 12px 28px rgba(31,61,43,0.32), inset 0 -4px 0 rgba(0,0,0,0.18)',
          }}>
            <TopoBg color="rgba(244,239,228,0.09)" />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, opacity: 0.7, textTransform: 'uppercase' }}>Tap to begin</div>
                <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 32, lineHeight: 1, letterSpacing: -1, marginTop: 4 }}>
                  Start New Round
                </div>
              </div>
              <div style={{
                width: 56, height: 56, borderRadius: 28, background: FT.orange,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 6px 0 rgba(0,0,0,0.25)',
              }}><IconArrow /></div>
            </div>
          </button>
        </div>

        {/* Quick nav tiles */}
        <div style={{ padding: '14px 20px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button onClick={() => go('stats')} className="flat" style={{
            background: FT.paper, borderRadius: 18, padding: '14px 16px',
            border: `1px solid ${FT.hair}`, textAlign: 'left',
          }}>
            <div style={{ fontSize: 22, lineHeight: 1, marginBottom: 8 }}>📋</div>
            <div style={{ fontFamily: SFR, fontWeight: 800, fontSize: 17 }}>History</div>
            <div style={{ fontSize: 12, color: FT.dim, marginTop: 1 }}>{completed.length} {completed.length === 1 ? 'round' : 'rounds'}</div>
          </button>
          <button onClick={() => go('courses')} className="flat" style={{
            background: FT.paper, borderRadius: 18, padding: '14px 16px',
            border: `1px solid ${FT.hair}`, textAlign: 'left',
          }}>
            <div style={{ fontSize: 22, lineHeight: 1, marginBottom: 8 }}>🌲</div>
            <div style={{ fontFamily: SFR, fontWeight: 800, fontSize: 17 }}>Courses</div>
            <div style={{ fontSize: 12, color: FT.dim, marginTop: 1 }}>{courses.length} saved</div>
          </button>
        </div>

        {/* Recent rounds */}
        <div style={{ padding: '22px 20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: FT.dim, textTransform: 'uppercase' }}>Recent rounds</div>
            {completed.length > recent.length && (
              <button onClick={() => go('stats')} className="flat" style={{ background: 'none', border: 'none', fontSize: 13, color: FT.orange, fontWeight: 700, padding: 0 }}>See all</button>
            )}
          </div>
          {recent.length === 0 ? (
            <EmptyState icon="🥏" title="No rounds yet"
              body="Tap “Start New Round” above to log your first round." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recent.map((r) => {
                const w = winnerOf(r);
                const wVs = w ? playerVsPar(r, w.id) : 0;
                return (
                  <button key={r.id} onClick={() => go('round', { roundId: r.id })} className="flat" style={{
                    display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
                    background: FT.paper, borderRadius: 14, padding: '12px 14px',
                    border: `1px solid ${FT.hair}`, width: '100%',
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, background: FT.forest,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: SFR, fontWeight: 900, color: FT.cream, fontSize: 13,
                    }}>{r.pars.length}H</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 16, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.courseName}</div>
                      <div style={{ fontSize: 12, color: FT.dim, marginTop: 1 }}>
                        {formatDate(r.completedAt)} · {w ? `${w.name} took it` : 'tied'}
                      </div>
                    </div>
                    <ParChip value={wVs} size="md" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <HomeIndicator />
    </ScreenShell>
  );
}

// ────────────────────────────────────────────────────────────────────────
//  Settings (just a name field for now)
// ────────────────────────────────────────────────────────────────────────
function SettingsScreen({ go }) {
  const { user } = useStore();
  const [name, setName] = useState(user || '');
  const save = () => {
    store.setUser(name.trim());
    go('home');
  };
  return (
    <ScreenShell label="Settings">
      <StatusBar />
      <TopBar onBack={() => go('home')} label="YOU" />
      <div className="ft-scroll">
        <div style={{ padding: '6px 24px 16px' }}>
          <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 34, letterSpacing: -1.2, lineHeight: 1 }}>
            Who's<br/>throwing?
          </div>
          <div style={{ fontSize: 14, color: FT.dim, marginTop: 10, lineHeight: 1.4 }}>
            We'll greet you on the home screen and use this to track your stats.
          </div>
        </div>
        <div style={{ padding: '0 20px' }}>
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            style={{
              width: '100%', height: 60, padding: '0 18px',
              background: FT.paper, border: `2px solid ${FT.hair}`, borderRadius: 16,
              fontFamily: SFR, fontWeight: 800, fontSize: 22, color: FT.ink,
              outline: 'none',
            }}
            onFocus={(e) => e.target.style.borderColor = FT.orange}
            onBlur={(e) => e.target.style.borderColor = FT.hair}
          />
          <button onClick={save} disabled={!name.trim()} className="flat" style={{
            width: '100%', marginTop: 16, height: 56, borderRadius: 16, border: 'none',
            background: name.trim() ? FT.forest : 'rgba(42,31,23,0.15)',
            color: name.trim() ? FT.cream : FT.dim,
            fontFamily: SFR, fontWeight: 900, fontSize: 17, letterSpacing: -0.3,
          }}>Save</button>
        </div>
      </div>
      <HomeIndicator />
    </ScreenShell>
  );
}

// ────────────────────────────────────────────────────────────────────────
//  Courses list — manage saved courses
// ────────────────────────────────────────────────────────────────────────
function CoursesScreen({ go }) {
  const { courses } = useStore();
  const [confirmDel, setConfirmDel] = useState(null);

  const remove = (id) => {
    store.setCourses(courses.filter((c) => c.id !== id));
    setConfirmDel(null);
    toast('Course deleted');
  };

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
        body={confirmDel ? `“${confirmDel.name}” will be removed. Past rounds played here will keep their saved scores.` : ''}
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
function NewCourseScreen({ go, params }) {
  const { courses } = useStore();
  const editing = params.courseId ? courses.find((c) => c.id === params.courseId) : null;

  const [name, setName] = useState(editing ? editing.name : '');
  const [holeCount, setHoleCount] = useState(editing ? editing.pars.length : 18);
  const [pars, setPars] = useState(() => editing ? [...editing.pars] : Array(18).fill(3));

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

  const save = () => {
    if (!canSave) return;
    const payload = {
      id: editing ? editing.id : uid(),
      name: name.trim(),
      pars: [...pars],
      createdAt: editing ? editing.createdAt : Date.now(),
    };
    const next = editing
      ? courses.map((c) => c.id === editing.id ? payload : c)
      : [payload, ...courses];
    store.setCourses(next);
    toast(editing ? 'Course updated' : 'Course saved');
    go('courses');
  };

  return (
    <ScreenShell label="New Course">
      <StatusBar />
      <TopBar onBack={() => go(editing ? 'courses' : 'courses')} label={editing ? 'EDIT COURSE' : 'NEW COURSE'} />

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

// ────────────────────────────────────────────────────────────────────────
//  Start Round
// ────────────────────────────────────────────────────────────────────────
function StartRoundScreen({ go }) {
  const { courses, rounds, user } = useStore();

  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id || null);
  const [players, setPlayers] = useState(() => {
    const seedName = user || '';
    return [
      { id: uid(), name: seedName, color: FT.orange, you: true },
      { id: uid(), name: '', color: FT.fern, you: false },
    ];
  });
  const [editingId, setEditingId] = useState(() => {
    // Auto-focus first empty player input
    return null;
  });

  // suggest names based on rounds history
  const recentNames = useMemo(() => {
    const seen = new Map();
    for (const r of rounds) for (const p of r.players) if (p.name && !seen.has(p.name)) seen.set(p.name, p.color);
    return [...seen.entries()].slice(0, 8);
  }, [rounds]);

  const setPlayerName = (id, name) => setPlayers((prev) => prev.map((p) => p.id === id ? { ...p, name } : p));
  const removePlayer = (id) => setPlayers((prev) => prev.filter((p) => p.id !== id));
  const addPlayer = () => {
    if (players.length >= 3) {
      toast('Max 3 players');
      return;
    }
    const used = new Set(players.map((p) => p.color));
    const color = PLAYER_COLORS.find((c) => !used.has(c)) || PLAYER_COLORS[players.length % PLAYER_COLORS.length];
    setPlayers((prev) => [...prev, { id: uid(), name: '', color, you: false }]);
  };
  const fillSuggestion = (name, color) => {
    // fill the first empty slot, else add new
    const empty = players.find((p) => !p.name.trim());
    if (empty) {
      setPlayers((prev) => prev.map((p) => p.id === empty.id ? { ...p, name } : p));
    } else if (players.length < 3) {
      const used = new Set(players.map((p) => p.color));
      const c = used.has(color) ? PLAYER_COLORS.find((x) => !used.has(x)) || color : color;
      setPlayers((prev) => [...prev, { id: uid(), name, color: c, you: false }]);
    } else {
      toast('Max 3 players');
    }
  };

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);
  const validPlayers = players.filter((p) => p.name.trim());
  const canStart = selectedCourse && validPlayers.length >= 2;

  const start = () => {
    if (!canStart) return;
    const round = {
      id: uid(),
      courseId: selectedCourse.id,
      courseName: selectedCourse.name,
      pars: [...selectedCourse.pars],
      players: validPlayers.map((p) => ({ id: p.id, name: p.name.trim(), color: p.color })),
      scores: Object.fromEntries(validPlayers.map((p) => [p.id, Array(selectedCourse.pars.length).fill(null)])),
      currentHole: 0,
      startedAt: Date.now(),
      completedAt: null,
    };
    // remember the user's name if this is them
    const me = validPlayers.find((p) => p.you);
    if (me && !user) store.setUser(me.name.trim());
    store.setCurrent(round);
    go('live');
  };

  return (
    <ScreenShell label="Start Round">
      <StatusBar />
      <TopBar onBack={() => go('home')} label="STEP 1 / 1" />
      <div className="ft-scroll">
        <div style={{ padding: '6px 24px 16px' }}>
          <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 34, letterSpacing: -1.2, lineHeight: 1 }}>
            Pick your<br/>course.
          </div>
        </div>

        {/* Courses */}
        {courses.length === 0 ? (
          <div style={{ padding: '0 20px' }}>
            <EmptyState icon="🌲" title="No courses yet"
              body="Add a course first — name and par for each hole."
              cta={
                <button onClick={() => go('newCourse')} className="flat" style={{
                  marginTop: 14, padding: '10px 16px', borderRadius: 12, border: 'none',
                  background: FT.orange, color: FT.ink,
                  fontFamily: SFR, fontWeight: 800, fontSize: 14,
                }}>+ Add a course</button>
              } />
          </div>
        ) : (
          <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {courses.map((c) => {
              const sel = c.id === selectedCourseId;
              return (
                <button key={c.id} onClick={() => setSelectedCourseId(c.id)} className="flat" style={{
                  padding: '14px 16px', borderRadius: 18,
                  background: sel ? FT.forest : FT.paper,
                  color: sel ? FT.cream : FT.ink,
                  border: sel ? `2px solid ${FT.forest}` : `1px solid ${FT.hair}`,
                  display: 'flex', alignItems: 'center', gap: 14, position: 'relative', overflow: 'hidden',
                  textAlign: 'left',
                }}>
                  {sel && <TopoBg color="rgba(244,239,228,0.08)" />}
                  <div style={{
                    width: 46, height: 46, borderRadius: 14,
                    background: sel ? FT.orange : FT.forest,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: SFR, fontWeight: 900, fontSize: 14,
                    color: sel ? FT.ink : FT.cream, position: 'relative', zIndex: 1, flexShrink: 0,
                  }}>{c.pars.length}H</div>
                  <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
                    <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 17, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 1 }}>Par {totalPar(c.pars)}</div>
                  </div>
                  <div style={{
                    width: 22, height: 22, borderRadius: 11, position: 'relative', zIndex: 1, flexShrink: 0,
                    border: `2px solid ${sel ? FT.cream : 'rgba(42,31,23,0.3)'}`,
                    background: sel ? FT.cream : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {sel && <IconCheck color={FT.forest} />}
                  </div>
                </button>
              );
            })}
            <button onClick={() => go('newCourse')} className="flat" style={{
              padding: '12px 16px', borderRadius: 14, border: `1px dashed ${FT.hair}`,
              background: 'transparent', color: FT.dim,
              fontFamily: SFR, fontWeight: 700, fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}><IconPlus color={FT.dim} /> Add a new course</button>
          </div>
        )}

        {/* Players */}
        <div style={{ padding: '20px 24px 8px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: SFR, fontWeight: 800, fontSize: 18 }}>Squad ({players.length})</div>
          {players.length < 3 && (
            <button onClick={addPlayer} className="flat" style={{
              background: 'none', border: 'none', fontSize: 13, color: FT.orange, fontWeight: 700, padding: 0,
            }}>+ Add player</button>
          )}
        </div>

        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {players.map((p) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: FT.paper, borderRadius: 14, padding: '10px 12px 10px 10px',
              border: `1px solid ${FT.hair}`,
            }}>
              <Avatar name={p.name || '?'} color={p.color} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <input value={p.name} onChange={(e) => setPlayerName(p.id, e.target.value)}
                  placeholder={p.you ? 'Your name' : 'Player name'}
                  style={{
                    width: '100%', height: 30, padding: 0,
                    background: 'transparent', border: 'none', outline: 'none',
                    fontFamily: SFR, fontWeight: 700, fontSize: 16, color: FT.ink,
                  }} />
                <div style={{ fontSize: 11, color: FT.dim, marginTop: 1 }}>
                  {p.you ? 'you' : 'player ' + (players.findIndex((x) => x.id === p.id) + 1)}
                </div>
              </div>
              {players.length > 2 && (
                <button onClick={() => removePlayer(p.id)} className="flat" style={{
                  width: 28, height: 28, borderRadius: 14, background: 'rgba(42,31,23,0.06)',
                  border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}><IconClose /></button>
              )}
            </div>
          ))}
        </div>

        {recentNames.length > 0 && (
          <div style={{ padding: '14px 20px 8px' }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: FT.dim, marginBottom: 8 }}>QUICK ADD</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {recentNames.filter(([n]) => !players.some((p) => p.name.trim() === n)).map(([n, c]) => (
                <button key={n} onClick={() => fillSuggestion(n, c)} className="flat" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 10px 6px 6px', borderRadius: 999, border: `1px solid ${FT.hair}`,
                  background: FT.paper, color: FT.ink,
                  fontFamily: SFR, fontWeight: 700, fontSize: 12,
                }}>
                  <span style={{ width: 18, height: 18, borderRadius: 5, background: c,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 900, color: FT.ink }}>{initialsOf(n)}</span>
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ height: 100 }} />
      </div>

      {/* Sticky CTA */}
      <div style={{ padding: '16px 20px 28px', flexShrink: 0,
        background: 'linear-gradient(to top, rgba(244,239,228,1) 60%, rgba(244,239,228,0))' }}>
        <button onClick={start} disabled={!canStart} style={{
          width: '100%', height: 60, borderRadius: 18, border: 'none',
          background: canStart ? FT.orange : 'rgba(42,31,23,0.15)',
          color: canStart ? FT.ink : FT.dim,
          fontFamily: SFR, fontWeight: 900, fontSize: 19, letterSpacing: -0.3,
          boxShadow: canStart ? '0 6px 0 rgba(0,0,0,0.22), 0 14px 24px rgba(255,107,31,0.35)' : 'none',
        }}>
          {canStart ? `Tee it up · ${selectedCourse.name}` :
           courses.length === 0 ? 'Add a course first' :
           validPlayers.length < 2 ? 'Need 2+ named players' : 'Pick a course'}
        </button>
      </div>
      <HomeIndicator />
    </ScreenShell>
  );
}

// ────────────────────────────────────────────────────────────────────────
//  Live Scorecard
// ────────────────────────────────────────────────────────────────────────
function LiveScorecardScreen({ go }) {
  const { current } = useStore();
  useEffect(() => { if (!current) go('home'); }, [current]);
  if (!current) return null;
  return <LiveScorecardImpl key={current.id} go={go} round={current} />;
}

function LiveScorecardImpl({ go, round: r }) {
  const [hole, setHole] = useState(() => {
    const ids = r.players.map((p) => p.id);
    for (let i = 0; i < r.pars.length; i++) {
      if (!ids.every((pid) => typeof (r.scores[pid] || [])[i] === 'number')) return i;
    }
    return r.pars.length - 1;
  });
  const [range, setRange] = useState('low'); // 'low' = 1-6, 'high' = 7-12
  const [showQuit, setShowQuit] = useState(false);

  // Tick the timer every second
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const N = r.pars.length;
  const par = r.pars[hole];

  // figure out next active player
  const activePlayer = useMemo(() => {
    for (const p of r.players) {
      if (typeof (r.scores[p.id] || [])[hole] !== 'number') return p;
    }
    return null;
  }, [r, hole]);

  const setScore = (playerId, holeIdx, value) => {
    const next = {
      ...r,
      scores: {
        ...r.scores,
        [playerId]: r.scores[playerId].map((s, i) => i === holeIdx ? value : s),
      },
    };
    store.setCurrent(next);
  };

  const tapStroke = (n) => {
    if (!activePlayer) return;
    setScore(activePlayer.id, hole, n);
    // after writing, decide whether to advance hole
    const ids = r.players.map((p) => p.id);
    const scoresAfter = ids.map((id) => id === activePlayer.id ? n : r.scores[id][hole]);
    const allScored = scoresAfter.every((s) => typeof s === 'number');
    if (allScored) {
      if (hole < N - 1) {
        setTimeout(() => setHole(hole + 1), 220);
      } else {
        // round complete!
        setTimeout(() => {
          const completed = { ...store.get().current, completedAt: Date.now() };
          store.setCurrent(completed);
          store.setRounds([completed, ...store.get().rounds]);
          store.setCurrent(null);
          go('round', { roundId: completed.id, justFinished: true });
        }, 280);
      }
    }
  };

  const undoLast = () => {
    // find last entered stroke in chronological order: scan holes back from current
    const ids = r.players.map((p) => p.id).reverse(); // last player first within a hole
    for (let h = hole; h >= 0; h--) {
      for (const id of ids) {
        if (typeof r.scores[id][h] === 'number') {
          setScore(id, h, null);
          if (h < hole) setHole(h);
          return;
        }
      }
    }
  };

  const quit = () => {
    store.setCurrent(null);
    go('home');
  };

  const nums = range === 'low' ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12];

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
              const allDone = r.players.every((p) => typeof r.scores[p.id][i] === 'number');
              const isCurrent = i === hole;
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
              );
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
            const score = r.scores[p.id][hole];
            const hasScore = typeof score === 'number';
            const active = !hasScore && activePlayer && activePlayer.id === p.id;
            const total = playerTotal(r, p.id);
            const vs = playerVsPar(r, p.id);
            const through = (r.scores[p.id] || []).filter((s) => typeof s === 'number').length;
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
            );
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
              const tone = n - par;
              const isPar = tone === 0;
              const isBirdie = tone < 0;
              const bg = isBirdie ? FT.orange : isPar ? FT.forest : tone === 1 ? 'rgba(42,31,23,0.85)' : FT.bark;
              const fg = isBirdie ? FT.ink : FT.cream;
              const disabled = !activePlayer;
              return (
                <button key={n} disabled={disabled} onClick={() => tapStroke(n)} style={{
                  height: 56, borderRadius: 14, border: 'none',
                  background: disabled ? 'rgba(42,31,23,0.1)' : bg,
                  color: disabled ? FT.dim : fg,
                  fontFamily: SFR, fontWeight: 900, fontSize: 24, letterSpacing: -0.5,
                  boxShadow: disabled ? 'none' : 'inset 0 -3px 0 rgba(0,0,0,0.18)',
                  cursor: disabled ? 'default' : 'pointer',
                }}>{n}</button>
              );
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
        onConfirm={() => { setShowQuit(false); go('home'); }} />

      <HomeIndicator dark />
    </ScreenShell>
  );
}

// ────────────────────────────────────────────────────────────────────────
//  End of Round / Round Detail
// ────────────────────────────────────────────────────────────────────────
function RoundDetailScreen({ go, params }) {
  const { rounds } = useStore();
  const round = useMemo(() => rounds.find((x) => x.id === params.roundId), [rounds, params.roundId]);
  useEffect(() => { if (!round) go('home'); }, [round]);
  if (!round) return null;
  return <RoundDetailImpl go={go} params={params} round={round} />;
}

function RoundDetailImpl({ go, params, round }) {
  const { rounds } = useStore();
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

  // chunk holes into groups of 9 (or fewer for last group)
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

  const removeRound = () => {
    store.setRounds(rounds.filter((x) => x.id !== round.id));
    setConfirmDel(false);
    toast('Round deleted');
    go('home');
  };

  const isComplete = !!round.completedAt;
  const duration = round.completedAt ? formatDuration(round.completedAt - round.startedAt) : '—';

  return (
    <ScreenShell label="Round Detail">
      <StatusBar />
      <TopBar onBack={() => go(params.justFinished ? 'home' : 'home')}
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

// ────────────────────────────────────────────────────────────────────────
//  Stats / History
// ────────────────────────────────────────────────────────────────────────
function StatsScreen({ go }) {
  const { rounds, user } = useStore();
  const [filter, setFilter] = useState('all'); // 'all' | 'wins' | 'losses'

  const completed = useMemo(() =>
    [...rounds].filter((r) => r.completedAt).sort((a, b) => b.completedAt - a.completedAt),
  [rounds]);

  const stats = useMemo(() => user ? computePlayerStats(rounds, user) : null, [rounds, user]);

  const myRounds = useMemo(() => {
    if (!user) return [];
    return completed.filter((r) => r.players.some((p) => p.name === user)).map((r) => {
      const me = r.players.find((p) => p.name === user);
      const myScore = playerTotal(r, me.id);
      const myVs = playerVsPar(r, me.id);
      let strictlyBest = true;
      for (const p of r.players) {
        if (p.id === me.id) continue;
        if (playerTotal(r, p.id) <= myScore) strictlyBest = false;
      }
      return { round: r, vs: myVs, win: strictlyBest };
    });
  }, [completed, user]);

  const filtered = useMemo(() => {
    if (filter === 'all') return myRounds;
    if (filter === 'wins') return myRounds.filter((m) => m.win);
    return myRounds.filter((m) => !m.win);
  }, [myRounds, filter]);

  const noUser = !user;
  const noRounds = completed.length === 0;

  return (
    <ScreenShell label="Stats">
      <StatusBar />
      <TopBar onBack={() => go('home')} label="HISTORY" />

      <div className="ft-scroll">
        <div style={{ padding: '4px 22px 12px' }}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: FT.dim, textTransform: 'uppercase' }}>Your stats</div>
          <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 34, letterSpacing: -1.2, lineHeight: 1, marginTop: 4 }}>
            {noUser ? 'Set your name.' : `The book on ${user.split(' ')[0]}.`}
          </div>
        </div>

        {noUser ? (
          <div style={{ padding: '0 16px' }}>
            <EmptyState icon="🪪" title="Tell us your name"
              body="Stats track rounds where you're playing — set your name to see them."
              cta={
                <button onClick={() => go('settings')} className="flat" style={{
                  marginTop: 14, padding: '10px 16px', borderRadius: 12, border: 'none',
                  background: FT.orange, color: FT.ink,
                  fontFamily: SFR, fontWeight: 800, fontSize: 14,
                }}>Set name</button>
              } />
          </div>
        ) : noRounds ? (
          <div style={{ padding: '0 16px' }}>
            <EmptyState icon="🎯" title="No rounds yet"
              body="Stats show up once you've finished a round."
              cta={
                <button onClick={() => go('start')} className="flat" style={{
                  marginTop: 14, padding: '10px 16px', borderRadius: 12, border: 'none',
                  background: FT.orange, color: FT.ink,
                  fontFamily: SFR, fontWeight: 800, fontSize: 14,
                }}>Start a round</button>
              } />
          </div>
        ) : (
          <>
            {/* Headline stats */}
            <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 8 }}>
              <div style={{ background: FT.forest, color: FT.cream, borderRadius: 18, padding: '14px 14px', position: 'relative', overflow: 'hidden' }}>
                <TopoBg color="rgba(244,239,228,0.08)" />
                <div style={{ position: 'relative' }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1.5, opacity: 0.6 }}>AVG vs PAR</div>
                  <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 44, letterSpacing: -2, lineHeight: 0.95, marginTop: 4 }}>
                    {stats.totalRounds === 0 ? '–' :
                     stats.avgVs === 0 ? 'E' :
                     stats.avgVs > 0 ? `+${stats.avgVs.toFixed(1)}` : stats.avgVs.toFixed(1)}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                    {stats.totalRounds} {stats.totalRounds === 1 ? 'round' : 'rounds'}
                  </div>
                </div>
              </div>
              <div style={{ background: FT.paper, borderRadius: 18, padding: '14px 14px', border: `1px solid ${FT.hair}` }}>
                <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1.5, color: FT.dim }}>BIRDIES</div>
                <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 32, letterSpacing: -1, lineHeight: 1, marginTop: 4, color: FT.orange }}>{stats.birdies}</div>
                <div style={{ fontSize: 11, color: FT.dim, marginTop: 2 }}>career</div>
              </div>
              <div style={{ background: FT.paper, borderRadius: 18, padding: '14px 14px', border: `1px solid ${FT.hair}` }}>
                <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1.5, color: FT.dim }}>WIN %</div>
                <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 32, letterSpacing: -1, lineHeight: 1, marginTop: 4 }}>{stats.winPct}</div>
                <div style={{ fontSize: 11, color: FT.dim, marginTop: 2 }}>{stats.wins} of {stats.totalRounds}</div>
              </div>
            </div>

            {/* Per-course averages */}
            {stats.perCourse.length > 0 && (
              <>
                <div style={{ padding: '20px 22px 8px' }}>
                  <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: FT.dim, textTransform: 'uppercase' }}>By course</div>
                </div>
                <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {stats.perCourse.map((c) => (
                    <div key={c.courseName} style={{
                      background: FT.paper, borderRadius: 14, padding: '10px 14px',
                      border: `1px solid ${FT.hair}`,
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.courseName}</div>
                        <div style={{ fontSize: 11, color: FT.dim, marginTop: 1, fontFamily: MONO, letterSpacing: 0.5 }}>
                          {c.rounds} {c.rounds === 1 ? 'ROUND' : 'ROUNDS'} · BEST {c.best}
                        </div>
                      </div>
                      <ParChip value={Math.round(c.avgVs * 10) / 10} size="md" />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Head to head */}
            {stats.h2h.length > 0 && (
              <>
                <div style={{ padding: '20px 22px 8px' }}>
                  <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: FT.dim, textTransform: 'uppercase' }}>Head to head</div>
                </div>
                <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {stats.h2h.sort((a, b) => (b.w + b.l + b.t) - (a.w + a.l + a.t)).map((p) => {
                    const total = p.w + p.l + p.t;
                    const pct = total > 0 ? (p.w / total) * 100 : 0;
                    const lossPct = total > 0 ? (p.l / total) * 100 : 0;
                    return (
                      <div key={p.name} style={{
                        background: FT.paper, borderRadius: 14, padding: '10px 12px',
                        border: `1px solid ${FT.hair}`,
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}>
                        <Avatar name={p.name} color={PLAYER_COLORS[Math.abs(hashCode(p.name)) % PLAYER_COLORS.length]} size={36} fontSize={12} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                            <span style={{ fontFamily: SFR, fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>vs {p.name}</span>
                            <span style={{ fontFamily: SFR, fontWeight: 900, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>
                              <span style={{ color: FT.forest }}>{p.w}</span>
                              <span style={{ color: FT.dim, margin: '0 4px' }}>—</span>
                              <span style={{ color: FT.bark }}>{p.l}</span>
                              {p.t > 0 && <span style={{ color: FT.dim, marginLeft: 6, fontSize: 12 }}>({p.t}T)</span>}
                            </span>
                          </div>
                          <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 6, background: 'rgba(42,31,23,0.08)' }}>
                            <div style={{ width: `${pct}%`, background: FT.forest }} />
                            <div style={{ width: `${lossPct}%`, background: FT.bark, opacity: 0.3 }} />
                          </div>
                        </div>
                        <div style={{
                          width: 22, height: 22, borderRadius: 11,
                          background: p.last === 'W' ? FT.orange : p.last === 'L' ? 'rgba(42,31,23,0.1)' : 'rgba(42,31,23,0.06)',
                          color: p.last === 'W' ? FT.ink : FT.dim,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: SFR, fontWeight: 900, fontSize: 11, flexShrink: 0,
                        }}>{p.last}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Past rounds with filter */}
            <div style={{ padding: '20px 22px 8px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: FT.dim, textTransform: 'uppercase' }}>Past rounds</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'wins', label: 'Wins' },
                  { key: 'losses', label: 'Losses' },
                ].map((f) => (
                  <button key={f.key} onClick={() => setFilter(f.key)} className="flat" style={{
                    padding: '4px 10px', borderRadius: 999, border: 'none',
                    background: filter === f.key ? FT.ink : 'rgba(42,31,23,0.07)',
                    color: filter === f.key ? FT.cream : FT.ink,
                    fontFamily: SFR, fontWeight: 700, fontSize: 11,
                  }}>{f.label}</button>
                ))}
              </div>
            </div>
            <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.length === 0 ? (
                <div style={{ padding: 14, textAlign: 'center', color: FT.dim, fontSize: 13 }}>
                  No rounds matching that filter.
                </div>
              ) : filtered.map(({ round: r, vs, win }) => (
                <button key={r.id} onClick={() => go('round', { roundId: r.id })} className="flat" style={{
                  display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                  background: FT.paper, borderRadius: 12, padding: '10px 12px',
                  border: `1px solid ${FT.hair}`, width: '100%',
                }}>
                  <div style={{
                    width: 6, alignSelf: 'stretch', borderRadius: 3,
                    background: win ? FT.orange : 'rgba(42,31,23,0.2)',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.courseName}</div>
                    <div style={{ fontSize: 11, color: FT.dim, marginTop: 1, fontFamily: MONO, letterSpacing: 0.5 }}>
                      {formatShortDate(r.completedAt).toUpperCase()} · {r.players.length} PLAYERS
                    </div>
                  </div>
                  <ParChip value={vs} size="md" />
                  <IconChevronRight />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <HomeIndicator />
    </ScreenShell>
  );
}

// tiny string-hash so opponent avatar colors are stable
function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return h;
}

// ────────────────────────────────────────────────────────────────────────
//  App router
// ────────────────────────────────────────────────────────────────────────
function App() {
  const [screen, setScreen] = useState('home');
  const [params, setParams] = useState({});
  const [history, setHistory] = useState([]); // for back nav
  const t = useToast();
  _toastFn = t.show;

  const go = useCallback((next, p = {}) => {
    setHistory((h) => [...h, { screen, params }]);
    setScreen(next);
    setParams(p);
    // scroll to top on screen change
    requestAnimationFrame(() => {
      const sc = document.querySelector('.ft-scroll');
      if (sc) sc.scrollTop = 0;
    });
  }, [screen, params]);

  // browser back button — go to home, simple model
  useEffect(() => {
    window.history.replaceState({ ft: true }, '');
    const onPop = () => {
      if (screen !== 'home') {
        setScreen('home');
        setParams({});
        window.history.pushState({ ft: true }, '');
      } else {
        window.history.pushState({ ft: true }, '');
      }
    };
    window.history.pushState({ ft: true }, '');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [screen]);

  let body;
  switch (screen) {
    case 'home':       body = <HomeScreen go={go} />; break;
    case 'settings':   body = <SettingsScreen go={go} />; break;
    case 'courses':    body = <CoursesScreen go={go} />; break;
    case 'newCourse':  body = <NewCourseScreen go={go} params={params} />; break;
    case 'start':      body = <StartRoundScreen go={go} />; break;
    case 'live':       body = <LiveScorecardScreen go={go} />; break;
    case 'round':      body = <RoundDetailScreen go={go} params={params} />; break;
    case 'stats':      body = <StatsScreen go={go} />; break;
    default:           body = <HomeScreen go={go} />;
  }

  return (
    <div className="ft-stage">
      <div className="ft-phone" key={screen + (params.roundId || '') + (params.courseId || '')}>
        {body}
      </div>
      {t.node}
    </div>
  );
}


export default App;
