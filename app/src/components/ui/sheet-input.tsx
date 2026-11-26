import { BottomSheetTextInput } from '@gorhom/bottom-sheet'
import type { TextInputProps } from 'react-native'
import { colors } from '@shared/theme'

/** Input for use inside a Sheet; keeps the sheet above the keyboard. Same look as Input. */
export function SheetInput(props: TextInputProps) {
  return (
    <BottomSheetTextInput
      placeholderTextColor={colors.mutedForeground}
      selectionColor={colors.primary}
      cursorColor={colors.primary}
      style={{
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.input,
        backgroundColor: colors.card,
        paddingHorizontal: 16,
        fontFamily: 'Geist',
        fontSize: 16,
        color: colors.foreground,
      }}
      {...props}
    />
  )
}
