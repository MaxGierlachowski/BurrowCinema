import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { useEffect, useRef, type ReactNode } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '@shared/theme'
import { Text } from './text'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}

/** Bottom sheet, the native counterpart of the web Drawer. */
export function Sheet({ open, onOpenChange, title, description, children, footer }: Props) {
  const ref = useRef<BottomSheetModal>(null)
  const insets = useSafeAreaInsets()

  useEffect(() => {
    if (open) ref.current?.present()
    else ref.current?.dismiss()
  }, [open])

  return (
    <BottomSheetModal
      ref={ref}
      onDismiss={() => onOpenChange(false)}
      enableDynamicSizing
      maxDynamicContentSize={620}
      backgroundStyle={{ backgroundColor: colors.popover }}
      handleIndicatorStyle={{ backgroundColor: colors.mutedForeground, width: 40 }}
      backdropComponent={(props) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.6} />}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      <BottomSheetScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
        <View className="items-center gap-1 px-4 pt-1 pb-4">
          <Text className="text-lg font-semibold">{title}</Text>
          {description && <Text className="text-center text-sm text-muted-foreground">{description}</Text>}
        </View>
        <View className="px-4">{children}</View>
        {footer && <View className="px-4 pt-4">{footer}</View>}
      </BottomSheetScrollView>
    </BottomSheetModal>
  )
}
