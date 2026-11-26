import { Text } from './text'

export function Label({ children }: { children: string }) {
  return <Text className="mb-2 text-sm font-medium">{children}</Text>
}
