import { emitUnauthorized, getPlatform, query, uuid } from './platform'
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
  UserData?: UserData
  SeriesId?: string
  SeriesName?: string
  SeasonId?: string
  SeasonName?: string
  IndexNumber?: number
  ParentIndexNumber?: number
  PremiereDate?: string
  SeriesPrimaryImageTag?: string
  ParentBackdropItemId?: string
  ParentBackdropImageTags?: string[]
  ParentThumbItemId?: string
  ParentThumbImageTag?: string
  ParentLogoItemId?: string
  ParentLogoImageTag?: string
  CollectionType?: string
  MediaType?: string
  LocationType?: string
  PrimaryImageAspectRatio?: number
  MediaSources?: MediaSourceInfo[]
  Chapters?: ChapterInfo[]
  /** Per media source id, then per width. */
  Trickplay?: Record<string, Record<string, TrickplayInfo>>
  RemoteTrailers?: { Url: string; Name?: string }[]
}

export type UserData = {
  PlaybackPositionTicks?: number
  PlayedPercentage?: number
  Played?: boolean
  PlayCount?: number
  IsFavorite?: boolean
  LastPlayedDate?: string
  UnplayedItemCount?: number
}

export type MediaStreamType = 'Video' | 'Audio' | 'Subtitle' | 'EmbeddedImage' | 'Data' | 'Lyric'
export type SubtitleDeliveryMethod = 'Encode' | 'Embed' | 'External' | 'Hls' | 'Drop'

export type MediaStream = {
  Index: number
  Type: MediaStreamType
  Codec?: string
  Language?: string
  Title?: string
  DisplayTitle?: string
  IsDefault?: boolean
  IsForced?: boolean
  IsExternal?: boolean
  IsTextSubtitleStream?: boolean
  SupportsExternalStream?: boolean
  DeliveryMethod?: SubtitleDeliveryMethod
  DeliveryUrl?: string
  IsExternalUrl?: boolean
  Width?: number
  Height?: number
  BitRate?: number
  Channels?: number
  ChannelLayout?: string
  VideoRange?: string
  VideoRangeType?: string
  RealFrameRate?: number
  Profile?: string
}

export type MediaSourceInfo = {
  Id: string
  Name?: string
  Path?: string
  Protocol?: string
  IsRemote?: boolean
  Container?: string
  Size?: number
  Bitrate?: number
  RunTimeTicks?: number
  ETag?: string
  SupportsDirectPlay?: boolean
  SupportsDirectStream?: boolean
  SupportsTranscoding?: boolean
  TranscodingUrl?: string
  TranscodingSubProtocol?: string
  TranscodingContainer?: string
  RequiredHttpHeaders?: Record<string, string>
  MediaStreams?: MediaStream[]
  DefaultAudioStreamIndex?: number
  DefaultSubtitleStreamIndex?: number
  HasSegments?: boolean
}

export type ChapterInfo = { StartPositionTicks: number; Name?: string; ImageTag?: string }

export type TrickplayInfo = {
  Width: number
  Height: number
  TileWidth: number
  TileHeight: number
  ThumbnailCount: number
  Interval: number
  Bandwidth?: number
}

export type UserView = BaseItem & { CollectionType?: string }

export type UserConfiguration = {
  AudioLanguagePreference?: string
  PlayDefaultAudioTrack?: boolean
  SubtitleLanguagePreference?: string
  SubtitleMode?: 'Default' | 'Always' | 'OnlyForced' | 'None' | 'Smart'
  EnableNextEpisodeAutoPlay?: boolean
  RememberAudioSelections?: boolean
  RememberSubtitleSelections?: boolean
}

export type Me = { Id: string; Name: string; Configuration?: UserConfiguration }

export type ItemFilter = 'IsPlayed' | 'IsUnplayed' | 'IsResumable' | 'IsFavorite'

type ItemsResponse = { Items: BaseItem[]; TotalRecordCount: number }
type DisplayPreferences = { CustomPrefs?: Record<string, string | null> }

export type ItemType = 'Movie' | 'Series'
export type SortKey = 'DateCreated' | 'SortName' | 'ProductionYear' | 'CommunityRating'

const CLIENT = 'BurrowCinema'
const PAGE_SIZE = 60
const LIST_FIELDS = 'ProductionYear,ProviderIds,Genres'
const DETAIL_FIELDS = 'Overview,Genres,People,Studios,Taglines,ProviderIds,ChildCount,MediaSources,RemoteTrailers'
const PLAYBACK_FIELDS = `${DETAIL_FIELDS},MediaStreams,Chapters,Trickplay`

export function deviceId() {
  let id = load('bc.deviceId', '')
  if (!id) {
    id = uuid()
    save('bc.deviceId', id)
  }
  return id
}

export function authHeader(token?: string) {
  const parts = [`Client="${CLIENT}"`, `Device="${getPlatform().deviceName}"`, `DeviceId="${deviceId()}"`, `Version="1.0.0"`]
  if (token) parts.push(`Token="${token}"`)
  return `MediaBrowser ${parts.join(', ')}`
}

