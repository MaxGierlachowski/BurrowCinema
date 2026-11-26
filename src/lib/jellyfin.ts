import { load, normalizeUrl, save } from './storage'

export type Session = { server: string; token: string; userId: string; userName: string }

export type Person = { Id: string; Name: string; Role?: string; Type: string; PrimaryImageTag?: string }

export type BaseItem = {
  Id: string
  Name: string
  Type: string
  ProductionYear?: number
  Overview?: string
  Taglines?: string[]
  Genres?: string[]
  CommunityRating?: number
  OfficialRating?: string
  RunTimeTicks?: number
  ChildCount?: number
  Status?: string
  People?: Person[]
  Studios?: { Name: string }[]
  ImageTags?: Record<string, string>
  BackdropImageTags?: string[]
  ProviderIds?: Record<string, string>
}

type ItemsResponse = { Items: BaseItem[]; TotalRecordCount: number }
type DisplayPreferences = { CustomPrefs?: Record<string, string | null> }

export type ItemType = 'Movie' | 'Series'
export type SortKey = 'DateCreated' | 'SortName' | 'ProductionYear' | 'CommunityRating'

const CLIENT = 'BurrowCinema'
const PAGE_SIZE = 60
const LIST_FIELDS = 'ProductionYear,ProviderIds,Genres'
const DETAIL_FIELDS = 'Overview,Genres,People,Studios,Taglines,ProviderIds,ChildCount'

function deviceId() {
  let id = load('bc.deviceId', '')
  if (!id) {
    id = crypto.randomUUID()
    save('bc.deviceId', id)
  }
  return id
}

export function authHeader(token?: string) {
  const parts = [`Client="${CLIENT}"`, `Device="Web Browser"`, `DeviceId="${deviceId()}"`, `Version="1.0.0"`]
  if (token) parts.push(`Token="${token}"`)
  return `MediaBrowser ${parts.join(', ')}`
}

async function request<T>(s: Session, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(s.server + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: authHeader(s.token) },
  })
  if (res.status === 401) {
    window.dispatchEvent(new Event('bc:unauthorized'))
    throw new Error('Sitzung abgelaufen, bitte neu anmelden')
  }
  if (!res.ok) throw new Error(`Jellyfin antwortet mit ${res.status}`)
  return res.status === 204 ? (undefined as T) : res.json()
}

export async function login(serverInput: string, username: string, password: string): Promise<Session> {
  const server = normalizeUrl(serverInput)
  const res = await fetch(`${server}/Users/AuthenticateByName`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body: JSON.stringify({ Username: username, Pw: password }),
  })
  if (res.status === 401) throw new Error('Benutzername oder Passwort ist falsch')
  if (!res.ok) throw new Error(`Login fehlgeschlagen (${res.status})`)
  const data = await res.json()
  return { server, token: data.AccessToken, userId: data.User.Id, userName: data.User.Name }
}

export function logout(s: Session) {
  return request(s, '/Sessions/Logout', { method: 'POST' }).catch(() => undefined)
}

export function getItems(s: Session, opts: { type: string; sort?: SortKey; start?: number; search?: string; limit?: number }) {
  const sort = opts.sort ?? 'SortName'
  const params = new URLSearchParams({
    userId: s.userId,
    IncludeItemTypes: opts.type,
    Recursive: 'true',
    SortBy: sort === 'SortName' ? 'SortName' : `${sort},SortName`,
    SortOrder: sort === 'SortName' ? 'Ascending' : 'Descending',
    StartIndex: String(opts.start ?? 0),
    Limit: String(opts.limit ?? PAGE_SIZE),
    Fields: LIST_FIELDS,
    ImageTypeLimit: '1',
  })
  if (opts.search) params.set('SearchTerm', opts.search)
  return request<ItemsResponse>(s, `/Items?${params}`)
}

export async function getItem(s: Session, id: string) {
  const params = new URLSearchParams({ userId: s.userId, ids: id, Fields: DETAIL_FIELDS })
  const { Items } = await request<ItemsResponse>(s, `/Items?${params}`)
  if (!Items[0]) throw new Error('Titel nicht gefunden')
  return Items[0]
}

export async function getSeasons(s: Session, seriesId: string) {
  const params = new URLSearchParams({ userId: s.userId, Fields: 'ChildCount' })
  const { Items } = await request<ItemsResponse>(s, `/Shows/${seriesId}/Seasons?${params}`)
  return Items
}

export type JellyfinUser = { Id: string; Name: string; PrimaryImageTag?: string }

export async function getUsers(s: Session) {
  // Older servers only allow admins to list everyone; fall back to the users shown on the login screen.
  const users = await request<JellyfinUser[]>(s, '/Users').catch(() => request<JellyfinUser[]>(s, '/Users/Public'))
  return users.filter((u) => u.Id !== s.userId)
}

export function userImageUrl(s: Session, user: JellyfinUser) {
  return user.PrimaryImageTag ? `${s.server}/Users/${user.Id}/Images/Primary?maxWidth=96&quality=85` : undefined
}

export async function getAllItems(s: Session, type: string) {
  const items: BaseItem[] = []
  for (let start = 0; ; start += 500) {
    const page = await getItems(s, { type, start, limit: 500 })
    items.push(...page.Items)
    if (items.length >= page.TotalRecordCount || page.Items.length === 0) return items
  }
}

export function imageUrl(s: Session, id: string, type: 'Primary' | 'Backdrop' | 'Logo', width = 400) {
  const path = type === 'Backdrop' ? 'Backdrop/0' : type
  return `${s.server}/Items/${id}/Images/${path}?maxWidth=${width}&quality=85`
}

export function posterUrl(s: Session, item: BaseItem, width = 400) {
  return item.ImageTags?.Primary ? imageUrl(s, item.Id, 'Primary', width) : undefined
}

export function personImageUrl(s: Session, person: Person) {
  return person.PrimaryImageTag ? imageUrl(s, person.Id, 'Primary', 200) : undefined
}

export function webUrl(s: Session, id: string) {
  return `${s.server}/web/#/details?id=${id}`
}

// Folders are stored in the user's display preferences, so every device with the same account sees them.
function prefsPath(s: Session) {
  return `/DisplayPreferences/burrowcinema?userId=${s.userId}&client=${CLIENT}`
}

export async function getCustomPref(s: Session, key: string) {
  const prefs = await request<DisplayPreferences>(s, prefsPath(s))
  return prefs.CustomPrefs?.[key] ?? null
}

export async function setCustomPref(s: Session, key: string, value: string) {
  const prefs = await request<DisplayPreferences>(s, prefsPath(s))
  const body = { ...prefs, CustomPrefs: { ...prefs.CustomPrefs, [key]: value } }
  await request(s, prefsPath(s), { method: 'POST', body: JSON.stringify(body) })
}
