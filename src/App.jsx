import { useState, useEffect, useCallback } from 'react';
import { supabase } from './services/supabase';
import {
  StatusBar, HomeIndicator, TopoBg, ParChip, Avatar,
  IconChevronLeft, IconChevronRight, IconArrow, IconClose,
  IconPlus, IconCheck, IconTrash, IconHamburger,
  Pill, EmptyState, useToast,
} from './components/atoms';
import { ScreenShell } from './components/layout/ScreenShell';
import { FT, PLAYER_COLORS, SF, SFR, MONO } from './constants/colors';
import { LandingScreen, CreateAccountScreen, LoginScreen, AccountScreen, SettingsScreen, SquadScreen } from './screens/AuthScreens';
import { CoursesScreen, NewCourseScreen } from './screens/CoursesScreen';
import { StatsScreen } from './screens/StatsScreen';
import { HomeScreen } from './screens/HomeScreen';
import { StartRoundScreen } from './screens/StartRoundScreen';
import { LiveScorecardScreen } from './screens/LiveScorecardScreen';
import { RoundDetailScreen } from './screens/RoundDetailScreen';

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
//  Bottom tab bar
// ────────────────────────────────────────────────────────────────────────
const TAB_SCREENS = new Set(['home', 'squad', 'stats', 'account']);

function BottomTabBar({ active, onTab }) {
  const tabs = [
    {
      id: 'home', label: 'Home',
      icon: (on) => (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M3 9.5L11 3l8 6.5V19a1 1 0 01-1 1H14v-5h-4v5H4a1 1 0 01-1-1V9.5z"
            stroke={on ? FT.forest : FT.dim} strokeWidth="1.8" strokeLinejoin="round" fill={on ? 'rgba(31,61,43,0.1)' : 'none'}/>
        </svg>
      ),
    },
    {
      id: 'squad', label: 'Squad',
      icon: (on) => (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <circle cx="8" cy="8" r="3" stroke={on ? FT.forest : FT.dim} strokeWidth="1.8"/>
          <path d="M2 19c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke={on ? FT.forest : FT.dim} strokeWidth="1.8" strokeLinecap="round"/>
          <circle cx="16" cy="7" r="2.5" stroke={on ? FT.forest : FT.dim} strokeWidth="1.6"/>
          <path d="M19.5 18c0-2.485-1.567-4-3.5-4" stroke={on ? FT.forest : FT.dim} strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      id: 'stats', label: 'Stats',
      icon: (on) => (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <rect x="3" y="13" width="4" height="6" rx="1" fill={on ? 'rgba(31,61,43,0.15)' : 'none'} stroke={on ? FT.forest : FT.dim} strokeWidth="1.8"/>
          <rect x="9" y="9" width="4" height="10" rx="1" fill={on ? 'rgba(31,61,43,0.15)' : 'none'} stroke={on ? FT.forest : FT.dim} strokeWidth="1.8"/>
          <rect x="15" y="4" width="4" height="15" rx="1" fill={on ? 'rgba(31,61,43,0.15)' : 'none'} stroke={on ? FT.forest : FT.dim} strokeWidth="1.8"/>
        </svg>
      ),
    },
    {
      id: 'account', label: 'Account',
      icon: (on) => (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <circle cx="11" cy="8" r="3.5" stroke={on ? FT.forest : FT.dim} strokeWidth="1.8"/>
          <path d="M4 19c0-3.866 3.134-6 7-6s7 2.134 7 6" stroke={on ? FT.forest : FT.dim} strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      ),
    },
  ];

  return (
    <div style={{
      background: FT.paper, borderTop: `1px solid ${FT.hair}`,
      display: 'flex', flexShrink: 0,
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {tabs.map(({ id, label, icon }) => {
        const on = active === id;
        return (
          <button key={id} onClick={() => onTab(id)} className="flat" style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 3, padding: '9px 0 8px',
            background: 'none', border: 'none', cursor: 'pointer',
          }}>
            {icon(on)}
            <span style={{
              fontFamily: SFR, fontWeight: on ? 700 : 500, fontSize: 10,
              color: on ? FT.forest : FT.dim, letterSpacing: 0.2,
            }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
//  App router
// ────────────────────────────────────────────────────────────────────────
function App() {
  const [screen, setScreen]   = useState('home');
  const [params, setParams]   = useState({});
  const [history, setHistory] = useState([]);
  const [session, setSession] = useState(undefined); // undefined=loading, null=logged out, obj=logged in
  const [authView, setAuthView] = useState('landing'); // 'landing' | 'signup' | 'login'
  const t = useToast();
  _toastFn = t.show;
  const { user: storeUser } = useStore();

  // Auth — check session on mount and listen for changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const go = useCallback((next, p = {}) => {
    setHistory((h) => [...h, { screen, params }]);
    setScreen(next);
    setParams(p);
    requestAnimationFrame(() => {
      const sc = document.querySelector('.ft-scroll');
      if (sc) sc.scrollTop = 0;
    });
  }, [screen, params]);

  const goTab = useCallback((tab) => {
    setScreen(tab);
    setParams({});
  }, []);

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

  // Loading — checking session
  if (session === undefined) {
    return (
      <div className="ft-stage">
        <div className="ft-phone" style={{ background: FT.forest, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: FT.orange, opacity: 0.8 }} />
        </div>
      </div>
    );
  }

  // Not logged in — landing → signup | login
  if (!session) {
    const authScreens = {
      landing:  <LandingScreen onSignup={() => setAuthView('signup')} onLogin={() => setAuthView('login')} />,
      signup:   <CreateAccountScreen onBack={() => setAuthView('landing')} onLogin={() => setAuthView('login')} />,
      login:    <LoginScreen onBack={() => setAuthView('landing')} onSignup={() => setAuthView('signup')} />,
    };
    return (
      <div className="ft-stage">
        <div className="ft-phone">{authScreens[authView]}</div>
        {t.node}
      </div>
    );
  }

  // Logged in — full app
  let body;
  switch (screen) {
    case 'home':       body = <HomeScreen go={go} userId={session?.user?.id} />; break;
    case 'squad':      body = <SquadScreen go={go} />; break;
    case 'stats':      body = <StatsScreen go={go} userId={session?.user?.id} />; break;
    case 'account':    body = <AccountScreen session={session} />; break;
    case 'settings':   body = <SettingsScreen go={go} user={storeUser} onSave={(name) => store.setUser(name)} />; break;
    case 'courses':    body = <CoursesScreen go={go} userId={session?.user?.id} onToast={toast} />; break;
    case 'newCourse':  body = <NewCourseScreen go={go} params={params} userId={session?.user?.id} onToast={toast} />; break;
    case 'start':      body = <StartRoundScreen go={go} userId={session?.user?.id} />; break;
    case 'live':       body = <LiveScorecardScreen go={go} userId={session?.user?.id} />; break;
    case 'round':      body = <RoundDetailScreen go={go} params={params} userId={session?.user?.id} />; break;
    default:           body = <HomeScreen go={go} userId={session?.user?.id} />;
  }

  const showTabs = TAB_SCREENS.has(screen);

  return (
    <div className="ft-stage">
      <div className="ft-phone" key={screen + (params.roundId || '') + (params.courseId || '')}
        style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {body}
        </div>
        {showTabs && <BottomTabBar active={screen} onTab={goTab} />}
      </div>
      {t.node}
    </div>
  );
}


export default App;
