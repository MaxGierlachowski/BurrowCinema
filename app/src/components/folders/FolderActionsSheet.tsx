import { Pencil, Trash2 } from 'lucide-react-native'
import { View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'

type Props = {
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onRename: () => void
  onDelete: () => void
}

/** Native counterpart of the web folder dropdown menu. */
export function FolderActionsSheet({ title, open, onOpenChange, onRename, onDelete }: Props) {
  // Let this sheet fade out before the next one (rename) opens; two modals at once can swallow the second.
  const run = (action: () => void) => () => {
    onOpenChange(false)
    setTimeout(action, 300)
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title}>
      <View className="gap-2">
        <Button variant="secondary" size="lg" icon={Pencil} onPress={run(onRename)}>
          Umbenennen
        </Button>
        <Button variant="destructive" size="lg" icon={Trash2} onPress={run(onDelete)}>
          Löschen
        </Button>
      </View>
    </Sheet>
  )
}
