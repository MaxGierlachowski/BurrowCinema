import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { SheetInput } from '@/components/ui/sheet-input'

type Props = {
  title: string
  confirmLabel: string
  initial?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (name: string) => void
}

/** Native counterpart of the web NameDialog: one name field in a bottom sheet. */
export function NameSheet({ title, confirmLabel, initial = '', open, onOpenChange, onSubmit }: Props) {
  const [name, setName] = useState(initial)

  useEffect(() => {
    if (open) setName(initial)
  }, [open, initial])

  const submit = () => {
    if (!name.trim()) return
    onSubmit(name.trim())
    onOpenChange(false)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <Button size="lg" disabled={!name.trim()} onPress={submit}>
          {confirmLabel}
        </Button>
      }
    >
      <SheetInput
        autoFocus
        value={name}
        onChangeText={setName}
        placeholder="Name des Ordners"
        returnKeyType="done"
        onSubmitEditing={submit}
      />
    </Sheet>
  )
}
