import { useCallback, useSyncExternalStore } from 'react'

export interface UserPreferences {
  tabPosition: 'top' | 'bottom'
  paneHeaders: boolean
  sidebarOpen: boolean
  terminalFont: string
  terminalFontSize: number
  theme: string
  backgroundStyle: 'solid' | 'gradient' | 'pattern' | 'custom'
  backgroundCustomColor: string
}

const DEFAULTS: UserPreferences = {
  tabPosition: 'bottom',
  paneHeaders: true,
  sidebarOpen: true,
  terminalFont: 'JetBrains Mono',
  terminalFontSize: 13,
  theme: 'tokyo-night',
  backgroundStyle: 'solid',
  backgroundCustomColor: '',
}

const STORAGE_KEY = 'webmux:preferences'

let listeners: Array<() => void> = []
let cached: UserPreferences | null = null

function read(): UserPreferences {
  if (cached !== null) return cached
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: UserPreferences = { ...DEFAULTS, ...JSON.parse(raw) }
      cached = parsed
      return parsed
    }
  } catch {
    // ignore parse errors
  }
  const defaults = { ...DEFAULTS }
  cached = defaults
  return defaults
}

function write(prefs: UserPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // quota exceeded — keep the existing cache and bail
    return
  }
  cached = prefs
  for (const listener of listeners) {
    listener()
  }
}

let storageListenerRegistered = false

function ensureStorageListener() {
  if (storageListenerRegistered) return
  storageListenerRegistered = true
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      // Pre-warm cache so getSnapshot() stays referentially stable
      try {
        cached = e.newValue ? { ...DEFAULTS, ...JSON.parse(e.newValue) } : { ...DEFAULTS }
      } catch {
        cached = { ...DEFAULTS }
      }
      for (const listener of listeners) listener()
    }
  })
}

function subscribe(listener: () => void) {
  listeners.push(listener)
  ensureStorageListener()
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

function getSnapshot(): UserPreferences {
  return read()
}

/**
 * Imperatively read current preferences from the module-level cache.
 * Always returns the latest committed value — use in event handlers or
 * callbacks to avoid stale closures. Do NOT use to drive rendering;
 * use usePreferences() for reactive reads.
 */
export const readPreferences = read

export function usePreferences() {
  const preferences = useSyncExternalStore(subscribe, getSnapshot)

  const setPreference = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      const current = read()
      write({ ...current, [key]: value })
    },
    [],
  )

  const setPreferences = useCallback((partial: Partial<UserPreferences>) => {
    const current = read()
    write({ ...current, ...partial })
  }, [])

  return { preferences, setPreference, setPreferences } as const
}
