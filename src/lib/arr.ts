import { load, normalizeUrl, save } from './storage'

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

const SETTINGS_KEY = 'bc.arr'

export const ARR_LABEL: Record<ArrKind, string> = { radarr: 'Radarr', sonarr: 'Sonarr' }

export const getArrSettings = () => load<ArrSettings>(SETTINGS_KEY, {})

export function setArrConfig(kind: ArrKind, config: ArrConfig | null) {
  const settings = getArrSettings()
  if (config) settings[kind] = { url: normalizeUrl(config.url), apiKey: config.apiKey.trim() }
  else delete settings[kind]
  save(SETTINGS_KEY, settings)
}

async function arrFetch<T>(config: ArrConfig, path: string): Promise<T> {
  const res = await fetch(`${config.url}/api/v3${path}`, { headers: { 'X-Api-Key': config.apiKey } })
  if (res.status === 401) throw new Error('API Key ungültig')
  if (!res.ok) throw new Error(`Fehler ${res.status}`)
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

export async function getArrItem(kind: ArrKind, id: string) {
  const config = requireConfig(kind)
  if (kind === 'radarr') return toItem(kind, await arrFetch<ArrRaw>(config, `/movie/lookup/tmdb?tmdbId=${id}`))
  const [series] = await arrFetch<ArrRaw[]>(config, `/series/lookup?term=tvdb:${id}`)
  if (!series) throw new Error('Serie nicht gefunden')
  return toItem(kind, series)
}
