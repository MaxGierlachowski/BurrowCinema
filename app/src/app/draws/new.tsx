import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Check, ChevronDown, Search } from 'lucide-react-native'
import { useState, type ReactNode } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native'
import { toast } from 'sonner-native'
import { createDraw, TYPE_LABEL, type DrawItemType } from '@shared/draws'
import { fromJellyfin, type Folder, type FolderItem } from '@shared/folders'
import { plural } from '@shared/format'
import { useSession } from '@shared/hooks/useAuth'
import { useFolders } from '@shared/hooks/useFolders'
import { getAllItems, getItems, getUsers, userImageUrl, type JellyfinUser } from '@shared/jellyfin'
import { DateTimeField } from '@/components/draws/DateTimeField'
import { BackHeader, Initials, useScreenPadding } from '@/components/draws/DrawParts'
import { Segmented } from '@/components/draws/Segmented'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet } from '@/components/ui/sheet'
import { Text } from '@/components/ui/text'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'

const HOUR = 3_600_000
const DURATIONS = [
  { label: '2 Std.', ms: 2 * HOUR },
  { label: '1 Tag', ms: 24 * HOUR },
  { label: '3 Tage', ms: 72 * HOUR },
  { label: '1 Woche', ms: 168 * HOUR },
]

const TYPE_OPTIONS = (Object.keys(TYPE_LABEL) as DrawItemType[]).map((t) => ({ value: t, label: t === 'Movie,Series' ? 'Beides' : TYPE_LABEL[t] }))

const matchesType = (item: FolderItem, type: DrawItemType) =>
  type === 'Movie,Series' || item.type === (type === 'Movie' ? 'movie' : 'series')

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View>
      <Label>{label}</Label>
      <View className="gap-2">{children}</View>
    </View>
  )
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <View className={cn('size-6 items-center justify-center rounded-md border border-border', checked && 'border-primary bg-primary')}>
      {checked && <Icon as={Check} color="primaryForeground" size={16} />}
    </View>
  )
}

function OptionRow({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 rounded-lg px-2 py-3 active:bg-accent">
      <Text className="flex-1 font-medium">{label}</Text>
      {active && <Icon as={Check} color="primary" size={18} />}
    </Pressable>
  )
}

