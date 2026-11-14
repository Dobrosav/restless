// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  DEFAULT_THEME,
  THEME_BG_KEY,
  THEME_TEXT_KEY,
  hexToRgb,
  rgbToHex,
  rgbToHsv,
  hsvToRgb,
  hexToHsv,
  hsvToHex,
  mixColors,
  getBrightness,
  applyTheme,
  loadThemeFromStorage,
  saveThemeToStorage,
} from './theme'

describe('theme utilities', () => {
  beforeEach(() => {
    localStorage.clear()
    applyTheme(DEFAULT_THEME)
  })

  describe('hexToRgb', () => {
    it('parses 6-digit hex colors', () => {
      expect(hexToRgb('#111827')).toEqual({ r: 17, g: 24, b: 39 })
      expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 })
      expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 })
    })

    it('parses 3-digit shorthand hex colors', () => {
      expect(hexToRgb('#abc')).toEqual({ r: 170, g: 187, b: 204 })
      expect(hexToRgb('#f0a')).toEqual({ r: 255, g: 0, b: 170 })
    })

    it('returns null for invalid hex strings', () => {
      expect(hexToRgb('111827')).toBeNull()
      expect(hexToRgb('#12')).toBeNull()
      expect(hexToRgb('#zzzzzz')).toBeNull()
      expect(hexToRgb('')).toBeNull()
    })
  })

  describe('rgbToHex', () => {
    it('formats rgb components as lowercase hex', () => {
      expect(rgbToHex(17, 24, 39)).toBe('#111827')
      expect(rgbToHex(255, 255, 255)).toBe('#ffffff')
      expect(rgbToHex(0, 0, 0)).toBe('#000000')
    })

    it('clamps out-of-range values and rounds decimals', () => {
      expect(rgbToHex(-10, 300, 127.6)).toBe('#00ff80')
    })
  })

  describe('mixColors', () => {
    it('interpolates between two colors', () => {
      expect(mixColors('#000000', '#ffffff', 0)).toBe('#000000')
      expect(mixColors('#000000', '#ffffff', 1)).toBe('#ffffff')
      expect(mixColors('#000000', '#ffffff', 0.5)).toBe('#808080')
    })

    it('clamps weight outside [0, 1]', () => {
      expect(mixColors('#102030', '#405060', -0.5)).toBe('#102030')
      expect(mixColors('#102030', '#405060', 1.5)).toBe('#405060')
    })
  })

  describe('getBrightness', () => {
    it('calculates perceived brightness', () => {
      expect(getBrightness('#000000')).toBe(0)
      expect(getBrightness('#ffffff')).toBe(255)
      expect(getBrightness('#111827')).toBeLessThan(128)
      expect(getBrightness('#f3f4f6')).toBeGreaterThan(128)
    })
  })

  describe('storage persistence', () => {
    it('returns DEFAULT_THEME when localStorage is empty', () => {
      expect(loadThemeFromStorage()).toEqual(DEFAULT_THEME)
    })

    it('saves and loads custom theme colors', () => {
      const custom = { bgColor: '#1a2b3c', textColor: '#e5e7eb' }
      saveThemeToStorage(custom)
      expect(localStorage.getItem(THEME_BG_KEY)).toBe('#1a2b3c')
      expect(localStorage.getItem(THEME_TEXT_KEY)).toBe('#e5e7eb')
      expect(loadThemeFromStorage()).toEqual(custom)
    })

    it('falls back to DEFAULT_THEME for invalid values in localStorage', () => {
      localStorage.setItem(THEME_BG_KEY, 'not-a-color')
      localStorage.setItem(THEME_TEXT_KEY, '#123')
      expect(loadThemeFromStorage()).toEqual({
        bgColor: DEFAULT_THEME.bgColor,
        textColor: '#112233',
      })
    })
  })

  describe('applyTheme', () => {
    it('sets CSS variables and body styles for custom dark theme', () => {
      applyTheme({ bgColor: '#101520', textColor: '#f0f4f8' })

      const rootStyle = document.documentElement.style
      expect(rootStyle.getPropertyValue('--color-gray-900')).toBe('#101520')
      expect(rootStyle.getPropertyValue('--color-gray-800')).toBe(mixColors('#101520', '#ffffff', 0.07))
      expect(rootStyle.getPropertyValue('--color-gray-700')).toBe(mixColors('#101520', '#ffffff', 0.15))
      expect(rootStyle.getPropertyValue('--color-gray-600')).toBe(mixColors('#101520', '#ffffff', 0.24))
      expect(rootStyle.getPropertyValue('--color-editor-bg')).toBe(mixColors('#101520', '#ffffff', 0.04))

      expect(rootStyle.getPropertyValue('--color-white')).toBe('#f0f4f8')
      expect(rootStyle.getPropertyValue('--color-gray-100')).toBe(mixColors('#f0f4f8', '#101520', 0.06))
      expect(rootStyle.getPropertyValue('--color-gray-400')).toBe(mixColors('#f0f4f8', '#101520', 0.35))
      expect(document.body.style.backgroundColor).toBeTruthy()
      expect(document.body.style.color).toBeTruthy()
    })

    it('uses black surface contrast target for light background themes', () => {
      applyTheme({ bgColor: '#f8fafc', textColor: '#0f172a' })

      const rootStyle = document.documentElement.style
      expect(rootStyle.getPropertyValue('--color-gray-900')).toBe('#f8fafc')
      expect(rootStyle.getPropertyValue('--color-gray-800')).toBe(mixColors('#f8fafc', '#000000', 0.07))
      expect(rootStyle.getPropertyValue('--color-white')).toBe('#0f172a')
    })

    it('removes custom CSS variables and inline body styles when reset to DEFAULT_THEME', () => {
      applyTheme({ bgColor: '#222222', textColor: '#eeeeee' })
      expect(document.documentElement.style.getPropertyValue('--color-gray-900')).toBe('#222222')

      applyTheme(DEFAULT_THEME)
      const rootStyle = document.documentElement.style
      expect(rootStyle.getPropertyValue('--color-gray-900')).toBe('')
      expect(rootStyle.getPropertyValue('--color-white')).toBe('')
      expect(rootStyle.getPropertyValue('--color-editor-bg')).toBe('')
      expect(document.body.style.backgroundColor).toBe('')
      expect(document.body.style.color).toBe('')
    })
  })

  describe('HSV color conversions', () => {
    it('converts black, white, primary colors, and arbitrary colors round-trip', () => {
      const cases = ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#111827']
      for (const hex of cases) {
        const hsv = hexToHsv(hex)
        expect(hsvToHex(hsv.h, hsv.s, hsv.v)).toBe(hex)
      }
    })

    it('computes expected HSV values for primary and grayscale colors', () => {
      expect(rgbToHsv(0, 0, 0)).toEqual({ h: 0, s: 0, v: 0 })
      expect(rgbToHsv(255, 255, 255)).toEqual({ h: 0, s: 0, v: 100 })
      expect(rgbToHsv(255, 0, 0)).toEqual({ h: 0, s: 100, v: 100 })
      expect(rgbToHsv(0, 255, 0)).toEqual({ h: 120, s: 100, v: 100 })
      expect(rgbToHsv(0, 0, 255)).toEqual({ h: 240, s: 100, v: 100 })
    })

    it('converts HSV back to RGB accurately and handles hue wrapping', () => {
      expect(hsvToRgb(0, 100, 100)).toEqual({ r: 255, g: 0, b: 0 })
      expect(hsvToRgb(360, 100, 100)).toEqual({ r: 255, g: 0, b: 0 })
      expect(hsvToRgb(120, 100, 100)).toEqual({ r: 0, g: 255, b: 0 })
      expect(hsvToRgb(240, 100, 100)).toEqual({ r: 0, g: 0, b: 255 })
    })

    it('falls back gracefully for invalid hex in hexToHsv', () => {
      expect(hexToHsv('invalid')).toEqual({ h: 0, s: 0, v: 0 })
    })
  })
})
