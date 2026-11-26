import type { ArrItem } from './arr'
import { getCustomPref, posterUrl, setCustomPref, type BaseItem, type Session } from './jellyfin'
import { load, save } from './storage'

export type MediaSource = 'jellyfin' | 'radarr' | 'sonarr'

export type FolderItem = {
  key: string
  source: MediaSource
  id: string
  type: 'movie' | 'series'
  title: string
  year?: number
  rating?: number
  poster?: string
}

export type Folder = { id: string; name: string; items: FolderItem[]; createdAt: number }

const PREF_KEY = 'folders'
const cacheKey = (s: Session) => `bc.folders.${s.userId}`

export function fromJellyfin(s: Session, item: BaseItem): FolderItem {
  return {
    key: `jellyfin:${item.Id}`,
    source: 'jellyfin',
    id: item.Id,
    type: item.Type === 'Series' ? 'series' : 'movie',
    title: item.Name,
    year: item.ProductionYear,
    rating: item.CommunityRating,
    poster: posterUrl(s, item),
  }
}

export function fromArr(item: ArrItem): FolderItem {
  return {
    key: `${item.source}:${item.id}`,
    source: item.source,
    id: item.id,
    type: item.source === 'radarr' ? 'movie' : 'series',
    title: item.title,
    year: item.year,
    rating: item.rating,
    poster: item.poster,
  }
}

export function itemLink(item: FolderItem) {
  return item.source === 'jellyfin' ? `/item/${item.id}` : `/external/${item.source}/${item.id}`
}

export async function loadFolders(s: Session): Promise<Folder[]> {
  const cached = load<Folder[]>(cacheKey(s), [])
  try {
    const remote = await getCustomPref(s, PREF_KEY)
    const folders = remote ? (JSON.parse(remote) as Folder[]) : cached
    save(cacheKey(s), folders)
    return folders
  } catch {
    return cached
  }
}

export async function saveFolders(s: Session, folders: Folder[]) {
  save(cacheKey(s), folders)
  await setCustomPref(s, PREF_KEY, JSON.stringify(folders))
}
