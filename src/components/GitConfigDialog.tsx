import { useState, useEffect, useRef } from 'react'
import {
  ThemeConfig,
  DEFAULT_THEME,
  normalizeHexColor,
  hexToRgb,
  rgbToHex,
  hexToHsv,
  hsvToHex,
} from '../utils/theme'

interface GitConfigDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (config: { userName: string; userEmail: string }) => void
  theme: ThemeConfig
  onThemeChange: (theme: ThemeConfig) => void
}

const PRESET_COLORS = [
  '#111827',
  '#000000',
  '#0f172a',
  '#1e1b4b',
  '#ffffff',
  '#f8fafc',
  '#e2e8f0',
  '#38bdf8',
]

interface ColorPickerFieldProps {
  label: string
  value: string
  textValue: string
  placeholder: string
  pickerAriaLabel: string
  isOpen: boolean
  onToggle: () => void
  onClosePopover: () => void
  onChange: (value: string) => void
  onTextBlur: () => void
}

function ColorPickerField({
  label,
  value,
  textValue,
  placeholder,
  pickerAriaLabel,
  isOpen,
  onToggle,
  onClosePopover,
  onChange,
  onTextBlur,
}: ColorPickerFieldProps) {
  const normalizedHex = normalizeHexColor(value) || '#000000'
  const [hsv, setHsv] = useState<{ h: number; s: number; v: number }>(() => hexToHsv(normalizedHex))
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const svBoxRef = useRef<HTMLDivElement>(null)
  const dragCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const currentFromHsv = hsvToHex(hsv.h, hsv.s, hsv.v)
    if (currentFromHsv !== normalizedHex) {
      const next = hexToHsv(normalizedHex)
      setHsv(prev => ({
        h: next.s === 0 || next.v === 0 ? prev.h : next.h,
        s: next.s,
        v: next.v,
      }))
    }
  }, [normalizedHex, hsv.h, hsv.s, hsv.v])

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.()
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (
        target &&
        !popoverRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        onClosePopover()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        onClosePopover()
      }
    }

    document.addEventListener('mousedown', handleMouseDown, true)
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isOpen, onClosePopover])

  const updateSvFromClientCoords = (clientX: number, clientY: number) => {
    const box = svBoxRef.current
    if (!box) return
    const rect = box.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return

    const s = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    const v = Math.max(0, Math.min(100, (1 - (clientY - rect.top) / rect.height) * 100))
    const nextHsv = { h: hsv.h, s, v }
    setHsv(nextHsv)
    onChange(hsvToHex(nextHsv.h, nextHsv.s, nextHsv.v))
  }

  const handleSvMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    updateSvFromClientCoords(e.clientX, e.clientY)

    const onMouseMove = (moveEvent: MouseEvent) => {
      updateSvFromClientCoords(moveEvent.clientX, moveEvent.clientY)
    }

    const cleanup = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', cleanup)
      dragCleanupRef.current = null
    }

    dragCleanupRef.current?.()
    dragCleanupRef.current = cleanup
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', cleanup)
  }

  const handleHueChange = (newH: number) => {
    const nextHsv = { ...hsv, h: newH }
    setHsv(nextHsv)
    onChange(hsvToHex(nextHsv.h, nextHsv.s, nextHsv.v))
  }

  const rgb = hexToRgb(normalizedHex) || { r: 0, g: 0, b: 0 }

  const handleRgbChange = (channel: 'r' | 'g' | 'b', raw: string) => {
    const parsed = raw === '' ? 0 : parseInt(raw, 10)
    if (Number.isNaN(parsed)) return
    const clamped = Math.max(0, Math.min(255, parsed))
    const nextRgb = { ...rgb, [channel]: clamped }
    const nextHex = rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b)
    const nextHsv = hexToHsv(nextHex)
    setHsv(prev => ({
      h: nextHsv.s === 0 || nextHsv.v === 0 ? prev.h : nextHsv.h,
      s: nextHsv.s,
      v: nextHsv.v,
    }))
    onChange(nextHex)
  }

  return (
    <div className="relative">
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          ref={triggerRef}
          onClick={onToggle}
          className="w-10 h-9 border border-gray-600 rounded-sm p-0.5 cursor-pointer shrink-0 shadow-xs"
          style={{ backgroundColor: normalizedHex }}
          aria-label={pickerAriaLabel}
          aria-expanded={isOpen}
        />
        <input
          type="text"
          value={textValue}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onTextBlur}
          placeholder={placeholder}
          className="flex-1 bg-gray-700 border border-gray-600 rounded-sm px-3 py-2 text-white text-sm font-mono"
        />
      </div>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute left-0 top-full mt-2 z-50 w-64 bg-gray-800 border border-gray-600 rounded-md shadow-2xl p-3 space-y-3"
        >
          {/* 2D Saturation / Value box */}
          <div
            ref={svBoxRef}
            onMouseDown={handleSvMouseDown}
            className="h-36 w-full rounded-sm relative cursor-crosshair select-none border border-gray-600 overflow-hidden"
            style={{ backgroundColor: `hsl(${hsv.h}, 100%, 50%)` }}
          >
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to right, #ffffff, transparent)' }}
            />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, #000000, transparent)' }}
            />
            <div
              className="absolute w-3.5 h-3.5 rounded-full border-2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                left: `${hsv.s}%`,
                top: `${100 - hsv.v}%`,
                borderColor: '#ffffff',
                boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.75)',
              }}
            />
          </div>

          {/* Hue slider */}
          <input
            type="range"
            min={0}
            max={360}
            value={Math.round(hsv.h)}
            onChange={(e) => handleHueChange(Number(e.target.value))}
            aria-label={`${label} Hue`}
            className="w-full h-3 rounded-sm appearance-none cursor-pointer"
            style={{
              background:
                'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
            }}
          />

          {/* RGB numeric inputs */}
          <div className="grid grid-cols-3 gap-1.5">
            {(['r', 'g', 'b'] as const).map((channel) => (
              <div key={channel} className="flex flex-col items-center">
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={rgb[channel]}
                  onChange={(e) => handleRgbChange(channel, e.target.value)}
                  aria-label={`${label} ${channel.toUpperCase()}`}
                  className="w-full bg-gray-700 border border-gray-600 rounded-sm px-1.5 py-1 text-white text-xs text-center font-mono"
                />
                <span className="text-[10px] text-gray-400 mt-0.5 uppercase">{channel}</span>
              </div>
            ))}
          </div>

          {/* Quick presets */}
          <div className="flex items-center justify-between gap-1 pt-1 border-t border-gray-700">
            {PRESET_COLORS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  onChange(preset)
                  onClosePopover()
                }}
                className="w-5 h-5 rounded-xs border border-gray-600 cursor-pointer shrink-0"
                style={{ backgroundColor: preset }}
                title={preset}
                aria-label={`Select color ${preset}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function GitConfigDialog({ isOpen, onClose, onSave, theme, onThemeChange }: GitConfigDialogProps) {
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [bgInput, setBgInput] = useState(theme.bgColor)
  const [textInput, setTextInput] = useState(theme.textColor)
  const [activePicker, setActivePicker] = useState<'bg' | 'text' | null>(null)
  const activePickerRef = useRef<'bg' | 'text' | null>(null)
  activePickerRef.current = activePicker

  useEffect(() => {
    setBgInput(theme.bgColor)
    setTextInput(theme.textColor)
  }, [theme.bgColor, theme.textColor])

  useEffect(() => {
    if (isOpen) {
      setActivePicker(null)
      setLoading(true)
      window.electronAPI?.gitGetConfig?.()
        .then(config => {
          setUserName(config.userName || '')
          setUserEmail(config.userEmail || '')
        })
        .catch(err => {
          console.error('Failed to load config:', err)
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setActivePicker(null)
    }
  }, [isOpen])

  const handleSave = () => {
    if (userName.trim() && userEmail.trim()) {
      onSave({ userName: userName.trim(), userEmail: userEmail.trim() })
      onClose()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && userName.trim() && userEmail.trim()) {
      handleSave()
    }
  }

  const handleBgColorChange = (value: string) => {
    setBgInput(value)
    const normalized = normalizeHexColor(value)
    if (normalized) {
      onThemeChange({
        bgColor: normalized,
        textColor: normalizeHexColor(theme.textColor) || DEFAULT_THEME.textColor,
      })
    }
  }

  const handleTextColorChange = (value: string) => {
    setTextInput(value)
    const normalized = normalizeHexColor(value)
    if (normalized) {
      onThemeChange({
        bgColor: normalizeHexColor(theme.bgColor) || DEFAULT_THEME.bgColor,
        textColor: normalized,
      })
    }
  }

  const handleThemeSave = () => {
    const resolvedBg = normalizeHexColor(bgInput) || normalizeHexColor(theme.bgColor) || DEFAULT_THEME.bgColor
    const resolvedText = normalizeHexColor(textInput) || normalizeHexColor(theme.textColor) || DEFAULT_THEME.textColor
    onThemeChange({ bgColor: resolvedBg, textColor: resolvedText })
    onClose()
  }

  const handleThemeReset = () => {
    setBgInput(DEFAULT_THEME.bgColor)
    setTextInput(DEFAULT_THEME.textColor)
    setActivePicker(null)
    onThemeChange({ ...DEFAULT_THEME })
  }

  if (!isOpen) return null

  const normalizedBg = normalizeHexColor(theme.bgColor) || DEFAULT_THEME.bgColor
  const normalizedText = normalizeHexColor(theme.textColor) || DEFAULT_THEME.textColor

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && activePickerRef.current === null) {
          onClose()
        }
      }}
    >
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-[720px] max-w-[95vw] border border-gray-700">
        <div className="flex items-center justify-between pb-3 mb-5 border-b border-gray-700">
          <h2 className="text-lg font-bold text-white">Configuration & Personalization</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Section 1: Git Configuration */}
          <div className="flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-white mb-1">Git Configuration</h3>
              <p className="text-sm text-gray-400 mb-4">
                Please enter your Git username and email for commits.
              </p>
              <div className="space-y-3" onKeyDown={handleKeyDown}>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Username</label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Your name"
                    className="w-full bg-gray-700 border border-gray-600 rounded-sm px-3 py-2 text-white text-sm"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Email</label>
                  <input
                    type="text"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full bg-gray-700 border border-gray-600 rounded-sm px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleSave}
                disabled={!userName.trim() || !userEmail.trim() || loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-sm text-sm font-medium"
              >
                {loading ? 'Loading...' : 'Save Git Config'}
              </button>
            </div>
          </div>

          {/* Section 2: Personalization */}
          <div className="flex flex-col justify-between border-t md:border-t-0 md:border-l border-gray-700 pt-5 md:pt-0 md:pl-6">
            <div>
              <h3 className="text-base font-bold text-white mb-1">Personalization</h3>
              <p className="text-sm text-gray-400 mb-4">
                Customize background and text colors.
              </p>
              <div className="space-y-3">
                <ColorPickerField
                  label="Background Color"
                  value={normalizedBg}
                  textValue={bgInput}
                  placeholder="#111827"
                  pickerAriaLabel="Background Color Picker"
                  isOpen={activePicker === 'bg'}
                  onToggle={() => setActivePicker(prev => (prev === 'bg' ? null : 'bg'))}
                  onClosePopover={() => setActivePicker(prev => (prev === 'bg' ? null : prev))}
                  onChange={handleBgColorChange}
                  onTextBlur={() => {
                    if (!normalizeHexColor(bgInput)) {
                      setBgInput(normalizedBg)
                    }
                  }}
                />
                <ColorPickerField
                  label="Text Color"
                  value={normalizedText}
                  textValue={textInput}
                  placeholder="#ffffff"
                  pickerAriaLabel="Text Color Picker"
                  isOpen={activePicker === 'text'}
                  onToggle={() => setActivePicker(prev => (prev === 'text' ? null : 'text'))}
                  onClosePopover={() => setActivePicker(prev => (prev === 'text' ? null : prev))}
                  onChange={handleTextColorChange}
                  onTextBlur={() => {
                    if (!normalizeHexColor(textInput)) {
                      setTextInput(normalizedText)
                    }
                  }}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleThemeSave}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-sm text-sm font-medium"
              >
                Save
              </button>
              <button
                onClick={handleThemeReset}
                className="px-4 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-sm text-sm font-medium"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
