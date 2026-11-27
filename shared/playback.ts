import { buildDeviceProfile, type DeviceCaps } from './deviceProfile'
import {
  authHeader,
  deviceId,
  JellyfinError,
  request,
  type BaseItem,
  type MediaSourceInfo,
  type MediaStream,
  type Session,
  type TrickplayInfo,
} from './jellyfin'
import { query } from './platform'
import { load, save } from './storage'

export const TICKS_PER_SECOND = 10_000_000
export const ticksToSeconds = (ticks = 0) => ticks / TICKS_PER_SECOND
export const secondsToTicks = (seconds: number) => Math.round(seconds * TICKS_PER_SECOND)
export const PROGRESS_INTERVAL_MS = 10_000

export type PlayMethod = 'DirectPlay' | 'DirectStream' | 'Transcode'

export type PlaybackRequest = {
  itemId: string
  mediaSourceId?: string
  startTicks?: number
  audioStreamIndex?: number
  /** -1 = off */
  subtitleStreamIndex?: number
  maxBitrate: number
  caps: DeviceCaps
  enableDirectPlay?: boolean
}

export type PlaybackInfoResponse = { PlaySessionId: string; MediaSources: MediaSourceInfo[]; ErrorCode?: string }

export type SubtitleTrack = {
  streamIndex: number
  /** 'jf-<Index>', used to select the track in the player. */
  title: string
  label: string
  language?: string
  uri: string
  mimeType: 'application/x-subrip' | 'text/vtt' | 'application/ttml+xml'
}

export type ResolvedPlayback = {
  url: string
  headers: Record<string, string>
  playMethod: PlayMethod
  playSessionId: string
  mediaSource: MediaSourceInfo
  audioStreams: MediaStream[]
  subtitleStreams: MediaStream[]
  externalSubtitles: SubtitleTrack[]
  audioStreamIndex?: number
  subtitleStreamIndex: number
  transcodeReasons: string[]
  startTicks: number
}

const ERROR_TEXT: Record<string, string> = {
  NotAllowed: 'Wiedergabe ist für dieses Konto nicht erlaubt',
  NoCompatibleStream: 'Kein abspielbarer Stream gefunden',
  RateLimitExceeded: 'Zu viele gleichzeitige Wiedergaben',
}

export class PlaybackError extends Error {
  code: string
  constructor(code: string, message?: string) {
    super(message ?? ERROR_TEXT[code] ?? 'Wiedergabe fehlgeschlagen')
    this.code = code
  }
}

export function getPlaybackInfo(s: Session, req: PlaybackRequest) {
  const body = {
    UserId: s.userId,
    DeviceProfile: buildDeviceProfile(req.caps, req.maxBitrate),
    MaxStreamingBitrate: req.maxBitrate,
    StartTimeTicks: req.startTicks ?? 0,
    AudioStreamIndex: req.audioStreamIndex,
    SubtitleStreamIndex: req.subtitleStreamIndex,
    MediaSourceId: req.mediaSourceId,
    EnableDirectPlay: req.enableDirectPlay !== false,
    EnableDirectStream: true,
    EnableTranscoding: true,
    AllowVideoStreamCopy: true,
    AllowAudioStreamCopy: true,
    AutoOpenLiveStream: true,
  }
  const path = `/Items/${req.itemId}/PlaybackInfo?${query({ userId: s.userId })}`
  return request<PlaybackInfoResponse>(s, path, { method: 'POST', body: JSON.stringify(body) })
}

/** Sidecar files and HLS segments do not reliably get the player's headers, so the token also goes into the URL. */
function withApiKey(s: Session, url: string) {
  if (/[?&](ApiKey|api_key)=/i.test(url)) return url
  return `${url}${url.includes('?') ? '&' : '?'}ApiKey=${encodeURIComponent(s.token)}`
}

const SUBTITLE_TYPES: Record<string, SubtitleTrack['mimeType']> = {
  srt: 'application/x-subrip',
  vtt: 'text/vtt',
  ttml: 'application/ttml+xml',
}

function externalSubtitle(s: Session, stream: MediaStream): SubtitleTrack | undefined {
  if (stream.DeliveryMethod !== 'External' || !stream.DeliveryUrl) return undefined
  const extension = stream.DeliveryUrl.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
  const mimeType = SUBTITLE_TYPES[extension]
  if (!mimeType) return undefined
  return {
    streamIndex: stream.Index,
    title: `jf-${stream.Index}`,
    label: streamLabel(stream),
    language: stream.Language,
    uri: stream.IsExternalUrl ? stream.DeliveryUrl : withApiKey(s, s.server + stream.DeliveryUrl),
    mimeType,
  }
}

