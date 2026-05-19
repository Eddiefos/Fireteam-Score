import { useState, useCallback } from 'react'
import { FT, SF, SFR, MONO } from '../../constants/colors'
import { initialsOf } from '../../lib/gameLogic'

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

export {
  StatusBar, HomeIndicator, TopoBg, ParChip, Avatar,
  IconChevronLeft, IconChevronRight, IconArrow, IconClose,
  IconPlus, IconCheck, IconTrash, IconHamburger,
  Pill, EmptyState, useToast,
}
