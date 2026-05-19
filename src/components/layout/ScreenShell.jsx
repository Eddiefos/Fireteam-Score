import { FT } from '../../constants/colors'

export function ScreenShell({ children, bg = FT.cream, dark = false, label }) {
  return (
    <div data-screen={label} style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: bg, color: dark ? FT.cream : FT.ink,
      position: 'relative', overflow: 'hidden',
    }}>{children}</div>
  )
}
