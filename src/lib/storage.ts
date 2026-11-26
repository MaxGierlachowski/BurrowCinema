export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function save(key: string, value: unknown) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be unavailable (private mode); the app still works for this visit.
  }
}

export function normalizeUrl(input: string) {
  const url = input.trim().replace(/\/+$/, '')
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

export function isMixedContent(url: string) {
  return location.protocol === 'https:' && url.startsWith('http://')
}
