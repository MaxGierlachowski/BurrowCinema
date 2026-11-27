import type { Href } from 'expo-router'
import { query } from '@shared/platform'

/** Route parameters of the player. `sub: -1` turns subtitles off. */
export type PlayParams = { start?: 'resume' | 'beginning'; mediaSourceId?: string; audio?: number; sub?: number }

const withQuery = (path: string, params: Record<string, string | number | undefined>) => {
  const search = query(params)
  return (search ? `${path}?${search}` : path) as Href
}

/** The only way to open the player. */
export const playHref = (itemId: string, params: PlayParams = {}) => withQuery(`/player/${itemId}`, params)
export const itemHref = (id: string) => `/item/${id}` as Href
export const seasonHref = (seasonId: string, seriesId: string) => withQuery(`/season/${seasonId}`, { seriesId })
export const personHref = (personId: string) => `/person/${personId}` as Href
export const libraryHref = (type: 'Movie' | 'Series') => `/library/${type}` as Href
