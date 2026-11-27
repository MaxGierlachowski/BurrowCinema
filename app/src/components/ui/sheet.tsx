import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native'
import Animated, { SlideInDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from './text'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}

/**
 * Bottom sheet, the native counterpart of the web Drawer. Built on React Native's Modal, so it
 * works without extra native libraries. Closes on backdrop tap and the Android back gesture.
 */
export function Sheet({ open, onOpenChange, title, description, children, footer }: Props) {
  const insets = useSafeAreaInsets()
  const close = () => onOpenChange(false)

  return (
    <Modal visible={open} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end">
        <Pressable accessibilityLabel="Schließen" onPress={close} focusable={false} className="absolute inset-0 bg-black/60" />
        <Animated.View
          entering={SlideInDown.duration(260)}
          className="max-h-[85%] rounded-t-3xl border-t border-border bg-popover"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <View className="items-center pt-3 pb-1">
            <View className="h-1 w-10 rounded-full bg-muted-foreground/40" />
          </View>
          <View className="items-center gap-1 px-4 pt-2 pb-4">
            <Text className="text-lg font-semibold">{title}</Text>
            {description && <Text className="text-center text-sm text-muted-foreground">{description}</Text>}
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="px-4" bounces={false}>
            {children}
          </ScrollView>
          {footer && <View className="px-4 pt-4">{footer}</View>}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
