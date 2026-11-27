import { registerRootComponent } from 'expo'
import { Pressable, ScrollView, Share, Text, View } from 'react-native'

const colors = { background: '#110d0a', card: '#1b1612', text: '#f6f1e9', muted: '#a9a094', primary: '#f3bd5c', primaryText: '#271a09' }

/** Plain React Native only, so it still works when the regular app code is what crashed. */
function CrashReport({ text }: { text: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: 64, paddingHorizontal: 20, paddingBottom: 32, gap: 16 }}>
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>Die App ist abgestürzt</Text>
      <Text style={{ color: colors.muted, fontSize: 15 }}>
        Bitte schick diesen Bericht weiter. Beim nächsten Start versucht die App es normal.
      </Text>
      <ScrollView style={{ flex: 1, backgroundColor: colors.card, borderRadius: 12 }} contentContainerStyle={{ padding: 12 }}>
        <Text selectable style={{ color: colors.text, fontFamily: 'monospace', fontSize: 12 }}>
          {text}
        </Text>
      </ScrollView>
      <Pressable
        onPress={() => Share.share({ message: text })}
        style={{ backgroundColor: colors.primary, borderRadius: 12, height: 48, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: colors.primaryText, fontSize: 16, fontWeight: '600' }}>Bericht teilen</Text>
      </Pressable>
    </View>
  )
}

export function showCrashReport(text: string) {
  registerRootComponent(() => <CrashReport text={text} />)
}
