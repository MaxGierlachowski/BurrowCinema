import { View } from 'react-native'
import type { ResolvedPlayback } from '@shared/playback'
import { Text } from '@/components/ui/text'

const METHOD: Record<ResolvedPlayback['playMethod'], string> = {
  DirectPlay: 'Direkte Wiedergabe',
  DirectStream: 'Direkter Stream',
  Transcode: 'Transkodierung',
}

const join = (...parts: (string | number | undefined)[]) => parts.filter(Boolean).join(' · ')
const mbit = (bits?: number) => (bits ? `${(bits / 1_000_000).toFixed(1).replace('.', ',')} Mbit/s` : undefined)

/** Light "Statistiken": how the stream is delivered and what it contains. */
export function StatsOverlay({ playback }: { playback: ResolvedPlayback }) {
  const { mediaSource } = playback
  const streams = mediaSource.MediaStreams ?? []
  const video = streams.find((m) => m.Type === 'Video')
  const audio = playback.audioStreams.find((m) => m.Index === playback.audioStreamIndex) ?? playback.audioStreams[0]
  const rows: [string, string | undefined][] = [
    ['Wiedergabe', METHOD[playback.playMethod]],
    ['Container', mediaSource.Container],
    ['Video', video && join(video.Codec?.toUpperCase(), video.Width && `${video.Width}×${video.Height}`, video.VideoRangeType)],
    ['Audio', audio && join(audio.Codec?.toUpperCase(), audio.ChannelLayout ?? (audio.Channels && `${audio.Channels} Kanäle`))],
    ['Bitrate', mbit(mediaSource.Bitrate)],
    ['Gründe', playback.transcodeReasons.join(', ') || undefined],
  ]
  return (
    <View pointerEvents="none" className="gap-0.5 rounded-xl bg-black/75 p-3">
      {rows
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <Text key={label} className="text-xs text-foreground">
            <Text className="text-xs text-foreground/60">{label}: </Text>
            {value}
          </Text>
        ))}
    </View>
  )
}
