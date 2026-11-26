import { normalizeUrl } from './storage'
import { getSettings, updateSettings } from './userSettings'

export type ArrKind = 'radarr' | 'sonarr'
export type ArrConfig = { url: string; apiKey: string }
export type ArrSettings = Partial<Record<ArrKind, ArrConfig>>

export type ArrItem = {
  source: ArrKind
  id: string
  title: string
  year?: number
  overview?: string
  poster?: string
  fanart?: string
  genres: string[]
  rating?: number
  runtime?: number
  network?: string
  seasonCount?: number
  imdbId?: string
  inArr: boolean
}

type ArrImage = { coverType: string; remoteUrl?: string }
type ArrRating = { value?: number }
type ArrRaw = {
  id?: number
  title: string
  year?: number
  overview?: string
  images?: ArrImage[]
  genres?: string[]
  ratings?: ArrRating & { tmdb?: ArrRating; imdb?: ArrRating }
  runtime?: number
  network?: string
  seasons?: { seasonNumber: number }[]
  imdbId?: string
  tmdbId?: number
  tvdbId?: number
}

export const ARR_LABEL: Record<ArrKind, string> = { radarr: 'Radarr', sonarr: 'Sonarr' }

export const getArrSettings = (): ArrSettings => getSettings().arr ?? {}

/** Stores the connection in the user's Jellyfin profile so every device has it. */
export function setArrConfig(kind: ArrKind, config: ArrConfig | null) {
  const arr = { ...getArrSettings() }
  if (config) arr[kind] = { url: normalizeUrl(config.url), apiKey: config.apiKey.trim() }
  else delete arr[kind]
  return updateSettings({ arr })
}

async function arrFetch<T>(config: ArrConfig, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${config.url}/api/v3${path}`, {
    ...init,
    headers: { 'X-Api-Key': config.apiKey, 'Content-Type': 'application/json' },
  })
  if (res.status === 401) throw new Error('API Key ungültig')
  if (!res.ok) {
    // Validation errors come back as [{ errorMessage }], e.g. when a title was already added.
    const body = await res.json().catch(() => null)
    throw new Error(body?.[0]?.errorMessage ?? body?.message ?? `Fehler ${res.status}`)
  }
  return res.json()
}

function requireConfig(kind: ArrKind) {
  const config = getArrSettings()[kind]
  if (!config) throw new Error(`${ARR_LABEL[kind]} ist auf diesem Gerät nicht eingerichtet`)
  return config
}

function image(raw: ArrRaw, type: string, size: string) {
  // TMDB images (Radarr) come in "original" size, which is far too large for a phone.
  return raw.images?.find((i) => i.coverType === type)?.remoteUrl?.replace('/t/p/original/', `/t/p/${size}/`)
}

function toItem(kind: ArrKind, raw: ArrRaw): ArrItem {
  const r = raw.ratings
  return {
    source: kind,
    id: String(kind === 'radarr' ? raw.tmdbId : raw.tvdbId),
    title: raw.title,
    year: raw.year || undefined,
    overview: raw.overview,
    poster: image(raw, 'poster', 'w342'),
    fanart: image(raw, 'fanart', 'w1280'),
    genres: raw.genres ?? [],
    rating: r?.tmdb?.value ?? r?.imdb?.value ?? r?.value,
    runtime: raw.runtime || undefined,
    network: raw.network,
    seasonCount: raw.seasons?.filter((s) => s.seasonNumber > 0).length,
    imdbId: raw.imdbId,
    inArr: Boolean(raw.id),
  }
}

export function testArr(config: ArrConfig) {
  return arrFetch<{ version: string }>(config, '/system/status')
}

export async function searchArr(kind: ArrKind, term: string) {
  const config = requireConfig(kind)
  const path = kind === 'radarr' ? '/movie/lookup' : '/series/lookup'
  const results = await arrFetch<ArrRaw[]>(config, `${path}?term=${encodeURIComponent(term)}`)
  return results.map((raw) => toItem(kind, raw))
}

async function lookup(config: ArrConfig, kind: ArrKind, id: string) {
  if (kind === 'radarr') return arrFetch<ArrRaw>(config, `/movie/lookup/tmdb?tmdbId=${id}`)
  const [series] = await arrFetch<ArrRaw[]>(config, `/series/lookup?term=tvdb:${id}`)
  if (!series) throw new Error('Serie nicht gefunden')
  return series
}

export async function getArrItem(kind: ArrKind, id: string) {
  return toItem(kind, await lookup(requireConfig(kind), kind, id))
}

export type QualityProfile = { id: number; name: string }
export type RootFolder = { id: number; path: string; freeSpace?: number }
export type RequestOptions = { qualityProfileId: number; rootFolderPath: string }

export async function getRequestOptions(kind: ArrKind) {
  const config = requireConfig(kind)
  const [profiles, folders] = await Promise.all([
    arrFetch<QualityProfile[]>(config, '/qualityprofile'),
    arrFetch<RootFolder[]>(config, '/rootfolder'),
  ])
  return { profiles, folders }
}

/** Adds the title to Radarr/Sonarr, monitored, and starts the search right away. */
export async function requestArr(kind: ArrKind, id: string, options: RequestOptions) {
  const config = requireConfig(kind)
  const raw = await lookup(config, kind, id)
  const body =
    kind === 'radarr'
      ? { ...raw, ...options, monitored: true, minimumAvailability: 'released', addOptions: { searchForMovie: true } }
      : {
          ...raw,
          ...options,
          languageProfileId: 1, // only read by Sonarr v3, ignored by v4
          monitored: true,
          seasonFolder: true,
          addOptions: { monitor: 'all', searchForMissingEpisodes: true },
        }
  await arrFetch(config, kind === 'radarr' ? '/movie' : '/series', { method: 'POST', body: JSON.stringify(body) })
}
