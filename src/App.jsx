import { useState, useEffect, useCallback } from 'react';
import { useToast } from './components/atoms';
import { FT, SFR } from './constants/colors';
import { useAuth } from './hooks/useAuth';
import { useProfile } from './hooks/useProfile';
import { useFireteam } from './hooks/useFireteam';
import { LandingScreen, CreateAccountScreen, LoginScreen, AccountScreen, SettingsScreen } from './screens/AuthScreens';
import { SquadScreen } from './screens/SquadScreen';
import { FireteamScreen } from './screens/FireteamScreen';
import { CoursesScreen, NewCourseScreen } from './screens/CoursesScreen';
import { StatsScreen } from './screens/StatsScreen';
import { HomeScreen } from './screens/HomeScreen';
import { StartRoundScreen } from './screens/StartRoundScreen';
import { LiveScorecardScreen } from './screens/LiveScorecardScreen';
import { RoundDetailScreen } from './screens/RoundDetailScreen';

// App-level toast portal — exposed so any screen can call it via onToast prop
let _toastFn = () => {};
const toast = (m) => _toastFn(m);

// ────────────────────────────────────────────────────────────────────────
//  Bottom tab bar
// ────────────────────────────────────────────────────────────────────────
const TAB_SCREENS = new Set(['home', 'friends', 'stats', 'fireteam', 'account']);

function BottomTabBar({ active, onTab, inviteBadge }) {
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
      id: 'friends', label: 'Friends',
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
      id: 'fireteam', label: 'Fireteam', badge: inviteBadge,
      icon: (on) => (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M11 2L4 5v6c0 4 3 7.4 7 8.5C15 18.4 18 15 18 11V5l-7-3z"
            stroke={on ? FT.forest : FT.dim} strokeWidth="1.8" strokeLinejoin="round"
            fill={on ? 'rgba(31,61,43,0.1)' : 'none'}/>
          <path d="M8 11l2 2 4-4" stroke={on ? FT.forest : FT.dim} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
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
      {tabs.map(({ id, label, icon, badge }) => {
        const on = active === id;
        return (
          <button key={id} onClick={() => onTab(id)} className="flat" style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 3, padding: '9px 0 8px',
            background: 'none', border: 'none', cursor: 'pointer',
            position: 'relative',
          }}>
            <div style={{ position: 'relative' }}>
              {icon(on)}
              {badge > 0 && (
                <div style={{
                  position: 'absolute', top: -3, right: -4,
                  width: 8, height: 8, borderRadius: '50%',
                  background: FT.orange, border: `1.5px solid ${FT.paper}`,
                }} />
              )}
            </div>
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
  const [authView, setAuthView] = useState('landing'); // 'landing' | 'signup' | 'login'
  const t = useToast();
  _toastFn = t.show;

  const { user, loading: authLoading } = useAuth();
  const { profile } = useProfile(user?.id);
  const { pendingInvites } = useFireteam(user?.id);

  const go = useCallback((next, p = {}) => {
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
  if (authLoading) {
    return (
      <div className="ft-stage">
        <div className="ft-phone" style={{ background: FT.forest, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: FT.orange, opacity: 0.8 }} />
        </div>
      </div>
    );
  }

  // Not logged in — landing → signup | login
  if (!user) {
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
    case 'home':       body = <HomeScreen go={go} userId={user?.id} />; break;
    case 'friends':    body = <SquadScreen go={go} userId={user?.id} />; break;
    case 'stats':      body = <StatsScreen go={go} userId={user?.id} />; break;
    case 'fireteam':   body = <FireteamScreen go={go} userId={user?.id} />; break;
    case 'account':    body = <AccountScreen session={{ user }} />; break;
    case 'settings':   body = <SettingsScreen go={go} userId={user?.id} />; break;
    case 'courses':    body = <CoursesScreen go={go} userId={user?.id} onToast={toast} />; break;
    case 'newCourse':  body = <NewCourseScreen go={go} params={params} userId={user?.id} onToast={toast} />; break;
    case 'start':      body = <StartRoundScreen go={go} userId={user?.id} />; break;
    case 'live':       body = <LiveScorecardScreen go={go} userId={user?.id} />; break;
    case 'round':      body = <RoundDetailScreen go={go} params={params} userId={user?.id} />; break;
    default:           body = <HomeScreen go={go} userId={user?.id} />;
  }

  const showTabs = TAB_SCREENS.has(screen);

  return (
    <div className="ft-stage">
      <div className="ft-phone" key={screen + (params.roundId || '') + (params.courseId || '')}
        style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {body}
        </div>
        {showTabs && <BottomTabBar active={screen} onTab={goTab} inviteBadge={pendingInvites.length} />}
      </div>
      {t.node}
    </div>
  );
}


export default App;
