import type { ComponentRef, Ref } from 'react'
import { TextInput, type TextInputProps } from 'react-native'
import { colors } from '@shared/theme'
import { cn } from '@/lib/utils'

export type InputRef = ComponentRef<typeof TextInput>

export function Input({ className, ...props }: TextInputProps & { className?: string; ref?: Ref<InputRef> }) {
  return (
    <TextInput
      placeholderTextColor={colors.mutedForeground}
      selectionColor={colors.primary}
      cursorColor={colors.primary}
      className={cn('h-12 rounded-xl border border-input bg-card px-4 font-sans text-base text-foreground', className)}
      {...props}
    />
  )
}
