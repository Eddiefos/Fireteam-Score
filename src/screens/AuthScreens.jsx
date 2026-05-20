import { useState } from 'react'
import { supabase } from '../services/supabase'
import { FT, SFR, SF, MONO, PLAYER_COLORS } from '../constants/colors'
import { ScreenShell } from '../components/layout/ScreenShell'
import {
  StatusBar, TopoBg,
  IconChevronLeft, IconArrow, Avatar,
} from '../components/atoms'
import { useProfile } from '../hooks/useProfile'

// ────────────────────────────────────────────────────────────────────────
//  Auth screens  (Landing → CreateAccount | Login)
// ────────────────────────────────────────────────────────────────────────
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

function AuthDisc() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
      <circle cx="26" cy="26" r="23" stroke={FT.orange} strokeWidth="2.5" fill="none"/>
      <circle cx="26" cy="26" r="15" stroke={FT.orange} strokeWidth="2" fill="none" opacity=".5"/>
      <circle cx="26" cy="26" r="5" fill={FT.orange}/>
      <path d="M26 3 A23 23 0 0 1 49 26" stroke={FT.orange} strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

function AuthHero({ slim = false }) {
  return (
    <div style={{
      background: FT.forest, position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'flex-end', padding: slim ? '32px 32px 28px' : '52px 32px 40px',
      flexShrink: 0,
    }}>
      <StatusBar />
      <TopoBg />
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        {!slim && <AuthDisc />}
        <div style={{
          fontFamily: SFR, fontWeight: 800, fontSize: slim ? 22 : 32,
          color: FT.cream, marginTop: slim ? 0 : 16, letterSpacing: -0.5,
        }}>Fireteam Score</div>
        {!slim && (
          <div style={{
            fontFamily: SF, fontSize: 15, color: 'rgba(244,239,228,0.65)',
            marginTop: 6,
          }}>Disc golf with the squad</div>
        )}
      </div>
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder = 'Password', id }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={id === 'password' ? 'new-password' : 'current-password'}
        maxLength={128}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '13px 44px 13px 14px', borderRadius: 12,
          border: `1.5px solid ${FT.hair}`, background: FT.paper,
          fontFamily: SF, fontSize: 16, color: FT.ink,
          outline: 'none', WebkitAppearance: 'none',
        }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', padding: 4,
          color: FT.dim, fontFamily: SF, fontSize: 13, fontWeight: 600,
        }}
      >{show ? 'Hide' : 'Show'}</button>
    </div>
  );
}

function AuthLabel({ children }) {
  return (
    <label style={{
      display: 'block', fontFamily: SFR, fontWeight: 700, fontSize: 12,
      color: FT.dim, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8,
    }}>{children}</label>
  );
}

function AuthInput({ value, onChange, type = 'text', placeholder, autoComplete, maxLength = 254, inputMode }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoComplete={autoComplete}
      inputMode={inputMode}
      maxLength={maxLength}
      style={{
        width: '100%', boxSizing: 'border-box',
        padding: '13px 14px', borderRadius: 12,
        border: `1.5px solid ${FT.hair}`, background: FT.paper,
        fontFamily: SF, fontSize: 16, color: FT.ink,
        outline: 'none', WebkitAppearance: 'none',
      }}
    />
  );
}

function AuthError({ msg }) {
  if (!msg) return null;
  return <div style={{ fontFamily: SF, fontSize: 13, color: '#E5556A', marginTop: -4 }}>{msg}</div>;
}

