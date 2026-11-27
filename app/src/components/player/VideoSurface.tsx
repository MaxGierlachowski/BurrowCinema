/**
 * The only file that imports the video library. Everything else talks to this small, library free interface,
 * so switching to expo-video means replacing this file (and setting caps.sidecarSubtitles = false).
 */
import { useImperativeHandle, useMemo, useRef, type Ref } from 'react'
import { Platform, StyleSheet } from 'react-native'
import Video, {
  SelectedTrackType,
  TextTrackType,
  VideoDecoderProperties,
  ViewType,
  type ISO639_1,
  type ReactVideoSource,
  type VideoRef,
} from 'react-native-video'
import type { PlaybackSettings, SubtitleTrack } from '@shared/playback'
import { isTV } from '@/lib/tv'

export type ResizeMode = 'contain' | 'cover' | 'stretch'
export type VideoSurfaceHandle = { seek: (seconds: number) => void; enterPip: () => void }

type Props = {
  uri: string
  headers: Record<string, string>
  /** HLS transcode; the URL alone does not always tell the player. */
  isHls?: boolean
  startSeconds: number
  textTracks: SubtitleTrack[]
  /** 'jf-<Index>' of the sidecar subtitle to show, undefined = off. */
  selectedSubtitleTitle?: string
  /** Position among the container's audio tracks (audioTrackPosition), undefined = player default. */
  audioTrackPosition?: number
  paused: boolean
  rate: number
  resizeMode: ResizeMode
  subtitleSize: PlaybackSettings['subtitleSize']
  /** Enter picture in picture when the app is left. */
  pip: boolean
  onLoad: (e: { duration: number; currentTime: number }) => void
  onProgress: (seconds: number) => void
  onPlayingChange?: (playing: boolean) => void
  onBuffering: (buffering: boolean) => void
  onEnd: () => void
  onError: (message: string) => void
  onPipChange?: (active: boolean) => void
  ref?: Ref<VideoSurfaceHandle>
}

const MIME_TYPES: Record<SubtitleTrack['mimeType'], TextTrackType> = {
  'application/x-subrip': TextTrackType.SUBRIP,
  'text/vtt': TextTrackType.VTT,
  'application/ttml+xml': TextTrackType.TTML,
}

const FONT_SIZE: Record<PlaybackSettings['subtitleSize'], number> = { small: 16, medium: 20, large: 26 }

export function VideoSurface(props: Props) {
  const { uri, headers, isHls, startSeconds, textTracks, selectedSubtitleTitle, audioTrackPosition, subtitleSize, ref } = props
  const video = useRef<VideoRef>(null)

  useImperativeHandle(ref, () => ({
    seek: (seconds) => video.current?.seek(seconds),
    enterPip: () => video.current?.enterPictureInPicture(),
  }))

  // A new source object reloads the stream, so it only changes with the URL or the sidecar list.
  const source = useMemo<ReactVideoSource>(
    () => ({
      uri,
      headers,
      type: isHls ? 'm3u8' : undefined,
      startPosition: Math.round(startSeconds * 1000),
      textTracks: textTracks.map((t) => ({
        title: t.title,
        language: (t.language ?? 'und') as ISO639_1,
        type: MIME_TYPES[t.mimeType],
        uri: t.uri,
      })),
    }),
    [uri, headers, isHls, startSeconds, textTracks],
  )
  const textTrack = useMemo(
    () => (selectedSubtitleTitle ? { type: SelectedTrackType.TITLE, value: selectedSubtitleTitle } : { type: SelectedTrackType.DISABLED }),
    [selectedSubtitleTitle],
  )
  const audioTrack = useMemo(
    () => (audioTrackPosition !== undefined && audioTrackPosition >= 0 ? { type: SelectedTrackType.INDEX, value: audioTrackPosition } : undefined),
    [audioTrackPosition],
  )
  const subtitleStyle = useMemo(() => ({ fontSize: FONT_SIZE[subtitleSize] }), [subtitleSize])

  return (
    <Video
      ref={video}
      source={source}
      style={StyleSheet.absoluteFill}
      controls={false}
      viewType={ViewType.SURFACE}
      focusable={isTV ? false : undefined}
      paused={props.paused}
      rate={props.rate}
      resizeMode={props.resizeMode}
      selectedTextTrack={textTrack}
      selectedAudioTrack={audioTrack}
      subtitleStyle={subtitleStyle}
      enterPictureInPictureOnLeave={props.pip}
      playInBackground={false}
      progressUpdateInterval={1000}
      shutterColor="black"
      onLoad={(e) => props.onLoad({ duration: e.duration, currentTime: e.currentTime })}
      onProgress={(e) => props.onProgress(e.currentTime)}
      onPlaybackStateChanged={(e) => props.onPlayingChange?.(e.isPlaying)}
      onBuffer={(e) => props.onBuffering(e.isBuffering)}
      onEnd={props.onEnd}
      onError={(e) => props.onError(e.error.errorString ?? e.error.localizedDescription ?? e.error.errorCode ?? 'Unbekannter Fehler')}
      onPictureInPictureStatusChanged={(e) => props.onPipChange?.(e.isActive)}
    />
  )
}

/** HEVC and AV1 decoder support for the device profile (Android only). */
export async function probeDecoders() {
  if (Platform.OS !== 'android') return { hevc: true, av1: false }
  const [hevc, av1] = await Promise.all([
    VideoDecoderProperties.isHEVCSupported(),
    VideoDecoderProperties.isCodecSupported('video/av01', 1920, 1080),
  ])
  return { hevc: hevc !== 'unsupported', av1: av1 === 'hardware' }
}