function transcodeReasons(url: string) {
  const match = /[?&]TranscodeReasons=([^&]*)/i.exec(url)
  return match ? decodeURIComponent(match[1]).split(',').filter(Boolean) : []
}

/** Picks the stream URL from a PlaybackInfo answer: remote path, direct play, then the server's transcoding URL. */
export function resolvePlayback(s: Session, info: PlaybackInfoResponse, req: PlaybackRequest): ResolvedPlayback {
  if (info.ErrorCode || !info.MediaSources?.length) throw new PlaybackError(info.ErrorCode ?? 'NoCompatibleStream')
  const source = info.MediaSources.find((m) => m.Id === req.mediaSourceId) ?? info.MediaSources[0]

  let url: string
  let playMethod: PlayMethod
  let reasons: string[] = []
  if (source.IsRemote && source.Protocol === 'Http' && source.Path) {
    url = source.Path
    playMethod = 'DirectPlay'
  } else if (source.SupportsDirectPlay && req.enableDirectPlay !== false) {
    const params = query({
      static: true,
      container: source.Container,
      mediaSourceId: source.Id,
      tag: source.ETag,
      playSessionId: info.PlaySessionId,
      deviceId: deviceId(),
      ApiKey: s.token,
    })
    url = `${s.server}/Videos/${req.itemId}/stream?${params}`
    playMethod = 'DirectPlay'
  } else if (source.TranscodingUrl) {
    url = withApiKey(s, s.server + source.TranscodingUrl)
    playMethod = 'Transcode'
    reasons = transcodeReasons(source.TranscodingUrl)
  } else {
    throw new PlaybackError('NoCompatibleStream')
  }

  const streams = source.MediaStreams ?? []
  const subtitleStreams = streams.filter((m) => m.Type === 'Subtitle')
  return {
    url,
    headers: { Authorization: authHeader(s.token), ...source.RequiredHttpHeaders },
    playMethod,
    playSessionId: info.PlaySessionId,
    mediaSource: source,
    audioStreams: streams.filter((m) => m.Type === 'Audio'),
    subtitleStreams,
    externalSubtitles: subtitleStreams.map((m) => externalSubtitle(s, m)).filter((t) => t !== undefined),
    audioStreamIndex: req.audioStreamIndex ?? source.DefaultAudioStreamIndex,
    subtitleStreamIndex: req.subtitleStreamIndex ?? source.DefaultSubtitleStreamIndex ?? -1,
    transcodeReasons: reasons,
    startTicks: req.startTicks ?? 0,
  }
}

export async function startPlayback(s: Session, req: PlaybackRequest) {
  return resolvePlayback(s, await getPlaybackInfo(s, req), req)
}

/** Position of an audio stream among the container's audio tracks (what the player calls the track index), or -1. */
export function audioTrackPosition(source: MediaSourceInfo, streamIndex: number) {
  const tracks = (source.MediaStreams ?? []).filter((m) => m.Type === 'Audio' && !m.IsExternal).sort((a, b) => a.Index - b.Index)
  return tracks.findIndex((m) => m.Index === streamIndex)
}

/** True when a track or quality change needs a new PlaybackInfo instead of a switch inside the player. */
export function needsRenegotiation(
  current: ResolvedPlayback,
  change: { audioStreamIndex?: number; subtitleStreamIndex?: number; maxBitrate?: number },
) {
  if (change.maxBitrate !== undefined) return true
  const audioChanged = change.audioStreamIndex !== undefined && change.audioStreamIndex !== current.audioStreamIndex
  if (audioChanged && current.playMethod === 'Transcode') return true
  if (change.subtitleStreamIndex === undefined || change.subtitleStreamIndex === current.subtitleStreamIndex) return false
  const burnedIn = (index: number) => current.subtitleStreams.find((m) => m.Index === index)?.DeliveryMethod === 'Encode'
  return burnedIn(change.subtitleStreamIndex) || burnedIn(current.subtitleStreamIndex)
}

export const streamLabel = (stream: MediaStream) => stream.DisplayTitle ?? stream.Language ?? `Spur ${stream.Index}`

export type ProgressReport = {
  itemId: string
  mediaSourceId: string
  playSessionId: string
  positionTicks: number
  isPaused: boolean
  isMuted?: boolean
  playMethod: PlayMethod
  audioStreamIndex?: number
  subtitleStreamIndex?: number
  canSeek?: boolean
}

