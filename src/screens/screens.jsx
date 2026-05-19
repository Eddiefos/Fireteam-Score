// Fireteam Score — five screens
// Palette: forest #1F3D2B, moss #3A5A40, cream #F4EFE4, bark #2A1F17, orange #FF6B1F

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
  dim:    'rgba(42,31,23,0.55)',
  hair:   'rgba(42,31,23,0.12)',
};

const SF = '-apple-system, "SF Pro Display", "SF Pro Text", system-ui, sans-serif';
const SFR = '-apple-system, "SF Pro Rounded", "SF Pro Display", system-ui, sans-serif';
const MONO = '"SF Mono", ui-monospace, Menlo, monospace';

// ── shared atoms ──────────────────────────────────────────────────────────
function ScreenShell({ children, bg = FT.cream, dark = false, label }) {
  return (
    <div data-screen-label={label} style={{
      width: '100%', height: '100%', background: bg,
      fontFamily: SF, color: dark ? FT.cream : FT.ink,
      WebkitFontSmoothing: 'antialiased',
      position: 'relative', overflow: 'hidden',
    }}>{children}</div>
  );
}

function StatusBar({ dark = false, time = '2:41' }) {
  const c = dark ? FT.cream : FT.ink;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '18px 32px 6px', fontFamily: SF, fontWeight: 600, fontSize: 17, color: c,
      position: 'relative', zIndex: 5,
    }}>
      <span style={{ letterSpacing: -0.2 }}>{time}</span>
      <span style={{ width: 110 }} />
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <svg width="18" height="11" viewBox="0 0 18 11"><rect x="0" y="6" width="3" height="5" rx="0.6" fill={c}/><rect x="5" y="4" width="3" height="7" rx="0.6" fill={c}/><rect x="10" y="2" width="3" height="9" rx="0.6" fill={c}/><rect x="15" y="0" width="3" height="11" rx="0.6" fill={c}/></svg>
        <svg width="25" height="12" viewBox="0 0 25 12"><rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke={c} strokeOpacity="0.4" fill="none"/><rect x="2" y="2" width="18" height="8" rx="1.5" fill={c}/><rect x="22.5" y="4" width="2" height="4" rx="0.6" fill={c} fillOpacity="0.4"/></svg>
      </span>
    </div>
  );
}

function HomeIndicator({ dark = false }) {
  return (
    <div style={{
      position: 'absolute', bottom: 8, left: 0, right: 0,
      display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 50,
    }}>
      <div style={{ width: 134, height: 5, borderRadius: 3, background: dark ? 'rgba(244,239,228,0.7)' : 'rgba(21,17,13,0.35)' }} />
    </div>
  );
}

// Topographic-map line texture, used as a backdrop on hero areas
function TopoBg({ color = 'rgba(255,255,255,0.08)', opacity = 1 }) {
  // Concentric wavy contours
  return (
    <svg viewBox="0 0 380 320" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity, pointerEvents: 'none' }}>
      {[0, 18, 36, 54, 72, 90, 108, 126, 144, 162].map((r, i) => (
        <path key={i} d={`M -20 ${80 + r * 1.1} C 80 ${50 + r}, 180 ${130 + r}, 280 ${70 + r} S 420 ${110 + r}, 520 ${90 + r}`}
          stroke={color} strokeWidth={1} fill="none" />
      ))}
      {[0, 16, 32, 48, 64, 80, 96].map((r, i) => (
        <ellipse key={'e' + i} cx={300} cy={250} rx={60 + r * 1.4} ry={26 + r * 0.7} stroke={color} strokeWidth={1} fill="none" />
      ))}
    </svg>
  );
}

// Disc icon (flying disc, side profile)
function Disc({ size = 22, color = FT.orange, stroke = FT.ink }) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 36 22" fill="none" style={{ display: 'block' }}>
      <ellipse cx="18" cy="11" rx="16" ry="6" fill={color} stroke={stroke} strokeWidth="1.6"/>
      <ellipse cx="18" cy="9" rx="12" ry="4" fill="none" stroke={stroke} strokeWidth="1.2" opacity="0.4"/>
    </svg>
  );
}

