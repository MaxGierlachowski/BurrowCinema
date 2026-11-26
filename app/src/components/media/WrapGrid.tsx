import type { ReactNode } from 'react'
import { View } from 'react-native'
import { useGridColumns } from '@/components/PosterCard'

/** Non virtualised poster grid for short lists (search results). Same columns as PosterGrid. */
export function WrapGrid<T>({ data, keyExtractor, renderItem }: { data: T[]; keyExtractor: (item: T) => string; renderItem: (item: T) => ReactNode }) {
  const columns = useGridColumns()
  return (
    <View className="-mx-1.5 flex-row flex-wrap">
      {data.map((item) => (
        <View key={keyExtractor(item)} className="px-1.5 pb-4" style={{ width: `${100 / columns}%` }}>
          {renderItem(item)}
        </View>
      ))}
    </View>
  )
}