function progressBody(r: ProgressReport) {
  return {
    ItemId: r.itemId,
    MediaSourceId: r.mediaSourceId,
    PlaySessionId: r.playSessionId,
    PositionTicks: Math.round(r.positionTicks),
    IsPaused: r.isPaused,
    IsMuted: r.isMuted ?? false,
    PlayMethod: r.playMethod,
    AudioStreamIndex: r.audioStreamIndex,
    SubtitleStreamIndex: r.subtitleStreamIndex,
    CanSeek: r.canSeek ?? true,
  }
}

const post = (s: Session, path: string, body: unknown) => request<void>(s, path, { method: 'POST', body: JSON.stringify(body) })

export async function reportPlaybackStart(s: Session, r: ProgressReport) {
  await post(s, '/Sessions/Playing', progressBody(r))
}

export async function reportPlaybackProgress(s: Session, r: ProgressReport) {
  await post(s, '/Sessions/Playing/Progress', progressBody(r))
}

export async function reportPlaybackStopped(
  s: Session,
  r: { itemId: string; mediaSourceId: string; playSessionId: string; positionTicks: number; failed?: boolean },
) {
  await post(s, '/Sessions/Playing/Stopped', {
    ItemId: r.itemId,
    MediaSourceId: r.mediaSourceId,
    PlaySessionId: r.playSessionId,
    PositionTicks: Math.round(r.positionTicks),
    Failed: r.failed ?? false,
  })
}

export async function stopTranscode(s: Session, playSessionId: string) {
  await request<void>(s, `/Videos/ActiveEncodings?${query({ deviceId: deviceId(), playSessionId })}`, { method: 'DELETE' })
}

export type MediaSegmentType = 'Intro' | 'Outro' | 'Recap' | 'Preview' | 'Commercial'
export type MediaSegment = { Id: string; ItemId: string; Type: MediaSegmentType | 'Unknown'; StartTicks: number; EndTicks: number }

export const SEGMENT_LABEL: Record<MediaSegmentType, string> = {
  Intro: 'Intro überspringen',
  Outro: 'Abspann überspringen',
  Recap: 'Rückblick überspringen',
  Preview: 'Vorschau überspringen',
  Commercial: 'Werbung überspringen',
}

const SEGMENT_TYPES = Object.keys(SEGMENT_LABEL) as MediaSegmentType[]

/** Segments come from server plugins (Jellyfin 10.10+). Older servers answer 404 or 501, which means none. */
export async function getMediaSegments(s: Session, itemId: string) {
  const types = SEGMENT_TYPES.map((type) => `includeSegmentTypes=${type}`).join('&')
  try {
    const { Items } = await request<{ Items: MediaSegment[] }>(s, `/MediaSegments/${itemId}?${types}`)
    return Items ?? []
  } catch (error) {
    if (error instanceof JellyfinError && (error.status === 404 || error.status === 501)) return []
    throw error
  }
}

export function segmentAt(segments: MediaSegment[], positionTicks: number) {
  return segments.find((m) => m.Type !== 'Unknown' && positionTicks >= m.StartTicks && positionTicks < m.EndTicks)
}

/** Trickplay info for a media source, with the width closest to the preferred one. */
export function trickplayFor(item: BaseItem, mediaSourceId: string, preferredWidth = 320): TrickplayInfo | undefined {
  const bySource = item.Trickplay?.[mediaSourceId] ?? Object.values(item.Trickplay ?? {})[0]
  const infos = Object.values(bySource ?? {})
  return infos.sort((a, b) => Math.abs(a.Width - preferredWidth) - Math.abs(b.Width - preferredWidth))[0]
}

export type TrickplayTile = { url: string; x: number; y: number; width: number; height: number; sheetWidth: number; sheetHeight: number }

/** Where the thumbnail for a position sits on its tile sheet. The last sheet can have fewer rows than TileHeight. */
export function trickplayTile(s: Session, itemId: string, mediaSourceId: string, info: TrickplayInfo, positionMs: number): TrickplayTile {
  const perSheet = info.TileWidth * info.TileHeight
  const tile = Math.max(0, Math.min(Math.floor(positionMs / info.Interval), info.ThumbnailCount - 1))
  const sheet = Math.floor(tile / perSheet)
  const inSheet = tile % perSheet
  const rows = Math.ceil(Math.min(perSheet, info.ThumbnailCount - sheet * perSheet) / info.TileWidth)
  const params = query({ mediaSourceId, ApiKey: s.token })
  return {
    url: `${s.server}/Videos/${itemId}/Trickplay/${info.Width}/${sheet}.jpg?${params}`,
    x: (inSheet % info.TileWidth) * info.Width,
    y: Math.floor(inSheet / info.TileWidth) * info.Height,
    width: info.Width,
    height: info.Height,
    sheetWidth: info.TileWidth * info.Width,
    sheetHeight: rows * info.Height,
  }
}