// Par-relative chip (−1, E, +2)
function ParChip({ value, size = 'md', tone }) {
  const v = value;
  const auto = tone || (v < 0 ? 'birdie' : v === 0 ? 'par' : v === 1 ? 'bogey' : 'overbogey');
  const palette = {
    birdie:     { bg: FT.orange, fg: FT.ink },
    par:        { bg: 'rgba(42,31,23,0.08)', fg: FT.ink },
    bogey:      { bg: 'rgba(42,31,23,0.85)', fg: FT.cream },
    overbogey:  { bg: FT.bark, fg: FT.cream },
  }[auto];
  const sizes = {
    sm: { h: 22, fs: 12, pad: '0 7px', r: 6 },
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
      letterSpacing: -0.2, fontVariantNumeric: 'tabular-nums',
    }}>{txt}</span>
  );
}

// ── 1. HOME ───────────────────────────────────────────────────────────────
function HomeScreen() {
  const recent = [
    { course: 'Bear Creek', date: 'Sat · May 4', winner: 'Jules', score: -3, holes: 18, players: ['JK', 'MR', 'ST'] },
    { course: 'Pine Hollow', date: 'Wed · May 1', winner: 'Soren', score: 1, holes: 18, players: ['JK', 'MR', 'ST'] },
    { course: 'Riverbend 9', date: 'Sun · Apr 28', winner: 'Mara',  score: -1, holes: 9,  players: ['JK', 'MR'] },
  ];
  return (
    <ScreenShell label="01 Home" bg={FT.cream}>
      <StatusBar />
      {/* Hero block */}
      <div style={{ padding: '8px 24px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: FT.dim, textTransform: 'uppercase' }}>Fireteam · 4 members</div>
            <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 38, lineHeight: 0.95, marginTop: 6, letterSpacing: -1.5 }}>
              Hey,<br/>Jules 👋
            </div>
          </div>
          <div style={{ display: 'flex' }}>
            {['JK', 'MR', 'ST', 'AV'].map((n, i) => (
              <div key={n} style={{
                width: 32, height: 32, borderRadius: 16, marginLeft: i ? -8 : 0,
                background: [FT.orange, FT.fern, FT.amber, FT.bark][i], color: FT.cream,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: SFR, fontSize: 11, fontWeight: 800, border: `2px solid ${FT.cream}`,
              }}>{n}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Big start CTA */}
      <div style={{ padding: '0 20px' }}>
        <button style={{
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
            }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M5 11h12M12 5l6 6-6 6" stroke={FT.ink} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>
        </button>
      </div>

      {/* Quick nav tiles */}
      <div style={{ padding: '14px 20px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { label: 'History', sub: '47 rounds', icon: '📋', tone: FT.paper },
          { label: 'Courses', sub: '8 saved',   icon: '🌲', tone: FT.paper },
        ].map((t) => (
          <div key={t.label} style={{
            background: t.tone, borderRadius: 18, padding: '14px 16px',
            border: `1px solid ${FT.hair}`,
          }}>
            <div style={{ fontSize: 22, lineHeight: 1, marginBottom: 8 }}>{t.icon}</div>
            <div style={{ fontFamily: SFR, fontWeight: 800, fontSize: 17 }}>{t.label}</div>
            <div style={{ fontSize: 12, color: FT.dim, marginTop: 1 }}>{t.sub}</div>
          </div>
        ))}
      </div>

      {/* Recent rounds */}
      <div style={{ padding: '22px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: FT.dim, textTransform: 'uppercase' }}>Recent rounds</div>
          <div style={{ fontSize: 13, color: FT.orange, fontWeight: 700 }}>See all</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recent.map((r) => (
            <div key={r.course} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: FT.paper, borderRadius: 14, padding: '12px 14px',
              border: `1px solid ${FT.hair}`,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, background: FT.forest,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: SFR, fontWeight: 900, color: FT.cream, fontSize: 13,
              }}>{r.holes}H</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 16, letterSpacing: -0.2 }}>{r.course}</div>
                <div style={{ fontSize: 12, color: FT.dim, marginTop: 1 }}>{r.date} · {r.winner} took it</div>
              </div>
              <ParChip value={r.score} size="md" />
            </div>
          ))}
        </div>
      </div>

      <HomeIndicator />
    </ScreenShell>
  );
}

