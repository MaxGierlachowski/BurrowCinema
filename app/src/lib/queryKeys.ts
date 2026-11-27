import type { QueryClient } from '@tanstack/react-query'

/** Query keys shared by several screens. ['item', id] and ['seasons', id] match the keys used before. */
export const qk = {
  item: (id: string) => ['item', id] as const,
  playbackItem: (id: string) => ['playback-item', id] as const,
  seasons: (seriesId: string) => ['seasons', seriesId] as const,
  episodes: (seasonId: string) => ['episodes', seasonId] as const,
  nextUpSeries: (seriesId: string) => ['next-up', seriesId] as const,
  similar: (id: string) => ['similar', id] as const,
  me: ['me'] as const,
  homeResume: ['home', 'resume'] as const,
  homeNextUp: ['home', 'next-up'] as const,
  homeViews: ['home', 'views'] as const,
  homeLatest: (viewId: string) => ['home', 'latest', viewId] as const,
}

/** After playback the position, watched state and next episode changed: refresh everything that shows them. */
export async function invalidateAfterPlayback(client: QueryClient, item: { Id: string; SeriesId?: string; SeasonId?: string }) {
  const keys: (readonly unknown[])[] = [qk.item(item.Id), qk.playbackItem(item.Id), ['home'], ['next-up']]
  if (item.SeriesId) keys.push(qk.item(item.SeriesId), qk.seasons(item.SeriesId))
  if (item.SeasonId) keys.push(qk.episodes(item.SeasonId))
  await Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })))
}
