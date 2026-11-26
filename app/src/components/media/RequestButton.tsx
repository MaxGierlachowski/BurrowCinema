import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Download } from 'lucide-react-native'
import { useState } from 'react'
import { View } from 'react-native'
import { toast } from 'sonner-native'
import { ARR_LABEL, getRequestOptions, requestArr, type ArrItem, type RequestOptions } from '@shared/arr'
import { getSettings, updateSettings } from '@shared/userSettings'
import { OptionList } from '@/components/media/OptionList'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { haptic } from '@/lib/haptics'

const formatSpace = (bytes?: number) => (bytes ? `${(bytes / 1024 ** 4).toFixed(1)} TB frei` : undefined)

export function RequestButton({ item }: { item: ArrItem }) {
  const kind = item.source
  const label = ARR_LABEL[kind]
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [profile, setProfile] = useState<string>()
  const [folder, setFolder] = useState<string>()

  const options = useQuery({ queryKey: ['arr-options', kind], queryFn: () => getRequestOptions(kind), enabled: open })
  const profiles = options.data?.profiles ?? []
  const folders = options.data?.folders ?? []

  // Preselect what was used last time, otherwise the first entry.
  const last: Partial<RequestOptions> = getSettings().lastRequest?.[kind] ?? {}
  const profileId = profile ?? String((profiles.find((p) => p.id === last.qualityProfileId) ?? profiles[0])?.id ?? '')
  const folderPath = folder ?? (folders.find((f) => f.path === last.rootFolderPath) ?? folders[0])?.path ?? ''

  const request = useMutation({
    mutationFn: () => {
      const chosen = { qualityProfileId: Number(profileId), rootFolderPath: folderPath }
      updateSettings({ lastRequest: { ...getSettings().lastRequest, [kind]: chosen } }).catch(() => undefined)
      return requestArr(kind, item.id, chosen)
    },
    onSuccess: () => {
      haptic.success()
      toast.success(`${item.title} wurde in ${label} angefragt`)
      setOpen(false)
      queryClient.invalidateQueries({ queryKey: ['arr-item', kind, item.id] })
      queryClient.invalidateQueries({ queryKey: ['arr-search', kind] })
    },
    onError: (err) => {
      haptic.error()
      toast.error(`${label}: ${err.message}`)
    },
  })

  if (item.inArr) {
    return (
      <Button size="lg" variant="secondary" icon={Check} disabled>
        Bereits angefragt
      </Button>
    )
  }

  return (
    <>
      <Button size="lg" icon={Download} onPress={() => setOpen(true)}>
        Anfragen
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={`${kind === 'radarr' ? 'Film' : 'Serie'} anfragen`}
        description={`${item.title} wird in ${label} hinzugefügt und sofort gesucht.`}
        footer={
          <Button
            size="lg"
            className="w-full"
            icon={Download}
            haptics={false}
            loading={request.isPending}
            disabled={!profileId || !folderPath}
            onPress={() => request.mutate()}
          >
            Jetzt anfragen
          </Button>
        }
      >
        <View className="gap-5">
          {options.isLoading && <Skeleton className="h-40 rounded-lg" />}
          {options.isError && <Text className="text-sm text-destructive">{options.error.message}</Text>}
          {profiles.length > 0 && (
            <OptionList
              title="Qualitätsprofil"
              value={profileId}
              onChange={setProfile}
              options={profiles.map((p) => ({ value: String(p.id), label: p.name }))}
            />
          )}
          {folders.length > 1 && (
            <OptionList
              title="Speicherort"
              value={folderPath}
              onChange={setFolder}
              options={folders.map((f) => ({ value: f.path, label: f.path, hint: formatSpace(f.freeSpace) }))}
            />
          )}
        </View>
      </Sheet>
    </>
  )
}
