/**
 * Everything that differs between web and native is handed in once at startup via configurePlatform().
 * Code in shared/ must not touch window, import.meta, URLSearchParams or other browser only APIs.
 */

export type KeyValueStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type Notify = {
  success(message: string): void
  error(message: string): void
  warning(message: string): void
}

type Platform = {
  storage: KeyValueStorage
  /** Shown in the Jellyfin dashboard under devices. */
  deviceName: string
  notify: Notify
  /** Address of the draw server when the app is served by the all in one container. */
  bundledServer?: string
  /** True where the page itself runs on https and therefore cannot call http servers (browsers). */
  blocksInsecureRequests: boolean
}

const memory = new Map<string, string>()

let platform: Platform = {
  storage: {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => void memory.set(key, value),
    removeItem: (key) => void memory.delete(key),
  },
  deviceName: 'BurrowCinema',
  notify: { success: console.log, error: console.error, warning: console.warn },
  blocksInsecureRequests: false,
}

export function configurePlatform(overrides: Partial<Platform>) {
  platform = { ...platform, ...overrides }
}

export const getPlatform = () => platform

export function uuid(): string {
  const native = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID
  if (native) return native.call(globalThis.crypto)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

const unauthorizedListeners = new Set<() => void>()

/** Fired when Jellyfin rejects the token, so the app can sign out. */
export function onUnauthorized(listener: () => void) {
  unauthorizedListeners.add(listener)
  return () => void unauthorizedListeners.delete(listener)
}

export const emitUnauthorized = () => unauthorizedListeners.forEach((listener) => listener())

/** Builds a query string without URLSearchParams, which React Native only partly supports. */
export function query(params: Record<string, string | number | boolean | undefined>) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&')
}