/** Error for a failed Jellyfin request; `status` lets callers treat e.g. 404 as "nothing there". */
export class JellyfinError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function request<T>(s: Session, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(s.server + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: authHeader(s.token) },
  })
  if (res.status === 401) {
    emitUnauthorized()
    throw new JellyfinError(401, 'Sitzung abgelaufen, bitte neu anmelden')
  }
  if (!res.ok) throw new JellyfinError(res.status, `Jellyfin antwortet mit ${res.status}`)
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
  return sessionFromAuth(server, await res.json())
}

/** Turns an authentication response (password or Quick Connect) into a session. */
export function sessionFromAuth(server: string, data: { AccessToken: string; User: { Id: string; Name: string } }): Session {
  return { server, token: data.AccessToken, userId: data.User.Id, userName: data.User.Name }
}

export function logout(s: Session) {
  return request(s, '/Sessions/Logout', { method: 'POST' }).catch(() => undefined)
}

export function getItems(
  s: Session,
  opts: {
    type: string
    sort?: SortKey
    start?: number
    search?: string
    limit?: number
    parentId?: string
    filters?: ItemFilter
    personIds?: string
  },
) {
  const sort = opts.sort ?? 'SortName'
  const params = query({
    userId: s.userId,
    IncludeItemTypes: opts.type,
    Recursive: true,
    SortBy: sort === 'SortName' ? 'SortName' : `${sort},SortName`,
    SortOrder: sort === 'SortName' ? 'Ascending' : 'Descending',
    StartIndex: opts.start ?? 0,
    Limit: opts.limit ?? PAGE_SIZE,
    Fields: LIST_FIELDS,
    ImageTypeLimit: 1,
    SearchTerm: opts.search,
    ParentId: opts.parentId,
    Filters: opts.filters,
    PersonIds: opts.personIds,
  })
  return request<ItemsResponse>(s, `/Items?${params}`)
}

async function getItemWithFields(s: Session, id: string, fields: string) {
  const params = query({ userId: s.userId, ids: id, Fields: fields })
  const { Items } = await request<ItemsResponse>(s, `/Items?${params}`)
  if (!Items[0]) throw new Error('Titel nicht gefunden')
  return Items[0]
}

export const getItem = (s: Session, id: string) => getItemWithFields(s, id, DETAIL_FIELDS)

/** Item with everything the player needs: media sources, streams, chapters and trickplay. */
export const getPlaybackItem = (s: Session, id: string) => getItemWithFields(s, id, PLAYBACK_FIELDS)

