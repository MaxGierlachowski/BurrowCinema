import type { FolderItem } from './folders'
import { authHeader, type Session } from './jellyfin'
import { load, normalizeUrl, save } from './storage'

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

const SERVER_KEY = 'bc.drawServer'

export const getDrawServer = () => load<string>(SERVER_KEY, '')
export const setDrawServer = (url: string | null) => save(SERVER_KEY, url ? normalizeUrl(url) : null)

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
const relative = new Intl.RelativeTimeFormat('de', { numeric: 'auto' })

export const formatDate = (ms: number) => dateFormat.format(ms)

export function formatRelative(ms: number) {
  const minutes = Math.round((ms - Date.now()) / 60_000)
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 48) return relative.format(hours, 'hour')
  return relative.format(Math.round(hours / 24), 'day')
}

export function describeStatus(draw: DrawSummary) {
  if (draw.status === 'running') return `Endet ${formatRelative(draw.endsAt)}`
  if (draw.status === 'scheduled') return `Startet ${formatRelative(draw.startsAt)}`
  return `Beendet ${formatDate(draw.endsAt)}`
}

export const TYPE_LABEL: Record<DrawItemType, string> = { Movie: 'Filme', Series: 'Serien', 'Movie,Series': 'Filme und Serien' }
