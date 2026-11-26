import { Check, FolderPlus, Plus } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { toast } from 'sonner-native'
import type { FolderItem } from '@shared/folders'
import { plural } from '@shared/format'
import { useFolders } from '@shared/hooks/useFolders'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Sheet } from '@/components/ui/sheet'
import { SheetInput } from '@/components/ui/sheet-input'
import { Text } from '@/components/ui/text'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'

function FolderRow({ name, count, active, onPress }: { name: string; count: number; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-lg px-3 py-3 active:bg-accent"
    >
      <View className={cn('size-6 items-center justify-center rounded-md border border-input', active && 'border-primary bg-primary')}>
        {active && <Icon as={Check} size={16} color="primaryForeground" />}
      </View>
      <Text className="flex-1 font-medium" numberOfLines={1}>
        {name}
      </Text>
      <Text className="text-xs text-muted-foreground">{count}</Text>
    </Pressable>
  )
}

export function AddToFolder({ item, variant = 'default' }: { item: FolderItem; variant?: 'default' | 'secondary' }) {
  const { folders, create, toggleItem } = useFolders()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const count = folders.filter((f) => f.items.some((i) => i.key === item.key)).length

  const onCreate = () => {
    if (!name.trim()) return
    create(name.trim(), [item])
    haptic.success()
    toast.success(`„${name.trim()}“ angelegt`)
    setName('')
  }

  return (
    <>
      <Button size="lg" variant={variant} icon={count ? Check : FolderPlus} onPress={() => setOpen(true)}>
        {count ? `In ${plural(count, 'Ordner', 'Ordnern')}` : 'Zu Ordner hinzufügen'}
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Ordner auswählen"
        description={item.title}
        footer={
          <View className="flex-row gap-2">
            <View className="flex-1">
              <SheetInput value={name} onChangeText={setName} placeholder="Neuer Ordner" returnKeyType="done" onSubmitEditing={onCreate} />
            </View>
            <Button size="lg" variant="secondary" icon={Plus} haptics={false} disabled={!name.trim()} onPress={onCreate}>
              Anlegen
            </Button>
          </View>
        }
      >
        <View className="gap-1">
          {folders.length === 0 && <Text className="py-4 text-center text-sm text-muted-foreground">Noch keine Ordner. Leg unten den ersten an.</Text>}
          {folders.map((folder) => (
            <FolderRow
              key={folder.id}
              name={folder.name}
              count={folder.items.length}
              active={folder.items.some((i) => i.key === item.key)}
              onPress={() => {
                haptic.select()
                toggleItem(folder.id, item)
              }}
            />
          ))}
        </View>
      </Sheet>
    </>
  )
}