/** Started, not finished and below 95 %. */
export function shouldOfferResume(item: BaseItem) {
  const position = item.UserData?.PlaybackPositionTicks ?? 0
  if (position <= 0 || item.UserData?.Played) return false
  const percent = item.UserData?.PlayedPercentage ?? (item.RunTimeTicks ? (position / item.RunTimeTicks) * 100 : 0)
  return percent < 95
}

export function startTicksFor(item: BaseItem, mode: 'resume' | 'beginning', rewindSeconds: number) {
  if (mode === 'beginning' || !shouldOfferResume(item)) return 0
  return Math.max(0, (item.UserData?.PlaybackPositionTicks ?? 0) - secondsToTicks(rewindSeconds))
}

export type SegmentAction = 'off' | 'button' | 'auto'

export type PlaybackSettings = {
  maxBitrate: number
  allowAc3OnPhone: boolean
  resumeRewindSeconds: number
  segmentActions: Record<MediaSegmentType, SegmentAction>
  autoPlayNext: boolean
  autoPlayNextSeconds: number
  skipSeconds: number
  subtitleSize: 'small' | 'medium' | 'large'
}

export const DEFAULT_PLAYBACK_SETTINGS: PlaybackSettings = {
  maxBitrate: 120_000_000,
  allowAc3OnPhone: false,
  resumeRewindSeconds: 0,
  segmentActions: { Intro: 'button', Outro: 'button', Recap: 'button', Preview: 'button', Commercial: 'off' },
  autoPlayNext: true,
  autoPlayNextSeconds: 10,
  skipSeconds: 10,
  subtitleSize: 'medium',
}

export const BITRATE_OPTIONS: { value: number; label: string }[] = [
  { value: 120_000_000, label: 'Auto' },
  { value: 40_000_000, label: '40 Mbit/s' },
  { value: 20_000_000, label: '20 Mbit/s' },
  { value: 8_000_000, label: '8 Mbit/s' },
  { value: 4_000_000, label: '4 Mbit/s' },
]

const SETTINGS_KEY = 'bc.playback'

/** Playback settings are per device (phone and TV need different values), so they are not synced to Jellyfin. */
export function getPlaybackSettings(): PlaybackSettings {
  const stored = load<Partial<PlaybackSettings>>(SETTINGS_KEY, {})
  return {
    ...DEFAULT_PLAYBACK_SETTINGS,
    ...stored,
    segmentActions: { ...DEFAULT_PLAYBACK_SETTINGS.segmentActions, ...stored.segmentActions },
  }
}

export function savePlaybackSettings(change: Partial<PlaybackSettings>) {
  const settings = { ...getPlaybackSettings(), ...change }
  save(SETTINGS_KEY, settings)
  return settings
}

/** Remembered languages per series or movie. `subtitleLanguage: null` means subtitles off. */
export type TrackChoice = { audioLanguage?: string; subtitleLanguage?: string | null }

export const recallTracks = (key: string) => load<TrackChoice | null>(`bc.tracks.${key}`, null) ?? undefined

export const rememberTracks = (key: string, choice: TrackChoice) => save(`bc.tracks.${key}`, choice)

const sameLanguage = (a?: string, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase()

/** Stream indexes for a remembered choice; undefined fields keep the server default. */
export function applyTrackChoice(source: MediaSourceInfo, choice: TrackChoice | undefined) {
  const result: { audioStreamIndex?: number; subtitleStreamIndex?: number } = {}
  if (!choice) return result
  const streams = source.MediaStreams ?? []
  const audio = streams.find((m) => m.Type === 'Audio' && sameLanguage(m.Language, choice.audioLanguage))
  if (audio) result.audioStreamIndex = audio.Index
  if (choice.subtitleLanguage === null) result.subtitleStreamIndex = -1
  else {
    const subtitles = streams.filter((m) => m.Type === 'Subtitle' && sameLanguage(m.Language, choice.subtitleLanguage))
    const subtitle = subtitles.find((m) => !m.IsForced) ?? subtitles[0]
    if (subtitle) result.subtitleStreamIndex = subtitle.Index
  }
  return result
}
