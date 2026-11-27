import type { LucideIcon } from 'lucide-react-native'
import type { TrickplayTile } from '@shared/playback'

export type PanelId = 'audio' | 'subtitles' | 'quality' | 'speed' | 'aspect' | 'chapters'
export type PanelButton = { id: PanelId | 'stats'; label: string; icon: LucideIcon }

/** What both control overlays (phone and TV) show and can do. */
export type ControlsProps = {
  title: string
  subtitle?: string
  paused: boolean
  position: number
  duration: number
  rate: number
  skipSeconds: number
  /** Chapter starts in seconds. */
  chapters: number[]
  panels: PanelButton[]
  trickplay?: (seconds: number) => TrickplayTile | undefined
  onTogglePlay: () => void
  onSeek: (seconds: number) => void
  onPanel: (id: PanelButton['id']) => void
  onClose: () => void
  onScrub: (active: boolean) => void
  onPip?: () => void
  onPrevious?: () => void
  onNext?: () => void
  /** TV: position while scrubbing with the remote. */
  pending?: number
  onSeekBarFocus?: (focused: boolean) => void
}
