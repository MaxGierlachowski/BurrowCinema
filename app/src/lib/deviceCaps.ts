import { DEFAULT_CAPS, type DeviceCaps } from '@shared/deviceProfile'
import { probeDecoders } from '@/components/player/VideoSurface'
import { isTV } from '@/lib/tv'

const fallback = { hevc: DEFAULT_CAPS.hevc, av1: DEFAULT_CAPS.av1 }
let decoders: Promise<{ hevc: boolean; av1: boolean }> | undefined

/** Decoder support is probed once per app start. If the probe fails or hangs, HEVC counts as supported and AV1 not. */
export async function getDeviceCaps(allowAc3OnPhone: boolean): Promise<DeviceCaps> {
  decoders ??= Promise.race([
    probeDecoders(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Decoder probe timed out')), 2000)),
  ]).catch(() => fallback)
  return {
    ...DEFAULT_CAPS,
    ...(await decoders),
    isTV,
    // TVs pass Dolby Digital to the receiver; phones often play it silently, so it is opt in there.
    ac3: isTV || allowAc3OnPhone,
    maxAudioChannels: isTV ? 6 : 2,
  }
}
