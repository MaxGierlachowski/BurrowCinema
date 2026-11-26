import type { ArrKind, ArrSettings, RequestOptions } from './arr'
import { getCustomPref, setCustomPref, type Session } from './jellyfin'
import { load, save } from './storage'

/** Settings that follow the Jellyfin user to every device. */
export type UserSettings = {
  arr?: ArrSettings
  drawServer?: string
  lastRequest?: Partial<Record<ArrKind, RequestOptions>>
}

// Own preferences document, so writes never race with the folders document.
const PREF_DOC = 'burrowcinema-settings'
const PREF_KEY = 'settings'
const LEGACY_KEYS = ['bc.arr', 'bc.drawServer', 'bc.request.radarr', 'bc.request.sonarr']

let current: { session: Session; settings: UserSettings } | null = null

const cacheKey = (s: Session) => `bc.settings.${s.userId}`

/** Settings from before they were synced lived per device; they move to the first user who signs in. */
function takeLegacy(): UserSettings {
  const legacy: UserSettings = {
    arr: load<ArrSettings | undefined>('bc.arr', undefined),
    drawServer: load<string | undefined>('bc.drawServer', undefined),
    lastRequest: {
      radarr: load<RequestOptions | undefined>('bc.request.radarr', undefined),
      sonarr: load<RequestOptions | undefined>('bc.request.sonarr', undefined),
    },
  }
  LEGACY_KEYS.forEach((key) => save(key, null))
  return legacy
}

const hasValues = (s: UserSettings) => Boolean(s.arr && Object.keys(s.arr).length) || Boolean(s.drawServer)

/** Loads the user's settings from Jellyfin, falling back to the local copy when offline. Never throws. */
export async function syncSettings(session: Session): Promise<UserSettings> {
  let settings = load<UserSettings>(cacheKey(session), {})
  const legacy = takeLegacy()
  try {
    const remote = await getCustomPref(session, PREF_KEY, PREF_DOC)
    if (remote) settings = JSON.parse(remote)
    else {
      if (!hasValues(settings) && hasValues(legacy)) settings = legacy
      if (hasValues(settings)) await setCustomPref(session, PREF_KEY, JSON.stringify(settings), PREF_DOC)
    }
  } catch {
    // Offline or Jellyfin hiccup: keep working with the local copy.
  }
  save(cacheKey(session), settings)
  current = { session, settings }
  return settings
}

export const getSettings = (): UserSettings => current?.settings ?? {}

export function clearSettings() {
  current = null
}

/** Saves locally right away, then in the Jellyfin profile. Rejects if the profile could not be updated. */
export async function updateSettings(change: Partial<UserSettings>) {
  if (!current) throw new Error('Nicht angemeldet')
  current.settings = { ...current.settings, ...change }
  save(cacheKey(current.session), current.settings)
  await setCustomPref(current.session, PREF_KEY, JSON.stringify(current.settings), PREF_DOC)
}
