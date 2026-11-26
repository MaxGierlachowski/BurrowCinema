import type { ReactNode } from 'react'
import { View } from 'react-native'
import { colors } from '@shared/theme'
import { Text } from './ui/text'

type IconComponent = (props: { size?: number; color?: string }) => ReactNode

export function EmptyState({ icon: Icon, title, text, children }: { icon: IconComponent; title: string; text?: ReactNode; children?: ReactNode }) {
  return (
    <View className="items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-12">
      <View className="size-12 items-center justify-center rounded-full bg-muted">
        <Icon size={24} color={colors.mutedForeground} />
      </View>
      <View className="items-center">
        <Text className="text-center font-medium">{title}</Text>
        {text && <Text className="mt-1 max-w-xs text-center text-sm text-muted-foreground">{text}</Text>}
      </View>
      {children}
    </View>
  )
}
