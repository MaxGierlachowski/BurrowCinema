import { cva, type VariantProps } from 'class-variance-authority'
import type { LucideIcon } from 'lucide-react-native'
import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, type PressableProps } from 'react-native'
import { colors } from '@shared/theme'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import { Icon, type IconColor } from './icon'
import { Text } from './text'

const buttonVariants = cva('flex-row items-center justify-center gap-2 rounded-xl active:opacity-80', {
  variants: {
    variant: {
      default: 'bg-primary',
      secondary: 'bg-secondary',
      outline: 'border border-border bg-transparent',
      ghost: 'bg-transparent',
      destructive: 'bg-destructive/15',
    },
    size: {
      default: 'h-11 px-4',
      sm: 'h-9 px-3',
      lg: 'h-12 px-5',
      icon: 'size-11',
      'icon-sm': 'size-9',
      'icon-lg': 'size-14 rounded-full',
    },
  },
  defaultVariants: { variant: 'default', size: 'default' },
})

const textColor: Record<string, IconColor> = {
  default: 'primaryForeground',
  secondary: 'secondaryForeground',
  outline: 'foreground',
  ghost: 'foreground',
  destructive: 'destructive',
}

type Props = Omit<PressableProps, 'children'> &
  VariantProps<typeof buttonVariants> & {
    className?: string
    icon?: LucideIcon
    loading?: boolean
    children?: ReactNode
    /** Light tap feedback, on by default. */
    haptics?: boolean
  }

export function Button({ variant, size, className, icon, loading, children, haptics = true, disabled, onPress, ...props }: Props) {
  const color = textColor[variant ?? 'default']
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={(e) => {
        if (haptics) haptic.tap()
        onPress?.(e)
      }}
      className={cn(buttonVariants({ variant, size }), (disabled || loading) && 'opacity-50', className)}
      {...props}
    >
      {loading ? <ActivityIndicator size="small" color={colors[color]} /> : icon && <Icon as={icon} color={color} size={size === 'icon-lg' ? 26 : 18} />}
      {typeof children === 'string' ? (
        <Text className="font-medium" style={{ color: colors[color] }}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  )
}