function AuthSubmitBtn({ disabled, loading, children }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      style={{
        width: '100%', padding: '15px', borderRadius: 14, border: 'none',
        background: disabled ? 'rgba(42,31,23,0.1)' : FT.orange,
        color: disabled ? FT.dim : FT.ink,
        fontFamily: SFR, fontWeight: 800, fontSize: 16,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'background 0.15s, color 0.15s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}
    >
      {loading ? <span style={{ opacity: 0.7 }}>Loading…</span> : children}
    </button>
  );
}

// ── Landing ──────────────────────────────────────────────────────────────
function LandingScreen({ onSignup, onLogin }) {
  return (
    <ScreenShell label="landing" bg={FT.cream}>
      <AuthHero />
      <div style={{ flex: 1, padding: '36px 28px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 12 }}>
        <button
          onClick={onSignup}
          style={{
            width: '100%', padding: '15px', borderRadius: 14, border: 'none',
            background: FT.orange, color: FT.ink,
            fontFamily: SFR, fontWeight: 800, fontSize: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          Create account <IconArrow size={18} />
        </button>
        <button
          onClick={onLogin}
          style={{
            width: '100%', padding: '15px', borderRadius: 14,
            border: `1.5px solid ${FT.hair}`, background: 'none',
            color: FT.ink, fontFamily: SFR, fontWeight: 700, fontSize: 16, cursor: 'pointer',
          }}
        >
          Log in
        </button>
      </div>
    </ScreenShell>
  );
}

// ── Create account ────────────────────────────────────────────────────────
function CreateAccountScreen({ onBack, onLogin }) {
  const [username, setUsername] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [status, setStatus]     = useState('idle'); // idle | loading | sent | error
  const [errMsg, setErrMsg]     = useState('');

  function validate() {
    if (!USERNAME_RE.test(username.trim()))
      return 'Username must be 3–20 characters (letters, numbers, underscores).';
    if (!EMAIL_RE.test(email.trim()))
      return 'Enter a valid email address.';
    if (password.length < 6)
      return 'Password must be at least 6 characters.';
    if (password !== confirm)
      return 'Passwords do not match.';
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const err = validate();
    if (err) { setErrMsg(err); setStatus('error'); return; }

    setStatus('loading');
    setErrMsg('');

    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          username: username.trim().toLowerCase(),
          display_name: username.trim(),
        },
      },
    });

    if (error) {
      setStatus('error');
      setErrMsg(
        error.message.includes('already registered')
          ? 'An account with this email already exists.'
          : error.message.includes('rate')
          ? 'Too many attempts. Please wait a moment and try again.'
          : 'Something went wrong. Please try again.'
      );
      return;
    }

    setStatus('sent');
  }

  if (status === 'sent') {
    return (
      <ScreenShell label="signup-confirm" bg={FT.cream}>
        <AuthHero slim />
        <div style={{
          flex: 1, padding: '36px 28px 40px', display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: FT.forest,
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="6" width="18" height="13" rx="2" stroke={FT.cream} strokeWidth="2"/>
              <path d="M3 8l9 6 9-6" stroke={FT.cream} strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ fontFamily: SFR, fontWeight: 800, fontSize: 22, color: FT.ink, marginBottom: 10 }}>
            Verify your email
          </div>
          <div style={{ fontFamily: SF, fontSize: 15, color: FT.dim, lineHeight: 1.6, maxWidth: 280 }}>
            We sent a verification link to{' '}
            <strong style={{ color: FT.ink }}>{email.trim().toLowerCase()}</strong>.
            Click the link to activate your account.
          </div>
          <button
            onClick={onLogin}
            style={{
              marginTop: 32, width: '100%', padding: '15px', borderRadius: 14, border: 'none',
              background: FT.orange, color: FT.ink,
              fontFamily: SFR, fontWeight: 800, fontSize: 16, cursor: 'pointer',
            }}
          >
            Go to log in
          </button>
        </div>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell label="signup" bg={FT.cream}>
      <AuthHero slim />
      <div className="ft-scroll" style={{ padding: '28px 28px 40px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 20px', display: 'flex', alignItems: 'center', gap: 6, color: FT.dim, fontFamily: SF, fontSize: 14 }}>
          <IconChevronLeft color={FT.dim} size={16} /> Back
        </button>
        <div style={{ fontFamily: SFR, fontWeight: 800, fontSize: 22, color: FT.ink, marginBottom: 6 }}>Create account</div>
        <div style={{ fontFamily: SF, fontSize: 15, color: FT.dim, marginBottom: 28, lineHeight: 1.5 }}>
          Pick a username and set up your account.
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <AuthLabel>Username</AuthLabel>
            <AuthInput
              value={username}
              onChange={(e) => { setUsername(e.target.value); setStatus('idle'); setErrMsg(''); }}
              placeholder="e.g. discking42"
              autoComplete="username"
              maxLength={20}
            />
            <div style={{ fontFamily: SF, fontSize: 12, color: FT.dim, marginTop: 5 }}>
              3–20 characters, letters, numbers and underscores only.
            </div>
          </div>
          <div>
            <AuthLabel>Email</AuthLabel>
            <AuthInput
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setStatus('idle'); setErrMsg(''); }}
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
            />
          </div>
          <div>
            <AuthLabel>Password</AuthLabel>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setStatus('idle'); setErrMsg(''); }}
              placeholder="At least 6 characters"
            />
          </div>
          <div>
            <AuthLabel>Confirm password</AuthLabel>
            <PasswordInput
              id="confirm"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setStatus('idle'); setErrMsg(''); }}
              placeholder="Repeat password"
            />
          </div>

          <AuthError msg={errMsg} />

          <AuthSubmitBtn disabled={status === 'loading'} loading={status === 'loading'}>
            Create account <IconArrow size={18} />
          </AuthSubmitBtn>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center', fontFamily: SF, fontSize: 14, color: FT.dim }}>
          Already have an account?{' '}
          <button onClick={onLogin} style={{ background: 'none', border: 'none', cursor: 'pointer', color: FT.forest, fontFamily: SFR, fontWeight: 700, fontSize: 14, padding: 0 }}>
            Log in
          </button>
        </div>
      </div>
    </ScreenShell>
  );
}

