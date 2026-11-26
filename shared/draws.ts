import type { FolderItem } from './folders'
import { authHeader, type Session } from './jellyfin'
import { normalizeUrl } from './storage'
import { getPlatform } from './platform'
import { getSettings, updateSettings } from './userSettings'

export type DrawStatus = 'scheduled' | 'running' | 'ended'
export type DrawItemType = 'Movie' | 'Series' | 'Movie,Series'
export type Participant = { id: string; name: string; swiped: number }

export type DrawSummary = {
  id: string
  title: string
  owner: { id: string; name: string }
  isOwner: boolean
  itemType: DrawItemType
  sourceLabel: string
  startsAt: number
  endsAt: number
  status: DrawStatus
  itemCount: number
  posters: string[]
  participants: Participant[]
}

export type DrawItem = FolderItem
export type Vote = { key: string; likes: number; votes: number }

export type DrawDetail = DrawSummary & {
  items: DrawItem[]
  mySwipes: Record<string, boolean>
  results: Vote[] | null
}

export type StatRow = DrawItem & { likes: number; votes: number; draws: number }

export type NewDraw = {
  title: string
  itemType: DrawItemType
  sourceLabel: string
  startsAt: number
  endsAt: number
  invitees: { id: string; name: string }[]
  items: FolderItem[]
}

export const getDrawServer = () => getSettings().drawServer || getPlatform().bundledServer || ''
export const setDrawServer = (url: string | null) => updateSettings({ drawServer: url ? normalizeUrl(url) : undefined })

/** Remember the address of the all in one container, so other devices and the native app find the server too. */
export function rememberBundledServer() {
  const bundled = getPlatform().bundledServer
  if (bundled && !getSettings().drawServer) setDrawServer(bundled).catch(() => undefined)
}

export async function testDrawServer(url: string) {
  const res = await fetch(`${normalizeUrl(url)}/api/health`)
  if (!res.ok) throw new Error(`Fehler ${res.status}`)
}

async function api<T>(s: Session, path: string, init: RequestInit = {}): Promise<T> {
  const server = getDrawServer()
  if (!server) throw new Error('Der Auslosung Server ist auf diesem Gerät nicht eingerichtet')
  const res = await fetch(`${server}/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: authHeader(s.token) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message ?? `Fehler ${res.status}`)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

export const listDraws = (s: Session) => api<DrawSummary[]>(s, '/draws')
export const getDraw = (s: Session, id: string) => api<DrawDetail>(s, `/draws/${id}`)
export const getStats = (s: Session) => api<StatRow[]>(s, '/stats')
export const endDraw = (s: Session, id: string) => api(s, `/draws/${id}/end`, { method: 'POST' })
export const deleteDraw = (s: Session, id: string) => api(s, `/draws/${id}`, { method: 'DELETE' })

export function createDraw(s: Session, draw: NewDraw) {
  return api<DrawSummary>(s, '/draws', { method: 'POST', body: JSON.stringify(draw) })
}

export function swipe(s: Session, id: string, key: string, like: boolean | null) {
  const path = `/draws/${id}/swipes/${encodeURIComponent(key)}`
  return like === null
    ? api(s, path, { method: 'DELETE' })
    : api(s, path, { method: 'PUT', body: JSON.stringify({ like }) })
}

/** Same order on every visit for the same user, but different between users. */
export function shuffleFor<T>(items: T[], seedText: string) {
  let seed = [...seedText].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261)
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

const dateFormat = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export const formatDate = (ms: number) => dateFormat.format(ms)

const UNITS: [limit: number, size: number, one: string, many: string][] = [
  [60, 1, 'Minute', 'Minuten'],
  [48 * 60, 60, 'Stunde', 'Stunden'],
  [Infinity, 24 * 60, 'Tag', 'Tagen'],
]

/** "in 3 Stunden", "vor 2 Tagen"; written by hand because Hermes lacks Intl.RelativeTimeFormat. */
export function formatRelative(ms: number) {
  const minutes = Math.round((ms - Date.now()) / 60_000)
  if (minutes === 0) return 'jetzt'
  const [, size, one, many] = UNITS.find(([limit]) => Math.abs(minutes) < limit)!
  const n = Math.round(Math.abs(minutes) / size)
  return `${minutes > 0 ? 'in' : 'vor'} ${n} ${n === 1 ? one : many}`
}

export function describeStatus(draw: DrawSummary) {
  if (draw.status === 'running') return `Endet ${formatRelative(draw.endsAt)}`
  if (draw.status === 'scheduled') return `Startet ${formatRelative(draw.startsAt)}`
  return `Beendet ${formatDate(draw.endsAt)}`
}

export const TYPE_LABEL: Record<DrawItemType, string> = { Movie: 'Filme', Series: 'Serien', 'Movie,Series': 'Filme und Serien' }