// ── 2. START ROUND ────────────────────────────────────────────────────────
function StartRoundScreen() {
  const courses = [
    { name: 'Bear Creek',  holes: 18, par: 54, fav: true,  miles: '2.1' },
    { name: 'Pine Hollow', holes: 18, par: 56, fav: false, miles: '6.8' },
    { name: 'Riverbend',   holes: 9,  par: 27, fav: true,  miles: '0.9' },
  ];
  const players = [
    { name: 'Jules',  init: 'JK', color: FT.orange, you: true },
    { name: 'Mara R', init: 'MR', color: FT.fern,   you: false },
    { name: 'Soren T', init: 'ST', color: FT.amber, you: false },
  ];
  return (
    <ScreenShell label="02 Start Round" bg={FT.cream}>
      <StatusBar />
      <div style={{ padding: '6px 24px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 12, background: FT.paper,
          display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${FT.hair}`,
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke={FT.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: FT.dim }}>STEP 1 / 2</div>
        <div style={{ width: 36 }} />
      </div>

      <div style={{ padding: '6px 24px 16px' }}>
        <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 34, letterSpacing: -1.2, lineHeight: 1 }}>
          Pick your<br/>course.
        </div>
      </div>

      {/* Courses */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {courses.map((c, i) => {
          const sel = i === 0;
          return (
            <div key={c.name} style={{
              padding: '14px 16px', borderRadius: 18,
              background: sel ? FT.forest : FT.paper,
              color: sel ? FT.cream : FT.ink,
              border: sel ? `2px solid ${FT.forest}` : `1px solid ${FT.hair}`,
              display: 'flex', alignItems: 'center', gap: 14, position: 'relative', overflow: 'hidden',
            }}>
              {sel && <TopoBg color="rgba(244,239,228,0.08)" />}
              <div style={{
                width: 46, height: 46, borderRadius: 14,
                background: sel ? FT.orange : FT.forest,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: SFR, fontWeight: 900, fontSize: 14,
                color: sel ? FT.ink : FT.cream, position: 'relative', zIndex: 1,
              }}>{c.holes}H</div>
              <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: SFR, fontWeight: 700, fontSize: 17, letterSpacing: -0.2 }}>{c.name}</span>
                  {c.fav && <span style={{ color: FT.amber }}>★</span>}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 1 }}>Par {c.par} · {c.miles} mi</div>
              </div>
              <div style={{
                width: 22, height: 22, borderRadius: 11, position: 'relative', zIndex: 1,
                border: `2px solid ${sel ? FT.cream : 'rgba(42,31,23,0.3)'}`,
                background: sel ? FT.cream : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {sel && <svg width="12" height="9" viewBox="0 0 12 9" fill="none"><path d="M1 4l3.5 3.5L11 1" stroke={FT.forest} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Players */}
      <div style={{ padding: '20px 24px 8px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: SFR, fontWeight: 800, fontSize: 18 }}>Squad ({players.length})</div>
        <div style={{ fontSize: 13, color: FT.orange, fontWeight: 700 }}>+ Add player</div>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {players.map((p, i) => (
          <div key={p.name} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: FT.paper, borderRadius: 14, padding: '10px 12px 10px 10px',
            border: `1px solid ${FT.hair}`,
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: p.color, color: FT.ink,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: SFR, fontWeight: 900, fontSize: 14,
            }}>{p.init}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 16 }}>
                {p.name} {p.you && <span style={{ fontSize: 11, color: FT.dim, fontWeight: 600, marginLeft: 4 }}>· you</span>}
              </div>
              <div style={{ fontSize: 12, color: FT.dim, marginTop: 1 }}>Tee · {i === 0 ? 'Pro' : 'Standard'}</div>
            </div>
            <div style={{
              width: 28, height: 28, borderRadius: 14, background: 'rgba(42,31,23,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: FT.dim,
            }}>×</div>
          </div>
        ))}
      </div>

      {/* Sticky CTA */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '16px 20px 36px',
        background: 'linear-gradient(to top, rgba(244,239,228,1) 60%, rgba(244,239,228,0))' }}>
        <button style={{
          width: '100%', height: 60, borderRadius: 18, border: 'none',
          background: FT.orange, color: FT.ink,
          fontFamily: SFR, fontWeight: 900, fontSize: 19, letterSpacing: -0.3,
          boxShadow: '0 6px 0 rgba(0,0,0,0.22), 0 14px 24px rgba(255,107,31,0.35)',
        }}>Tee it up · Bear Creek</button>
      </div>
      <HomeIndicator />
    </ScreenShell>
  );
}

// ── 3. LIVE SCORECARD (the hero) ──────────────────────────────────────────
function LiveScorecardScreen() {
  const players = [
    { name: 'Jules',  init: 'JK', color: FT.orange, total: 25, vs: -2, score: 2, locked: true },
    { name: 'Mara',   init: 'MR', color: FT.fern,   total: 28, vs:  1, score: 3, locked: true },
    { name: 'Soren',  init: 'ST', color: FT.amber,  total: 27, vs:  0, score: null, locked: false },
  ];
  const HOLE = 9;
  const PAR = 3;
  const FT_DIST = 312;

  return (
    <ScreenShell label="03 Scorecard" bg={FT.forest} dark>
      <TopoBg color="rgba(244,239,228,0.06)" />
      <StatusBar dark />

      {/* Header strip */}
      <div style={{ padding: '4px 22px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 12,
          background: 'rgba(244,239,228,0.1)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3h8M3 7h8M3 11h5" stroke={FT.cream} strokeWidth="2" strokeLinecap="round"/></svg>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, opacity: 0.55, textTransform: 'uppercase' }}>Bear Creek</div>
          <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 13, marginTop: 1 }}>
            <span style={{ color: FT.orange }}>● </span>LIVE · 24:08
          </div>
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: 12,
          background: 'rgba(244,239,228,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2.5" stroke={FT.cream} strokeWidth="1.6" fill="none"/><path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.5 2.5L4 4M10 10l1.5 1.5M2.5 11.5L4 10M10 4l1.5-1.5" stroke={FT.cream} strokeWidth="1.6" strokeLinecap="round"/></svg>
        </div>
      </div>

      {/* Big hole banner */}
      <div style={{ padding: '0 22px 14px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 3, opacity: 0.6, textTransform: 'uppercase' }}>Hole</div>
            <div style={{
              fontFamily: SFR, fontWeight: 900, fontSize: 110, lineHeight: 0.85,
              letterSpacing: -5, color: FT.cream, marginTop: -2,
            }}>{String(HOLE).padStart(2, '0')}</div>
          </div>
          <div style={{ textAlign: 'right', paddingBottom: 10 }}>
            <div style={{ display: 'flex', gap: 18, alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, opacity: 0.55 }}>PAR</div>
                <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 32, color: FT.orange, lineHeight: 1 }}>{PAR}</div>
              </div>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, opacity: 0.55 }}>FT</div>
                <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 32, color: FT.cream, lineHeight: 1 }}>{FT_DIST}</div>
              </div>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, opacity: 0.55 }}>OF</div>
                <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 32, color: FT.cream, lineHeight: 1, opacity: 0.5 }}>18</div>
              </div>
            </div>
          </div>
        </div>
        {/* Hole pip strip */}
        <div style={{ display: 'flex', gap: 3, marginTop: 8 }}>
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: i < HOLE - 1 ? FT.fern : i === HOLE - 1 ? FT.orange : 'rgba(244,239,228,0.18)',
            }} />
          ))}
        </div>
      </div>

      {/* Player input cards */}
      <div style={{ padding: '6px 14px', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', zIndex: 1 }}>
        {players.map((p) => {
          const active = !p.locked;
          return (
            <div key={p.name} style={{
              background: active ? FT.cream : 'rgba(244,239,228,0.06)',
              color: active ? FT.ink : FT.cream,
              borderRadius: 18, padding: '12px 14px',
              border: active ? `2px solid ${FT.orange}` : '2px solid transparent',
              boxShadow: active ? '0 8px 24px rgba(0,0,0,0.25)' : 'none',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, background: p.color, color: FT.ink,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: SFR, fontWeight: 900, fontSize: 13, flexShrink: 0,
              }}>{p.init}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: SFR, fontWeight: 800, fontSize: 16, letterSpacing: -0.2 }}>{p.name}</span>
                  <ParChip value={p.vs} size="sm" />
                </div>
                <div style={{ fontSize: 11, opacity: active ? 0.55 : 0.5, marginTop: 1, fontFamily: MONO, letterSpacing: 0.5 }}>
                  TOTAL {p.total} · THRU {HOLE - 1}
                </div>
              </div>
              {p.locked ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: 'rgba(244,239,228,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: SFR, fontWeight: 900, fontSize: 22, color: FT.cream,
                  }}>{p.score}</div>
                </div>
              ) : (
                <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 28, color: FT.dim, paddingRight: 4 }}>—</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Stepper input for active player */}
      <div style={{ position: 'absolute', left: 14, right: 14, bottom: 26, zIndex: 2 }}>
        <div style={{
          background: FT.cream, borderRadius: 22, padding: '10px 12px 12px',
          boxShadow: '0 12px 36px rgba(0,0,0,0.35)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 8px' }}>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: FT.dim, textTransform: 'uppercase' }}>Soren throws</div>
              <div style={{ fontFamily: SFR, fontWeight: 800, fontSize: 15 }}>Tap the strokes</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={{
                height: 30, padding: '0 10px', borderRadius: 8, border: 'none',
                background: 'rgba(42,31,23,0.07)', color: FT.ink, fontWeight: 700, fontSize: 12, fontFamily: SF,
              }}>OB +1</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
            {[1, 2, 3, 4, 5, 6].map((n) => {
              const tone = n - PAR;
              const isPar = tone === 0;
              const isBirdie = tone < 0;
              const bg = isBirdie ? FT.orange : isPar ? FT.forest : tone === 1 ? 'rgba(42,31,23,0.85)' : FT.bark;
              const fg = isBirdie ? FT.ink : FT.cream;
              return (
                <button key={n} style={{
                  height: 56, borderRadius: 14, border: 'none',
                  background: bg, color: fg,
                  fontFamily: SFR, fontWeight: 900, fontSize: 24, letterSpacing: -0.5,
                  boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.18)',
                }}>{n}</button>
              );
            })}
          </div>
        </div>
      </div>
      <HomeIndicator dark />
    </ScreenShell>
  );
}

// ── 4. END OF ROUND ───────────────────────────────────────────────────────
function EndOfRoundScreen() {
  const finals = [
    { name: 'Jules', init: 'JK', color: FT.orange, total: 51, vs: -3, place: 1 },
    { name: 'Soren', init: 'ST', color: FT.amber,  total: 54, vs:  0, place: 2 },
    { name: 'Mara',  init: 'MR', color: FT.fern,   total: 56, vs:  2, place: 3 },
  ];
  const PARS = [3,3,4,3,3,4,3,5,3, 3,4,3,3,3,4,3,5,3];
  const SCORES = {
    JK: [3,2,4,2,3,4,3,5,2, 3,3,3,3,2,4,3,5,2],
    ST: [3,3,4,3,3,4,3,5,3, 3,4,3,4,3,4,3,5,3],
    MR: [3,4,4,3,4,4,3,5,3, 3,4,3,4,3,4,4,5,3],
  };
  const colorFor = { JK: FT.orange, ST: FT.amber, MR: FT.fern };

  const cellTone = (s, par) => {
    const d = s - par;
    if (d <= -2) return { bg: FT.orange, fg: FT.ink, ring: '50%' }; // eagle
    if (d === -1) return { bg: FT.orange, fg: FT.ink };              // birdie
    if (d === 0)  return { bg: 'transparent', fg: FT.ink };          // par
    if (d === 1)  return { bg: 'transparent', fg: FT.ink, box: true };
    return { bg: FT.bark, fg: FT.cream, box: true };                  // double+
  };

  const HoleRow = ({ holes, sliceFrom = 0 }) => (
    <div style={{ display: 'grid', gridTemplateColumns: `64px repeat(${holes.length}, 1fr) 44px`, alignItems: 'center', borderBottom: `1px solid ${FT.hair}`, fontFamily: SFR }}>
      <div style={{ fontFamily: MONO, fontSize: 9, color: FT.dim, padding: '6px 0 6px 8px', letterSpacing: 1.5 }}>HOLE</div>
      {holes.map((h, i) => (
        <div key={i} style={{ textAlign: 'center', fontWeight: 700, fontSize: 11, color: FT.dim, padding: '6px 0' }}>{sliceFrom + i + 1}</div>
      ))}
      <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 10, color: FT.dim, fontFamily: MONO, letterSpacing: 1 }}>OUT</div>
    </div>
  );
  const ParRow = ({ pars, sliceFrom = 0 }) => (
    <div style={{ display: 'grid', gridTemplateColumns: `64px repeat(${pars.length}, 1fr) 44px`, alignItems: 'center', borderBottom: `1px solid ${FT.hair}`, background: 'rgba(42,31,23,0.04)', fontFamily: SFR }}>
      <div style={{ fontFamily: MONO, fontSize: 9, color: FT.dim, padding: '6px 0 6px 8px', letterSpacing: 1.5 }}>PAR</div>
      {pars.map((p, i) => (
        <div key={i} style={{ textAlign: 'center', fontWeight: 800, fontSize: 12, padding: '6px 0', color: FT.ink }}>{p}</div>
      ))}
      <div style={{ textAlign: 'center', fontWeight: 900, fontSize: 13, color: FT.ink }}>
        {pars.reduce((a, b) => a + b, 0)}
      </div>
    </div>
  );
  const PlayerRow = ({ pid, scores, pars, sliceFrom = 0 }) => {
    const out = scores.reduce((a, b) => a + b, 0);
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `64px repeat(${scores.length}, 1fr) 44px`, alignItems: 'center', borderBottom: `1px solid ${FT.hair}`, fontFamily: SFR }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0 8px 8px' }}>
          <div style={{ width: 18, height: 18, borderRadius: 5, background: colorFor[pid], color: FT.ink, fontSize: 9, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{pid}</div>
        </div>
        {scores.map((s, i) => {
          const t = cellTone(s, pars[i]);
          return (
            <div key={i} style={{ textAlign: 'center', padding: '4px 2px' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 22, height: 22, borderRadius: t.ring || (t.box ? 4 : 11),
                background: t.bg, color: t.fg,
                outline: t.box && t.bg === 'transparent' ? `1.5px solid ${FT.ink}` : 'none',
                outlineOffset: -2,
                fontWeight: 800, fontSize: 13,
              }}>{s}</span>
            </div>
          );
        })}
        <div style={{ textAlign: 'center', fontWeight: 900, fontSize: 14, color: FT.ink }}>{out}</div>
      </div>
    );
  };

  return (
    <ScreenShell label="04 End of Round" bg={FT.cream}>
      <StatusBar />

      {/* Hero result */}
      <div style={{ padding: '4px 22px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: FT.dim, textTransform: 'uppercase' }}>Final · Bear Creek</div>
          <div style={{ fontSize: 13, color: FT.orange, fontWeight: 700 }}>Share ↗</div>
        </div>
        <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 38, letterSpacing: -1.4, lineHeight: 1, marginTop: 6 }}>
          Jules takes it.
        </div>
        <div style={{ fontSize: 13, color: FT.dim, marginTop: 4 }}>1h 47m · 18 holes · par 54</div>
      </div>

      {/* Podium leaderboard */}
      <div style={{ padding: '0 16px' }}>
        <div style={{ background: FT.forest, borderRadius: 20, padding: 14, position: 'relative', overflow: 'hidden' }}>
          <TopoBg color="rgba(244,239,228,0.07)" />
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {finals.map((p) => {
              const winner = p.place === 1;
              return (
                <div key={p.name} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px',
                  background: winner ? FT.orange : 'rgba(244,239,228,0.08)',
                  borderRadius: 14,
                  color: winner ? FT.ink : FT.cream,
                }}>
                  <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 22, width: 22, textAlign: 'center', letterSpacing: -1 }}>
                    {p.place}
                  </div>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, background: p.color, color: FT.ink,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: SFR, fontWeight: 900, fontSize: 12, border: winner ? `2px solid ${FT.ink}` : 'none',
                  }}>{p.init}</div>
                  <div style={{ flex: 1, fontFamily: SFR, fontWeight: 800, fontSize: 16, letterSpacing: -0.2 }}>{p.name}</div>
                  <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 22, letterSpacing: -0.5 }}>{p.total}</div>
                  <ParChip value={p.vs} size="md" tone={winner ? 'par' : undefined} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Scorecard table */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: FT.dim, textTransform: 'uppercase', marginBottom: 8 }}>Scorecard</div>
        <div style={{ background: FT.paper, borderRadius: 14, border: `1px solid ${FT.hair}`, overflow: 'hidden' }}>
          {/* Front 9 */}
          <HoleRow holes={PARS.slice(0, 9)} sliceFrom={0} />
          <ParRow pars={PARS.slice(0, 9)} />
          <PlayerRow pid="JK" scores={SCORES.JK.slice(0, 9)} pars={PARS.slice(0, 9)} />
          <PlayerRow pid="ST" scores={SCORES.ST.slice(0, 9)} pars={PARS.slice(0, 9)} />
          <PlayerRow pid="MR" scores={SCORES.MR.slice(0, 9)} pars={PARS.slice(0, 9)} />
        </div>
        <div style={{ height: 6 }} />
        <div style={{ background: FT.paper, borderRadius: 14, border: `1px solid ${FT.hair}`, overflow: 'hidden' }}>
          <HoleRow holes={PARS.slice(9)} sliceFrom={9} />
          <ParRow pars={PARS.slice(9)} />
          <PlayerRow pid="JK" scores={SCORES.JK.slice(9)} pars={PARS.slice(9)} />
          <PlayerRow pid="ST" scores={SCORES.ST.slice(9)} pars={PARS.slice(9)} />
          <PlayerRow pid="MR" scores={SCORES.MR.slice(9)} pars={PARS.slice(9)} />
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: '10px 0 4px', fontFamily: MONO, fontSize: 10, color: FT.dim, letterSpacing: 1 }}>
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

      <HomeIndicator />
    </ScreenShell>
  );
}

// ── 5. STATS / HISTORY ────────────────────────────────────────────────────
function StatsScreen() {
  const h2h = [
    { name: 'Mara',  init: 'MR', color: FT.fern,   wins: 9,  losses: 4, last: 'W' },
    { name: 'Soren', init: 'ST', color: FT.amber,  wins: 6,  losses: 7, last: 'L' },
    { name: 'Avery', init: 'AV', color: FT.bark,   wins: 3,  losses: 1, last: 'W' },
  ];
  const rounds = [
    { course: 'Bear Creek',   date: 'May 4',  vs: -3, win: true },
    { course: 'Pine Hollow',  date: 'May 1',  vs:  1, win: false },
    { course: 'Riverbend',    date: 'Apr 28', vs: -1, win: true },
    { course: 'Bear Creek',   date: 'Apr 22', vs:  2, win: false },
  ];

  return (
    <ScreenShell label="05 Stats" bg={FT.cream}>
      <StatusBar />

      <div style={{ padding: '4px 22px 12px' }}>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: FT.dim, textTransform: 'uppercase' }}>Your stats</div>
        <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 34, letterSpacing: -1.2, lineHeight: 1, marginTop: 4 }}>
          The book on Jules.
        </div>
      </div>

      {/* Headline stats */}
      <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 8 }}>
        <div style={{ background: FT.forest, color: FT.cream, borderRadius: 18, padding: '14px 14px', position: 'relative', overflow: 'hidden' }}>
          <TopoBg color="rgba(244,239,228,0.08)" />
          <div style={{ position: 'relative' }}>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1.5, opacity: 0.6 }}>AVG vs PAR</div>
            <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 44, letterSpacing: -2, lineHeight: 0.95, marginTop: 4 }}>
              −1.8
            </div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>last 10 rounds</div>
          </div>
        </div>
        <div style={{ background: FT.paper, borderRadius: 18, padding: '14px 14px', border: `1px solid ${FT.hair}` }}>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1.5, color: FT.dim }}>BIRDIES</div>
          <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 32, letterSpacing: -1, lineHeight: 1, marginTop: 4, color: FT.orange }}>42</div>
          <div style={{ fontSize: 11, color: FT.dim, marginTop: 2 }}>this season</div>
        </div>
        <div style={{ background: FT.paper, borderRadius: 18, padding: '14px 14px', border: `1px solid ${FT.hair}` }}>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1.5, color: FT.dim }}>WIN %</div>
          <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 32, letterSpacing: -1, lineHeight: 1, marginTop: 4 }}>61</div>
          <div style={{ fontSize: 11, color: FT.dim, marginTop: 2 }}>18 of 30</div>
        </div>
      </div>

      {/* Head to head */}
      <div style={{ padding: '20px 22px 8px' }}>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: FT.dim, textTransform: 'uppercase' }}>Head to head</div>
      </div>
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {h2h.map((p) => {
          const total = p.wins + p.losses;
          const pct = (p.wins / total) * 100;
          return (
            <div key={p.name} style={{
              background: FT.paper, borderRadius: 14, padding: '10px 12px',
              border: `1px solid ${FT.hair}`,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: p.color, color: FT.ink,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: SFR, fontWeight: 900, fontSize: 12,
              }}>{p.init}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: SFR, fontWeight: 700, fontSize: 15 }}>vs {p.name}</span>
                  <span style={{ fontFamily: SFR, fontWeight: 900, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ color: FT.forest }}>{p.wins}</span>
                    <span style={{ color: FT.dim, margin: '0 4px' }}>—</span>
                    <span style={{ color: FT.bark }}>{p.losses}</span>
                  </span>
                </div>
                {/* W/L bar */}
                <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 6, background: 'rgba(42,31,23,0.08)' }}>
                  <div style={{ width: `${pct}%`, background: FT.forest }} />
                  <div style={{ width: `${100 - pct}%`, background: FT.bark, opacity: 0.3 }} />
                </div>
              </div>
              <div style={{
                width: 22, height: 22, borderRadius: 11,
                background: p.last === 'W' ? FT.orange : 'rgba(42,31,23,0.1)',
                color: p.last === 'W' ? FT.ink : FT.dim,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: SFR, fontWeight: 900, fontSize: 11,
              }}>{p.last}</div>
            </div>
          );
        })}
      </div>

      {/* Past rounds */}
      <div style={{ padding: '20px 22px 8px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: FT.dim, textTransform: 'uppercase' }}>Past rounds</div>
        <div style={{ fontSize: 13, color: FT.orange, fontWeight: 700 }}>Filter</div>
      </div>
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rounds.map((r) => (
          <div key={r.course + r.date} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: FT.paper, borderRadius: 12, padding: '10px 12px',
            border: `1px solid ${FT.hair}`,
          }}>
            <div style={{
              width: 6, alignSelf: 'stretch', borderRadius: 3,
              background: r.win ? FT.orange : 'rgba(42,31,23,0.2)',
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 15 }}>{r.course}</div>
              <div style={{ fontSize: 11, color: FT.dim, marginTop: 1, fontFamily: MONO, letterSpacing: 0.5 }}>{r.date.toUpperCase()}</div>
            </div>
            <ParChip value={r.vs} size="md" />
            <svg width="7" height="11" viewBox="0 0 7 11" fill="none"><path d="M1 1l4 4.5L1 10" stroke={FT.dim} strokeWidth="1.6" strokeLinecap="round"/></svg>
          </div>
        ))}
      </div>

      <HomeIndicator />
    </ScreenShell>
  );
}

Object.assign(window, {
  HomeScreen, StartRoundScreen, LiveScorecardScreen, EndOfRoundScreen, StatsScreen,
});
