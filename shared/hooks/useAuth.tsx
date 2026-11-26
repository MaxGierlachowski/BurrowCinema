import { useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { logout as jellyfinLogout, type Session } from '../jellyfin'
import { onUnauthorized } from '../platform'
import { load, save } from '../storage'
import { clearSettings } from '../userSettings'

type AuthContext = {
  session: Session | null
  signIn: (session: Session) => void
  signOut: () => void
}

const SESSION_KEY = 'bc.session'
const Context = createContext<AuthContext | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState(() => load<Session | null>(SESSION_KEY, null))

  const update = (next: Session | null) => {
    save(SESSION_KEY, next)
    clearSettings()
    queryClient.clear()
    setSession(next)
  }

  const signOut = () => {
    if (session) jellyfinLogout(session)
    update(null)
  }

  useEffect(() => onUnauthorized(() => update(null)))

  return <Context.Provider value={{ session, signIn: update, signOut }}>{children}</Context.Provider>
}

export function useAuth() {
  const ctx = useContext(Context)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

/** For pages behind the login guard, where a session always exists. */
export function useSession() {
  const { session } = useAuth()
  if (!session) throw new Error('No active session')
  return session
}
