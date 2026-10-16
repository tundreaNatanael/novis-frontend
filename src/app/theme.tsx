import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ThemeSetting = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'novis-admin.theme'
const MEDIA = '(prefers-color-scheme: dark)'

interface ThemeContextValue {
  setting: ThemeSetting
  resolved: ResolvedTheme
  setSetting: (setting: ThemeSetting) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readSetting(): ThemeSetting {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // Storage unavailable: follow the system.
  }
  return 'system'
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia(MEDIA).matches ? 'dark' : 'light'
}

/** Applies the `dark` class on `<html>`; `index.html` runs the same logic inline before the first paint. */
function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [setting, setSettingState] = useState<ThemeSetting>(readSetting)
  const [system, setSystem] = useState<ResolvedTheme>(systemTheme)

  useEffect(() => {
    const media = window.matchMedia(MEDIA)
    const onChange = () => setSystem(media.matches ? 'dark' : 'light')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const resolved: ResolvedTheme = setting === 'system' ? system : setting

  useEffect(() => {
    applyTheme(resolved)
  }, [resolved])

  const setSetting = useCallback((next: ThemeSetting) => {
    setSettingState(next)
    try {
      if (next === 'system') window.localStorage.removeItem(STORAGE_KEY)
      else window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Preference lasts for this tab only.
    }
  }, [])

  const value = useMemo(() => ({ setting, resolved, setSetting }), [setting, resolved, setSetting])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>')
  return context
}
