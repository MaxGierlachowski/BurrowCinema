import type { TextInputProps } from 'react-native'
import { Input } from './input'

/** Input for use inside a Sheet. The sheet handles the keyboard itself, so this is the regular Input. */
export function SheetInput(props: TextInputProps) {
  return <Input {...props} />
}
