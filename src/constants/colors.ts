export const FT = {
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
  barkAlpha08:   'rgba(42,31,23,0.08)',
  barkAlpha10:   'rgba(42,31,23,0.10)',
  barkAlpha25:   'rgba(42,31,23,0.25)',
  barkAlpha30:   'rgba(42,31,23,0.30)',
  barkAlpha35:   'rgba(42,31,23,0.35)',
  barkAlpha50:   'rgba(42,31,23,0.50)',
  creamAlpha06:  'rgba(244,239,228,0.06)',
  creamAlpha08:  'rgba(244,239,228,0.08)',
  forestAlpha04: 'rgba(31,61,43,0.04)',
  forestAlpha10: 'rgba(31,61,43,0.10)',
  orangeAlpha12: 'rgba(255,107,31,0.12)',
} as const

export const PLAYER_COLORS = [
  FT.orange, FT.fern, FT.amber, FT.sky, FT.rose, FT.bark,
] as const

export const SF   = '-apple-system, "SF Pro Display", "SF Pro Text", system-ui, sans-serif'
export const SFR  = '-apple-system, "SF Pro Rounded", "SF Pro Display", system-ui, sans-serif'
export const MONO = '"SF Mono", ui-monospace, Menlo, monospace'