export async function getSeasons(s: Session, seriesId: string) {
  const params = query({ userId: s.userId, Fields: 'ChildCount' })
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

export function imageUrl(s: Session, id: string, type: 'Primary' | 'Backdrop' | 'Logo' | 'Thumb', width = 400) {
  const path = type === 'Backdrop' ? 'Backdrop/0' : type
  return `${s.server}/Items/${id}/Images/${path}?maxWidth=${width}&quality=85`
}

export function posterUrl(s: Session, item: BaseItem, width = 400) {
  return item.ImageTags?.Primary ? imageUrl(s, item.Id, 'Primary', width) : undefined
}

/** Landscape image: episode still, then the item's or its series' thumb, then a backdrop. */
export function thumbUrl(s: Session, item: BaseItem, width = 600) {
  if (item.Type === 'Episode' && item.ImageTags?.Primary) return imageUrl(s, item.Id, 'Primary', width)
  if (item.ImageTags?.Thumb) return imageUrl(s, item.Id, 'Thumb', width)
  if (item.ParentThumbItemId && item.ParentThumbImageTag) return imageUrl(s, item.ParentThumbItemId, 'Thumb', width)
  if (item.BackdropImageTags?.length) return imageUrl(s, item.Id, 'Backdrop', width)
  if (item.ParentBackdropItemId && item.ParentBackdropImageTags?.length) return imageUrl(s, item.ParentBackdropItemId, 'Backdrop', width)
  return undefined
}

/** Backdrop of the item, or of its series for seasons and episodes. */
export function backdropUrl(s: Session, item: BaseItem, width = 1600) {
  if (item.BackdropImageTags?.length) return imageUrl(s, item.Id, 'Backdrop', width)
  if (item.ParentBackdropItemId && item.ParentBackdropImageTags?.length) return imageUrl(s, item.ParentBackdropItemId, 'Backdrop', width)
  return undefined
}

/** Portrait poster; seasons and episodes without their own fall back to the series poster. */
export function seriesPosterUrl(s: Session, item: BaseItem, width = 400) {
  if (item.Type !== 'Episode' && item.ImageTags?.Primary) return imageUrl(s, item.Id, 'Primary', width)
  if (item.SeriesId && item.SeriesPrimaryImageTag) return imageUrl(s, item.SeriesId, 'Primary', width)
  return posterUrl(s, item, width)
}

export function personImageUrl(s: Session, person: Person) {
  return person.PrimaryImageTag ? imageUrl(s, person.Id, 'Primary', 200) : undefined
}

export function webUrl(s: Session, id: string) {
  return `${s.server}/web/#/details?id=${id}`
}

// Folders are stored in the user's display preferences, so every device with the same account sees them.
function prefsPath(s: Session, doc: string) {
  return `/DisplayPreferences/${doc}?userId=${s.userId}&client=${CLIENT}`
}

export async function getCustomPref(s: Session, key: string, doc = 'burrowcinema') {
  const prefs = await request<DisplayPreferences>(s, prefsPath(s, doc))
  return prefs.CustomPrefs?.[key] ?? null
}

export async function setCustomPref(s: Session, key: string, value: string, doc = 'burrowcinema') {
  const prefs = await request<DisplayPreferences>(s, prefsPath(s, doc))
  const body = { ...prefs, CustomPrefs: { ...prefs.CustomPrefs, [key]: value } }
  await request(s, prefsPath(s, doc), { method: 'POST', body: JSON.stringify(body) })
}

export const getMe = (s: Session) => request<Me>(s, '/Users/Me')

export async function getUserViews(s: Session) {
  const { Items } = await request<ItemsResponse>(s, `/UserViews?${query({ userId: s.userId })}`)
  return Items as UserView[]
}

export async function getResume(s: Session, opts: { limit?: number; parentId?: string } = {}) {
  const params = query({
    userId: s.userId,
    limit: opts.limit ?? 20,
    parentId: opts.parentId,
    mediaTypes: 'Video',
    enableTotalRecordCount: false,
    imageTypeLimit: 1,
    fields: 'PrimaryImageAspectRatio,Overview',
  })
  const { Items } = await request<ItemsResponse>(s, `/UserItems/Resume?${params}`)
  return Items
}

export async function getNextUp(s: Session, opts: { limit?: number; seriesId?: string } = {}) {
  const params = query({
    userId: s.userId,
    limit: opts.limit ?? 20,
    seriesId: opts.seriesId,
    enableResumable: false,
    imageTypeLimit: 1,
    fields: 'PrimaryImageAspectRatio,Overview',
  })
  const { Items } = await request<ItemsResponse>(s, `/Shows/NextUp?${params}`)
  return Items
}

/** Recently added items of one library. The answer is a plain array. */
export function getLatest(s: Session, parentId: string, limit = 20) {
  const params = query({ userId: s.userId, parentId, limit, fields: LIST_FIELDS, imageTypeLimit: 1 })
  return request<BaseItem[]>(s, `/Items/Latest?${params}`)
}

export async function getEpisodes(s: Session, seriesId: string, seasonId: string) {
  const params = query({ userId: s.userId, seasonId, fields: 'Overview' })
  const { Items } = await request<ItemsResponse>(s, `/Shows/${seriesId}/Episodes?${params}`)
  return Items
}

export async function getAdjacentEpisodes(
  s: Session,
  seriesId: string,
  episodeId: string,
): Promise<{ previous?: BaseItem; next?: BaseItem }> {
  const params = query({ userId: s.userId, adjacentTo: episodeId, limit: 3 })
  const { Items } = await request<ItemsResponse>(s, `/Shows/${seriesId}/Episodes?${params}`)
  const index = Items.findIndex((item) => item.Id === episodeId)
  if (index < 0) return {}
  return { previous: Items[index - 1], next: Items[index + 1] }
}

export async function getSimilar(s: Session, id: string, limit = 12) {
  const params = query({ userId: s.userId, limit, fields: LIST_FIELDS })
  const { Items } = await request<ItemsResponse>(s, `/Items/${id}/Similar?${params}`)
  return Items
}

export async function searchPeople(s: Session, term: string, limit = 20) {
  const params = query({ userId: s.userId, searchTerm: term, limit })
  const { Items } = await request<ItemsResponse>(s, `/Persons?${params}`)
  return Items
}

export async function getPersonItems(s: Session, personId: string) {
  const params = query({
    userId: s.userId,
    personIds: personId,
    recursive: true,
    includeItemTypes: 'Movie,Series',
    sortBy: 'ProductionYear,SortName',
    sortOrder: 'Descending',
    fields: LIST_FIELDS,
    imageTypeLimit: 1,
  })
  const { Items } = await request<ItemsResponse>(s, `/Items?${params}`)
  return Items
}

export function setPlayed(s: Session, id: string, played: boolean) {
  return request<UserData>(s, `/UserPlayedItems/${id}?${query({ userId: s.userId })}`, { method: played ? 'POST' : 'DELETE' })
}

export function setFavorite(s: Session, id: string, favorite: boolean) {
  return request<UserData>(s, `/UserFavoriteItems/${id}?${query({ userId: s.userId })}`, { method: favorite ? 'POST' : 'DELETE' })
}