// ── Log in ────────────────────────────────────────────────────────────────
function LoginScreen({ onBack, onSignup }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus]     = useState('idle'); // idle | loading | error
  const [errMsg, setErrMsg]     = useState('');

  const canSubmit = status !== 'loading' && EMAIL_RE.test(email.trim()) && password.length >= 6;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setStatus('loading');
    setErrMsg('');

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      setStatus('error');
      setErrMsg('Incorrect email or password.');
      return;
    }
    // onAuthStateChange in App will handle the session and re-render automatically
  }

  return (
    <ScreenShell label="login" bg={FT.cream}>
      <AuthHero slim />
      <div className="ft-scroll" style={{ padding: '28px 28px 40px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 20px', display: 'flex', alignItems: 'center', gap: 6, color: FT.dim, fontFamily: SF, fontSize: 14 }}>
          <IconChevronLeft color={FT.dim} size={16} /> Back
        </button>
        <div style={{ fontFamily: SFR, fontWeight: 800, fontSize: 22, color: FT.ink, marginBottom: 6 }}>
          Log in
        </div>
        <div style={{ fontFamily: SF, fontSize: 15, color: FT.dim, marginBottom: 28, lineHeight: 1.5 }}>
          Welcome back. Enter your email and password.
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <AuthLabel>Email</AuthLabel>
            <AuthInput
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setStatus('idle'); setErrMsg(''); }}
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
            />
          </div>
          <div>
            <AuthLabel>Password</AuthLabel>
            <PasswordInput
              id="current-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setStatus('idle'); setErrMsg(''); }}
              placeholder="Your password"
            />
          </div>

          <AuthError msg={errMsg} />

          <AuthSubmitBtn disabled={!canSubmit} loading={status === 'loading'}>
            Log in <IconArrow size={18} />
          </AuthSubmitBtn>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center', fontFamily: SF, fontSize: 14, color: FT.dim }}>
          Don't have an account?{' '}
          <button onClick={onSignup} style={{ background: 'none', border: 'none', cursor: 'pointer', color: FT.forest, fontFamily: SFR, fontWeight: 700, fontSize: 14, padding: 0 }}>
            Create one
          </button>
        </div>
      </div>
    </ScreenShell>
  );
}

