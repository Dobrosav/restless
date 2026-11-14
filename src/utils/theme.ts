export interface ThemeConfig {
  bgColor: string
  textColor: string
}

export const DEFAULT_THEME: ThemeConfig = {
  bgColor: '#111827',
  textColor: '#ffffff',
}

export const THEME_BG_KEY = 'restless_theme_bg'
export const THEME_TEXT_KEY = 'restless_theme_text'

const THEME_CSS_VARS = [
  '--color-gray-900',
  '--color-gray-800',
  '--color-gray-700',
  '--color-gray-600',
  '--color-gray-500',
  '--color-gray-400',
  '--color-gray-300',
  '--color-gray-200',
  '--color-gray-100',
  '--color-white',
  '--color-editor-bg',
] as const

export function normalizeHexColor(hex: string): string | null {
  if (typeof hex !== 'string') return null
  const trimmed = hex.trim()
  const shortMatch = /^#([0-9a-fA-F]{3})$/.exec(trimmed)
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].split('')
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  const fullMatch = /^#([0-9a-fA-F]{6})$/.exec(trimmed)
  if (fullMatch) {
    return `#${fullMatch[1].toLowerCase()}`
  }
  return null
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHexColor(hex)
  if (!normalized) return null
  const num = parseInt(normalized.slice(1), 16)
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  }
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const clamp = (val: number) => Math.max(0, Math.min(255, val))
  const rn = clamp(r) / 255
  const gn = clamp(g) / 255
  const bn = clamp(b) / 255

  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min

  let h = 0
  if (d !== 0) {
    if (max === rn) {
      h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60
    } else if (max === gn) {
      h = ((bn - rn) / d + 2) * 60
    } else {
      h = ((rn - gn) / d + 4) * 60
    }
  }

  const s = max === 0 ? 0 : (d / max) * 100
  const v = max * 100

  return { h, s, v }
}

export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const hn = ((h % 360) + 360) % 360
  const sn = Math.max(0, Math.min(100, s)) / 100
  const vn = Math.max(0, Math.min(100, v)) / 100

  const c = vn * sn
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1))
  const m = vn - c

  let r1 = 0
  let g1 = 0
  let b1 = 0

  if (hn < 60) {
    r1 = c; g1 = x; b1 = 0
  } else if (hn < 120) {
    r1 = x; g1 = c; b1 = 0
  } else if (hn < 180) {
    r1 = 0; g1 = c; b1 = x
  } else if (hn < 240) {
    r1 = 0; g1 = x; b1 = c
  } else if (hn < 300) {
    r1 = x; g1 = 0; b1 = c
  } else {
    r1 = c; g1 = 0; b1 = x
  }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  }
}

export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const rgb = hexToRgb(hex)
  if (!rgb) return { h: 0, s: 0, v: 0 }
  return rgbToHsv(rgb.r, rgb.g, rgb.b)
}

export function hsvToHex(h: number, s: number, v: number): string {
  const { r, g, b } = hsvToRgb(h, s, v)
  return rgbToHex(r, g, b)
}

export function mixColors(hex1: string, hex2: string, weight2: number): string {
  const rgb1 = hexToRgb(hex1)
  const rgb2 = hexToRgb(hex2)
  if (!rgb1 || !rgb2) {
    return normalizeHexColor(hex1) || normalizeHexColor(hex2) || '#000000'
  }
  const w2 = Math.max(0, Math.min(1, weight2))
  const w1 = 1 - w2
  return rgbToHex(
    rgb1.r * w1 + rgb2.r * w2,
    rgb1.g * w1 + rgb2.g * w2,
    rgb1.b * w1 + rgb2.b * w2
  )
}

export function getBrightness(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000
}

export function applyTheme(theme: ThemeConfig): void {
  if (typeof document === 'undefined') return

  const bgColor = normalizeHexColor(theme.bgColor) || DEFAULT_THEME.bgColor
  const textColor = normalizeHexColor(theme.textColor) || DEFAULT_THEME.textColor
  const root = document.documentElement
  const body = document.body

  if (
    bgColor === DEFAULT_THEME.bgColor &&
    textColor === DEFAULT_THEME.textColor
  ) {
    for (const cssVar of THEME_CSS_VARS) {
      root.style.removeProperty(cssVar)
    }
    if (body) {
      body.style.removeProperty('background-color')
      body.style.removeProperty('color')
    }
    return
  }

  const contrastTarget = getBrightness(bgColor) < 128 ? '#ffffff' : '#000000'

  root.style.setProperty('--color-gray-900', bgColor)
  root.style.setProperty('--color-gray-800', mixColors(bgColor, contrastTarget, 0.07))
  root.style.setProperty('--color-gray-700', mixColors(bgColor, contrastTarget, 0.15))
  root.style.setProperty('--color-gray-600', mixColors(bgColor, contrastTarget, 0.24))
  root.style.setProperty('--color-editor-bg', mixColors(bgColor, contrastTarget, 0.04))

  root.style.setProperty('--color-white', textColor)
  root.style.setProperty('--color-gray-100', mixColors(textColor, bgColor, 0.06))
  root.style.setProperty('--color-gray-200', mixColors(textColor, bgColor, 0.12))
  root.style.setProperty('--color-gray-300', mixColors(textColor, bgColor, 0.20))
  root.style.setProperty('--color-gray-400', mixColors(textColor, bgColor, 0.35))
  root.style.setProperty('--color-gray-500', mixColors(textColor, bgColor, 0.50))

  if (body) {
    body.style.backgroundColor = bgColor
    body.style.color = textColor
  }
}

export function loadThemeFromStorage(): ThemeConfig {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_THEME }
    const savedBg = localStorage.getItem(THEME_BG_KEY)
    const savedText = localStorage.getItem(THEME_TEXT_KEY)
    return {
      bgColor: (savedBg && normalizeHexColor(savedBg)) || DEFAULT_THEME.bgColor,
      textColor: (savedText && normalizeHexColor(savedText)) || DEFAULT_THEME.textColor,
    }
  } catch {
    return { ...DEFAULT_THEME }
  }
}

export function saveThemeToStorage(theme: ThemeConfig): void {
  try {
    if (typeof localStorage === 'undefined') return
    const bgColor = normalizeHexColor(theme.bgColor) || DEFAULT_THEME.bgColor
    const textColor = normalizeHexColor(theme.textColor) || DEFAULT_THEME.textColor
    localStorage.setItem(THEME_BG_KEY, bgColor)
    localStorage.setItem(THEME_TEXT_KEY, textColor)
  } catch {
    // Ignore storage quota or unavailability errors
  }
}
