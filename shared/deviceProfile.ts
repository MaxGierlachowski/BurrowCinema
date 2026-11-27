/** What the device can decode itself. The app probes this (see app/src/lib/deviceCaps.ts); shared code only reads it. */
export type DeviceCaps = { isTV: boolean; hevc: boolean; av1: boolean; ac3: boolean; maxAudioChannels: number; sidecarSubtitles: boolean }

export const DEFAULT_CAPS: DeviceCaps = { isTV: false, hevc: true, av1: false, ac3: false, maxAudioChannels: 2, sidecarSubtitles: true }

export type DeviceProfile = Record<string, unknown>

const TEXT_SUBTITLES = ['srt', 'subrip', 'vtt', 'ttml']
const OTHER_TEXT_SUBTITLES = ['ass', 'ssa', 'sub', 'smi']
const IMAGE_SUBTITLES = ['pgssub', 'dvdsub', 'dvbsub', 'vobsub']

const list = (...codecs: (string | false)[]) => codecs.filter(Boolean).join(',')

/**
 * Jellyfin device profile for Media3 without FFmpeg. DTS, TrueHD and ALAC are never direct played:
 * the server then copies the video and only converts the audio.
 * Text subtitles are only offered as sidecar files (never Embed), so the player never has to map container track indexes.
 */
export function buildDeviceProfile(caps: DeviceCaps, maxBitrate: number): DeviceProfile {
  const dolby = caps.ac3 && 'ac3,eac3'
  const subtitles = caps.sidecarSubtitles
    ? TEXT_SUBTITLES.map((Format) => ({ Format, Method: 'External' }))
    : [...TEXT_SUBTITLES, ...OTHER_TEXT_SUBTITLES].map((Format) => ({ Format, Method: 'Encode' }))

  return {
    Name: 'BurrowCinema Media3',
    MaxStaticBitrate: maxBitrate,
    MaxStreamingBitrate: maxBitrate,
    DirectPlayProfiles: [
      {
        Type: 'Video',
        Container: 'mp4,m4v,mkv,webm,mov,ts',
        VideoCodec: list('h264', 'vp9', caps.hevc && 'hevc', caps.av1 && 'av1'),
        AudioCodec: list('aac,mp3,opus,vorbis,flac,pcm_s16le,pcm_s24le', dolby),
      },
    ],
    TranscodingProfiles: [
      {
        Type: 'Video',
        Context: 'Streaming',
        Protocol: 'hls',
        Container: 'ts',
        VideoCodec: list('h264', caps.hevc && 'hevc'),
        AudioCodec: list('aac,mp3', dolby),
        MaxAudioChannels: String(caps.maxAudioChannels),
        BreakOnNonKeyFrames: true,
      },
    ],
    CodecProfiles: [
      {
        Type: 'Video',
        Codec: 'h264',
        Conditions: [{ Condition: 'LessThanEqual', Property: 'VideoBitDepth', Value: '8', IsRequired: false }],
      },
      {
        // Only blocks pure Dolby Vision (profile 5); DV with an HDR10 or SDR base layer still plays.
        Type: 'Video',
        Codec: 'hevc',
        Conditions: [{ Condition: 'NotEquals', Property: 'VideoRangeType', Value: 'DOVI', IsRequired: true }],
      },
    ],
    SubtitleProfiles: [...subtitles, ...IMAGE_SUBTITLES.map((Format) => ({ Format, Method: 'Encode' }))],
  }
}
