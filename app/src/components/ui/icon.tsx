import type { LucideIcon, LucideProps } from 'lucide-react-native'
import { colors } from '@shared/theme'

export type IconColor = keyof typeof colors

type Props = Omit<LucideProps, 'color'> & { as: LucideIcon; color?: IconColor | (string & {}) }

/** Lucide icons, the same set as on the web. Colors are theme token names or any color string. */
export function Icon({ as: Component, color = 'foreground', size = 20, ...props }: Props) {
  const value = color in colors ? colors[color as IconColor] : color
  return <Component color={value} size={size} strokeWidth={2} {...props} />
}
