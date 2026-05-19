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
} as const

export const PLAYER_COLORS = [
  FT.orange, FT.fern, FT.amber, FT.sky, FT.rose, FT.bark,
] as const

export const SF   = '-apple-system, "SF Pro Display", "SF Pro Text", system-ui, sans-serif'
export const SFR  = '-apple-system, "SF Pro Rounded", "SF Pro Display", system-ui, sans-serif'
export const MONO = '"SF Mono", ui-monospace, Menlo, monospace'
