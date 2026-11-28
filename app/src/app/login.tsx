import { Eye, EyeOff } from 'lucide-react-native'
import { useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useAuth } from '@shared/hooks/useAuth'
import { login, type Session } from '@shared/jellyfin'
import { load, save } from '@shared/storage'
import { colors } from '@shared/theme'
import { Logo, PeekingEars } from '@/components/BurrowMark'
import { errorText, QuickConnectPanel } from '@/components/login/QuickConnectPanel'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Input, type InputRef } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Text } from '@/components/ui/text'
import { features } from '@/lib/features'
import { haptic } from '@/lib/haptics'

export default function Login() {
  const { signIn } = useAuth()
  const [server, setServer] = useState(() => load('bc.lastServer', ''))
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [quickConnect, setQuickConnect] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const usernameRef = useRef<InputRef>(null)
  const passwordRef = useRef<InputRef>(null)

  const finish = (session: Session) => {
    save('bc.lastServer', session.server)
    haptic.success()
    signIn(session)
  }

  const submit = async () => {
    setError('')
    setLoading(true)
    try {
      finish(await login(server, username, password))
    } catch (err) {
      haptic.error()
      setError(errorText(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="flex-1 bg-background">
      <LinearGradient
        colors={[`${colors.primary}33`, `${colors.primary}0d`, 'transparent']}
        locations={[0, 0.35, 0.7]}
        style={{ position: 'absolute', inset: 0 }}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView contentContainerClassName="flex-grow justify-center px-4 py-16" keyboardShouldPersistTaps="handled">
          <View className="mx-auto w-full max-w-sm gap-14">
            <View className="items-center">
              <Logo />
            </View>
            <View>
              <View className="absolute -top-12 right-10">
                <PeekingEars />
              </View>
              {quickConnect ? (
                <QuickConnectPanel server={server} onSignedIn={finish} onCancel={() => setQuickConnect(false)} />
              ) : (
                <Card>
                  <CardTitle>Anmelden</CardTitle>
                  <CardDescription>Mit deinem Jellyfin Account</CardDescription>
                  <View>
                    <Label>Server</Label>
                    <Input
                      value={server}
                      onChangeText={setServer}
                      placeholder="jellyfin.example.com oder 192.168.1.10:8096"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      returnKeyType="next"
                      submitBehavior="submit"
                      onSubmitEditing={() => usernameRef.current?.focus()}
                    />
                  </View>
                  <View>
                    <Label>Benutzername</Label>
                    <Input
                      ref={usernameRef}
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="username"
                      textContentType="username"
                      returnKeyType="next"
                      submitBehavior="submit"
                      onSubmitEditing={() => passwordRef.current?.focus()}
                    />
                  </View>
                  <View>
                    <Label>Passwort</Label>
                    <View className="justify-center">
                      <Input
                        ref={passwordRef}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="current-password"
                        textContentType="password"
                        returnKeyType="go"
                        onSubmitEditing={submit}
                        className="pr-12"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        icon={showPassword ? EyeOff : Eye}
                        accessibilityLabel={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                        onPress={() => setShowPassword((show) => !show)}
                        className="absolute right-0.5"
                      />
                    </View>
                  </View>
                  {!!error && <Text className="text-sm text-destructive">{error}</Text>}
                  {features.quickConnect && (
                    <Button variant="outline" size="lg" disabled={!server} onPress={() => setQuickConnect(true)}>
                      Mit Quick Connect anmelden
                    </Button>
                  )}
                  <Button size="lg" loading={loading} disabled={!server || !username} onPress={submit}>
                    Anmelden
                  </Button>
                </Card>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}
