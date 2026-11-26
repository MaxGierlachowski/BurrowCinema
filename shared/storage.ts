import { getPlatform } from './platform'

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = getPlatform().storage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function save(key: string, value: unknown) {
  try {
    const { storage } = getPlatform()
    if (value === null || value === undefined) storage.removeItem(key)
    else storage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be unavailable (private mode); the app still works for this visit.
  }
}

export function normalizeUrl(input: string) {
  const url = input.trim().replace(/\/+$/, '')
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

/** Browsers on https block requests to http servers; native apps do not. */
export function isMixedContent(url: string) {
  return getPlatform().blocksInsecureRequests && url.startsWith('http://')
}
