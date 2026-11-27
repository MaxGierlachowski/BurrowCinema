import { useState } from 'react'
import { View } from 'react-native'
import {
  BITRATE_OPTIONS,
  getPlaybackSettings,
  savePlaybackSettings,
  type MediaSegmentType,
  type PlaybackSettings,
  type SegmentAction,
} from '@shared/playback'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { haptic } from '@/lib/haptics'
import { Focusable, isTV } from '@/lib/tv'
import { cn } from '@/lib/utils'

type Option<T> = { value: T; label: string }

const seconds = (values: number[], zero?: string): Option<number>[] =>
  values.map((value) => ({ value, label: value === 0 && zero ? zero : `${value} s` }))
const ON_OFF: Option<boolean>[] = [
  { value: true, label: 'An' },
  { value: false, label: 'Aus' },
]
const SEGMENT_ACTIONS: Option<SegmentAction>[] = [
  { value: 'off', label: 'Aus' },
  { value: 'button', label: 'Button' },
  { value: 'auto', label: 'Automatisch' },
]
const SEGMENTS: Option<MediaSegmentType>[] = [
  { value: 'Intro', label: 'Intro' },
  { value: 'Outro', label: 'Abspann' },
  { value: 'Recap', label: 'Rückblick' },
  { value: 'Preview', label: 'Vorschau' },
  { value: 'Commercial', label: 'Werbung' },
]
const SUBTITLE_SIZES: Option<PlaybackSettings['subtitleSize']>[] = [
  { value: 'small', label: 'Klein' },
  { value: 'medium', label: 'Mittel' },
  { value: 'large', label: 'Groß' },
]

/** Row of choice chips; Focusable, so it also works with the TV remote. */
function Choice<T extends string | number | boolean>({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string
  hint?: string
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <View className="gap-2">
      <View>
        <Text className="text-sm font-medium">{label}</Text>
        {hint && <Text className="text-xs text-muted-foreground">{hint}</Text>}
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const active = option.value === value
          return (
            <Focusable
              key={String(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => {
                if (active) return
                haptic.select()
                onChange(option.value)
              }}
              className={cn('h-9 justify-center rounded-lg border border-border px-3', active && 'border-primary bg-primary/15')}
            >
              <Text className={cn('text-sm font-medium', active ? 'text-primary' : 'text-muted-foreground')}>{option.label}</Text>
            </Focusable>
          )
        })}
      </View>
    </View>
  )
}

/** "Wiedergabe" settings. Stored on this device only, because phone and TV need different values. */
export function PlaybackSettingsCard() {
  const [settings, setSettings] = useState(getPlaybackSettings)
  const update = (change: Partial<PlaybackSettings>) => setSettings(savePlaybackSettings(change))

  return (
    <Card>
      <CardTitle>Wiedergabe</CardTitle>
      <CardDescription>Gilt nur für dieses Gerät.</CardDescription>
      <Choice
        label="Maximale Bitrate"
        options={BITRATE_OPTIONS}
        value={settings.maxBitrate}
        onChange={(maxBitrate) => update({ maxBitrate })}
      />
      {!isTV && (
        <Choice
          label="Dolby Digital direkt abspielen"
          hint="Nur einschalten, wenn das Handy AC 3 wiedergeben kann. Sonst wandelt der Server den Ton um."
          options={ON_OFF}
          value={settings.allowAc3OnPhone}
          onChange={(allowAc3OnPhone) => update({ allowAc3OnPhone })}
        />
      )}
      <Choice
        label="Beim Fortsetzen zurückspulen"
        options={seconds([0, 5, 10, 15, 30], 'Aus')}
        value={settings.resumeRewindSeconds}
        onChange={(resumeRewindSeconds) => update({ resumeRewindSeconds })}
      />
      <Choice
        label="Spulen um"
        options={seconds([5, 10, 15, 30])}
        value={settings.skipSeconds}
        onChange={(skipSeconds) => update({ skipSeconds })}
      />
      <Choice
        label="Nächste Folge automatisch abspielen"
        hint="Nur wenn es auch im Jellyfin Profil eingeschaltet ist."
        options={ON_OFF}
        value={settings.autoPlayNext}
        onChange={(autoPlayNext) => update({ autoPlayNext })}
      />
      {settings.autoPlayNext && (
        <Choice
          label="Countdown bis zur nächsten Folge"
          options={seconds([5, 10, 15, 30])}
          value={settings.autoPlayNextSeconds}
          onChange={(autoPlayNextSeconds) => update({ autoPlayNextSeconds })}
        />
      )}
      {SEGMENTS.map((segment) => (
        <Choice
          key={segment.value}
          label={`${segment.label} überspringen`}
          options={SEGMENT_ACTIONS}
          value={settings.segmentActions[segment.value]}
          onChange={(action) => update({ segmentActions: { ...settings.segmentActions, [segment.value]: action } })}
        />
      ))}
      <Choice
        label="Untertitelgröße"
        options={SUBTITLE_SIZES}
        value={settings.subtitleSize}
        onChange={(subtitleSize) => update({ subtitleSize })}
      />
    </Card>
  )
}
