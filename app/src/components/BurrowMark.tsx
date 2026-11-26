import { View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { colors } from '@shared/theme'
import { Text } from './ui/text'

/** Brand mark, identical paths to the web version: a rabbit peeking out of its burrow. */
export function BurrowMark({ size = 24, color = colors.foreground }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M2.5 20h19" />
      <Path d="M7 20a5 5 0 0 1 10 0" />
      <Path d="M10.2 15.2C9 12 8.6 7.6 9.4 3.8c1.4 2.8 2 6.6 2 11.2" />
      <Path d="M13.8 15.2c1.2-3.2 1.6-7.6.8-11.4c-1.4 2.8-2 6.6-2 11.2" />
    </Svg>
  )
}

/** Solid ears that peek out behind the login card. */
export function PeekingEars({ width = 48, height = 64 }: { width?: number; height?: number }) {
  const fill = '#4a3a22'
  return (
    <Svg width={width} height={height} viewBox="0 0 40 52">
      <Path fill={fill} d="M18 52C13 40 9.5 24 12 3c5.5 8 7.5 24 7.5 49Z" />
      <Path fill={fill} d="M22 52c5-12 8.5-28 6-49c-5.5 8-7.5 24-7.5 49Z" />
    </Svg>
  )
}

export function Logo() {
  return (
    <View className="flex-row items-center gap-2.5">
      <View className="size-9 items-center justify-center rounded-xl bg-primary">
        <BurrowMark size={22} color={colors.primaryForeground} />
      </View>
      <Text className="text-xl font-semibold">BurrowCinema</Text>
    </View>
  )
}