// ────────────────────────────────────────────────────────────────────────
//  Account screen
// ────────────────────────────────────────────────────────────────────────
function AccountScreen({ session, go, userId }) {
  const email    = session?.user?.email ?? '';
  const username = session?.user?.user_metadata?.username || email.split('@')[0];
  const { profile } = useProfile(userId);
  const [signingOut, setSigningOut] = useState(false);

  const displayName = profile?.display_name || username;
  const initials    = profile?.initials || username.slice(0, 2).toUpperCase();
  const avatarColor = profile?.avatar_color || FT.orange;

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
  }

  return (
    <ScreenShell label="account" bg={FT.cream}>
      <StatusBar />
      <div className="ft-scroll" style={{ padding: '20px 24px 32px' }}>
        <div style={{ fontFamily: SFR, fontWeight: 600, fontSize: 34, letterSpacing: -1.2, lineHeight: 1.05, color: FT.ink, marginBottom: 24 }}>
          Account
        </div>

        {/* Avatar + info */}
        <div style={{
          background: FT.paper, borderRadius: 16, border: `1px solid ${FT.hair}`,
          padding: '20px', display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12,
        }}>
          <Avatar name={initials} color={avatarColor} size={56} fontSize={20} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: SFR, fontWeight: 800, fontSize: 17, color: FT.ink, marginBottom: 3 }}>
              {displayName}
            </div>
            <div style={{ fontFamily: SF, fontSize: 13, color: FT.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {email}
            </div>
          </div>
        </div>

        {/* Info + edit profile */}
        <div style={{
          background: FT.paper, borderRadius: 16, border: `1px solid ${FT.hair}`,
          overflow: 'hidden', marginBottom: 24,
        }}>
          {[
            { label: 'Username', value: username },
            { label: 'Member since', value: new Date(session?.user?.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) },
          ].map(({ label, value }) => (
            <div key={label} style={{
              padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderBottom: `1px solid ${FT.hair}`,
            }}>
              <span style={{ fontFamily: SF, fontSize: 15, color: FT.ink }}>{label}</span>
              <span style={{ fontFamily: SF, fontSize: 15, color: FT.dim }}>{value}</span>
            </div>
          ))}
          <button onClick={() => go('settings')} className="flat" style={{
            width: '100%', padding: '14px 18px', border: 'none', background: 'none',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontFamily: SF, fontSize: 15, color: FT.ink }}>Edit profile</span>
            <span style={{ color: FT.dim, fontSize: 15 }}>›</span>
          </button>
        </div>

        {/* Admin: Course Submissions */}
        {profile?.is_admin && (
          <button
            onClick={() => go('admin')}
            style={{
              width: '100%', background: FT.paper, border: `1px solid ${FT.hair}`,
              borderRadius: 12, padding: '12px 14px', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer', textAlign: 'left', marginTop: 8,
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: FT.ink }}>Course Submissions</div>
              <div style={{ fontSize: 11, color: FT.dim, marginTop: 2 }}>Review pending community submissions</div>
            </div>
            <span style={{ fontSize: 12, color: FT.dim }}>→</span>
          </button>
        )}

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          style={{
            width: '100%', padding: '15px', borderRadius: 14, border: 'none',
            background: 'rgba(229,85,106,0.1)', color: '#E5556A',
            fontFamily: SFR, fontWeight: 800, fontSize: 16,
            cursor: signingOut ? 'default' : 'pointer', opacity: signingOut ? 0.6 : 1,
          }}
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </ScreenShell>
  );
}

// ────────────────────────────────────────────────────────────────────────
//  Settings (just a name field for now)
//  Props-based to avoid circular imports with App.jsx
// ────────────────────────────────────────────────────────────────────────
function deriveInitials(name) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return ''
}

