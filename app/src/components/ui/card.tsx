import { View, type ViewProps } from 'react-native'
import { cn } from '@/lib/utils'
import { Text } from './text'

export function Card({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn('gap-4 rounded-2xl border border-border bg-card p-4', className)} {...props} />
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <Text className="text-lg font-semibold">{children}</Text>
}

export function CardDescription({ children }: { children: React.ReactNode }) {
  return <Text className="-mt-3 text-sm text-muted-foreground">{children}</Text>
}
