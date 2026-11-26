import { cva, type VariantProps } from 'class-variance-authority'
import { View } from 'react-native'
import { cn } from '@/lib/utils'
import { Text } from './text'

const badgeVariants = cva('self-start rounded-full px-2.5 py-0.5', {
  variants: {
    variant: {
      default: 'bg-primary',
      secondary: 'bg-secondary',
      outline: 'border border-border',
      destructive: 'bg-destructive/20',
    },
  },
  defaultVariants: { variant: 'default' },
})

const textVariants = cva('text-xs font-medium', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      secondary: 'text-secondary-foreground',
      outline: 'text-foreground',
      destructive: 'text-destructive',
    },
  },
  defaultVariants: { variant: 'default' },
})

type Props = VariantProps<typeof badgeVariants> & { children: string; className?: string }

export function Badge({ variant, className, children }: Props) {
  return (
    <View className={cn(badgeVariants({ variant }), className)}>
      <Text className={textVariants({ variant })}>{children}</Text>
    </View>
  )
}
