import { LinearGradient } from 'expo-linear-gradient'
import { Pause, PictureInPicture2, Play, RotateCcw, RotateCw, X } from 'lucide-react-native'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/button'
import { Clock, PanelButtons, Title } from './ControlsParts'
import { SeekBar } from './SeekBar'
import type { ControlsProps } from './types'

/** Touch controls. Empty areas let taps through to the layer below, which hides the controls. */
export function PhoneControls(props: ControlsProps) {
  const { paused, position, duration, skipSeconds, onTogglePlay, onSeek } = props
  const insets = useSafeAreaInsets()
  const padding = { paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        pointerEvents="none"
        colors={['#000000b3', '#00000000', '#00000000', '#000000cc']}
        locations={[0, 0.3, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View pointerEvents="box-none" className="flex-row items-center gap-3" style={[padding, { paddingTop: insets.top + 8 }]}>
        <Button variant="ghost" size="icon" icon={X} accessibilityLabel="Player schließen" onPress={props.onClose} />
        <Title title={props.title} subtitle={props.subtitle} />
        <Clock position={position} duration={duration} rate={props.rate} />
        {props.onPip && <Button variant="ghost" size="icon" icon={PictureInPicture2} accessibilityLabel="Bild in Bild" onPress={props.onPip} />}
      </View>

      <View pointerEvents="box-none" className="absolute inset-0 flex-row items-center justify-center gap-12">
        <Button
          variant="ghost"
          size="icon-lg"
          icon={RotateCcw}
          accessibilityLabel={`${skipSeconds} Sekunden zurück`}
          onPress={() => onSeek(Math.max(0, position - skipSeconds))}
        />
        <Button
          size="icon-lg"
          icon={paused ? Play : Pause}
          accessibilityLabel={paused ? 'Wiedergabe fortsetzen' : 'Wiedergabe pausieren'}
          onPress={onTogglePlay}
          className="size-16"
        />
        <Button
          variant="ghost"
          size="icon-lg"
          icon={RotateCw}
          accessibilityLabel={`${skipSeconds} Sekunden vor`}
          onPress={() => onSeek(Math.min(duration, position + skipSeconds))}
        />
      </View>

      <View pointerEvents="box-none" className="mt-auto gap-1" style={[padding, { paddingBottom: insets.bottom + 8 }]}>
        <SeekBar position={position} duration={duration} chapters={props.chapters} trickplay={props.trickplay} onSeek={onSeek} onScrub={props.onScrub} />
        <PanelButtons panels={props.panels} onPanel={props.onPanel} />
      </View>
    </View>
  )
}