/** The web Select, as a bottom sheet: whole library or one of the own folders. */
function SourcePicker({ value, folders, onChange }: { value: string; folders: Folder[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const folder = folders.find((f) => f.id === value)
  const pick = (id: string) => {
    haptic.select()
    onChange(id)
    setOpen(false)
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        className="h-12 flex-row items-center justify-between rounded-xl border border-input bg-card px-4 active:opacity-80"
      >
        <Text numberOfLines={1}>{folder ? `Ordner: ${folder.name}` : 'Ganze Bibliothek'}</Text>
        <Icon as={ChevronDown} color="mutedForeground" size={18} />
      </Pressable>
      <Sheet open={open} onOpenChange={setOpen} title="Quelle">
        <OptionRow label="Ganze Bibliothek" active={!folder} onPress={() => pick('library')} />
        {folders.map((f) => (
          <OptionRow key={f.id} label={`Ordner: ${f.name}`} active={f.id === value} onPress={() => pick(f.id)} />
        ))}
      </Sheet>
    </>
  )
}

function UserRow({ user, image, active, onPress }: { user: JellyfinUser; image?: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 rounded-lg px-2 py-2 active:bg-accent">
      {image ? <Image source={image} style={{ width: 32, height: 32, borderRadius: 16 }} contentFit="cover" /> : <Initials name={user.Name} />}
      <Text className="flex-1 font-medium">{user.Name}</Text>
      <Checkbox checked={active} />
    </Pressable>
  )
}

export default function NewDraw() {
  const session = useSession()
  const queryClient = useQueryClient()
  const padding = useScreenPadding()
  const { folders } = useFolders()

  const [title, setTitle] = useState('Filmabend')
  const [source, setSource] = useState('library')
  const [itemType, setItemType] = useState<DrawItemType>('Movie')
  const [start, setStart] = useState(() => Date.now())
  const [end, setEnd] = useState(() => Date.now() + 24 * HOUR)
  const [search, setSearch] = useState('')
  const [invited, setInvited] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const users = useQuery({ queryKey: ['users'], queryFn: () => getUsers(session) })
  const folder = folders.find((f) => f.id === source)
  const libraryCount = useQuery({
    queryKey: ['count', itemType],
    queryFn: () => getItems(session, { type: itemType, limit: 1 }),
    enabled: source === 'library',
  })
  const poolSize = folder ? folder.items.filter((i) => matchesType(i, itemType)).length : libraryCount.data?.TotalRecordCount

  const visibleUsers = (users.data ?? []).filter((u) => u.Name.toLowerCase().includes(search.trim().toLowerCase()))
  const toggle = (id: string, name: string) => {
    haptic.select()
    setInvited(({ [id]: removed, ...rest }) => (removed ? rest : { ...rest, [id]: name }))
  }

  const submit = async () => {
    if (!(end > start)) {
      haptic.error()
      return toast.error('Das Ende muss nach dem Start liegen')
    }
    setSaving(true)
    try {
      const items = folder
        ? folder.items.filter((i) => matchesType(i, itemType))
        : (await getAllItems(session, itemType)).map((i) => fromJellyfin(session, i))
      if (!items.length) throw new Error('Für diese Auswahl gibt es keine Titel')
      const draw = await createDraw(session, {
        title: title.trim(),
        itemType,
        sourceLabel: folder ? folder.name : 'Bibliothek',
        startsAt: start,
        endsAt: end,
        invitees: Object.entries(invited).map(([id, name]) => ({ id, name })),
        items,
      })
      queryClient.invalidateQueries({ queryKey: ['draws'] })
      haptic.success()
      toast.success(`„${draw.title}“ angelegt`)
      router.replace(`/draws/${draw.id}`)
    } catch (err) {
      haptic.error()
      toast.error((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-background">
      <ScrollView contentContainerStyle={padding} keyboardShouldPersistTaps="handled">
        <BackHeader title="Neue Auslosung" />
        <View className="gap-6">
          <Field label="Name">
            <Input value={title} onChangeText={setTitle} returnKeyType="done" />
          </Field>

          <Field label="Quelle">
            <SourcePicker value={source} folders={folders} onChange={setSource} />
          </Field>

          <Field label="Was wird ausgelost">
            <Segmented value={itemType} onChange={setItemType} options={TYPE_OPTIONS} />
            {poolSize !== undefined && (
              <Text className="text-sm text-muted-foreground">{plural(poolSize, 'Titel', 'Titel')} kommen in die Auslosung</Text>
            )}
          </Field>

          <View className="gap-4">
            <DateTimeField label="Start" value={start} onChange={setStart} />
            <DateTimeField label="Ende" value={end} onChange={setEnd} />
            <View className="flex-row flex-wrap gap-2">
              {DURATIONS.map(({ label, ms }) => (
                <Button key={label} size="sm" variant="secondary" onPress={() => setEnd(start + ms)}>
                  {label}
                </Button>
              ))}
            </View>
          </View>

          <Field label="Wer ist dabei">
            <View>
              <View className="absolute top-0 bottom-0 left-3 z-10 justify-center" pointerEvents="none">
                <Icon as={Search} color="mutedForeground" size={16} />
              </View>
              <Input value={search} onChangeText={setSearch} placeholder="Jellyfin Benutzer suchen" className="pl-9" autoCorrect={false} />
            </View>
            <ScrollView nestedScrollEnabled style={{ maxHeight: 288 }} className="rounded-xl border border-border" contentContainerClassName="gap-1 p-1">
              {users.isLoading && <Text className="p-3 text-sm text-muted-foreground">Lade Benutzer …</Text>}
              {users.isSuccess && visibleUsers.length === 0 && <Text className="p-3 text-sm text-muted-foreground">Niemand gefunden.</Text>}
              {visibleUsers.map((user) => (
                <UserRow
                  key={user.Id}
                  user={user}
                  image={userImageUrl(session, user)}
                  active={user.Id in invited}
                  onPress={() => toggle(user.Id, user.Name)}
                />
              ))}
            </ScrollView>
            <Text className="text-sm text-muted-foreground">
              {Object.keys(invited).length ? `Eingeladen: ${Object.values(invited).join(', ')}` : 'Du bist automatisch dabei.'}
            </Text>
          </Field>

          <Button size="lg" loading={saving} disabled={!title.trim()} onPress={submit}>
            Auslosung anlegen
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