function SettingsScreen({ go, userId }) {
  const { profile, updateProfile } = useProfile(userId)

  const [name, setName] = useState('')
  const [initials, setInitials] = useState('')
  const [color, setColor] = useState(FT.orange)
  const [initialsEdited, setInitialsEdited] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Populate fields once profile loads (only on first load)
  if (profile && !loaded) {
    setName(profile.display_name || '')
    setInitials(profile.initials || '')
    setColor(profile.avatar_color || FT.orange)
    setLoaded(true)
  }

  const handleNameChange = (val) => {
    setName(val)
    if (!initialsEdited) setInitials(deriveInitials(val))
  }

  const handleInitialsChange = (val) => {
    const clean = val.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2)
    setInitials(clean)
    setInitialsEdited(true)
  }

  const canSave = name.trim().length > 0 && initials.length > 0

  const save = async () => {
    if (!canSave || saving) return
    setSaving(true)
    try {
      await updateProfile({ display_name: name.trim(), initials, avatar_color: color })
      go('home')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScreenShell label="Settings">
      <StatusBar />
      <div style={{ padding: '6px 24px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <button onClick={() => go('home')} className="flat" style={{
          width: 36, height: 36, borderRadius: 12, background: FT.paper,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${FT.hair}`,
        }}><IconChevronLeft /></button>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: FT.dim }}>YOU</div>
        <div style={{ width: 36 }} />
      </div>

      <div className="ft-scroll">
        {/* Avatar preview */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 24px' }}>
          <Avatar name={initials || name} color={color} size={88} fontSize={28} />
        </div>

        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Name */}
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: FT.dim, marginBottom: 6 }}>NAME</div>
            <input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Your name"
              style={{
                width: '100%', height: 56, padding: '0 18px',
                background: FT.paper, border: `2px solid ${FT.hair}`, borderRadius: 14,
                fontFamily: SFR, fontWeight: 800, fontSize: 20, color: FT.ink, outline: 'none',
              }}
              onFocus={(e) => e.target.style.borderColor = FT.orange}
              onBlur={(e) => e.target.style.borderColor = FT.hair}
            />
          </div>

          {/* Initials */}
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: FT.dim, marginBottom: 6 }}>INITIALS</div>
            <input
              value={initials}
              onChange={(e) => handleInitialsChange(e.target.value)}
              placeholder="EF"
              maxLength={2}
              style={{
                width: '100%', height: 56, padding: '0 18px',
                background: FT.paper, border: `2px solid ${FT.hair}`, borderRadius: 14,
                fontFamily: MONO, fontWeight: 800, fontSize: 22, letterSpacing: 4, color: FT.ink, outline: 'none',
              }}
              onFocus={(e) => e.target.style.borderColor = FT.orange}
              onBlur={(e) => e.target.style.borderColor = FT.hair}
            />
          </div>

          {/* Color picker */}
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: FT.dim, marginBottom: 10 }}>COLOUR</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {PLAYER_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="flat"
                  style={{
                    flex: 1, aspectRatio: '1', borderRadius: '50%',
                    background: c, border: 'none',
                    outline: color === c ? `3px solid ${FT.ink}` : '3px solid transparent',
                    outlineOffset: 2,
                    transition: 'outline 120ms',
                  }}
                />
              ))}
            </div>
          </div>

          <button onClick={save} disabled={!canSave || saving} className="flat" style={{
            width: '100%', marginTop: 8, height: 56, borderRadius: 16, border: 'none',
            background: canSave ? FT.forest : 'rgba(42,31,23,0.15)',
            color: canSave ? FT.cream : FT.dim,
            fontFamily: SFR, fontWeight: 900, fontSize: 17, letterSpacing: -0.3,
          }}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </ScreenShell>
  )
}

export { LandingScreen, CreateAccountScreen, LoginScreen, AccountScreen, SettingsScreen }
