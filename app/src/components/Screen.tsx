import type { ReactNode } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { cn } from '@/lib/utils'
import { Text } from './ui/text'

/** Root of a tab screen. The app draws edge to edge, so the status bar inset is added here. */
export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  const insets = useSafeAreaInsets()
  return (
    <View className={cn('flex-1 bg-background', className)} style={{ paddingTop: insets.top }}>
      {children}
    </View>
  )
}

/** Same as the web PageHeader: big title, optional subtitle and actions on the right. */
export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <View className="mb-5 flex-row flex-wrap items-end justify-between gap-3 pt-4">
      <View className="shrink">
        <Text className="text-3xl font-bold tracking-tight">{title}</Text>
        {subtitle && <Text className="text-sm text-muted-foreground">{subtitle}</Text>}
      </View>
      {children}
    </View>
  )
}
