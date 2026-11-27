import { authHeader, JellyfinError, sessionFromAuth, type Session } from './jellyfin'
import { emitUnauthorized, query } from './platform'
import { normalizeUrl } from './storage'

/** Quick Connect: the TV shows a code, a signed in device (phone or Jellyfin web) confirms it. */
export type QuickConnectCode = { code: string; secret: string }

/** Requests before sign in carry the client header without a token. */
async function call<T>(server: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(normalizeUrl(server) + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
  })
  if (res.status === 401) throw new JellyfinError(401, 'Quick Connect ist auf dem Server ausgeschaltet.')
  if (!res.ok) throw new JellyfinError(res.status, `Quick Connect fehlgeschlagen (${res.status})`)
  return res.json()
}

/** False when the server answers but has Quick Connect off; network errors are thrown. */
export async function quickConnectEnabled(server: string) {
  try {
    return (await call<boolean>(server, '/QuickConnect/Enabled')) === true
  } catch (error) {
    if (error instanceof JellyfinError) return false
    throw error
  }
}

export async function initiateQuickConnect(server: string): Promise<QuickConnectCode> {
  const data = await call<{ Code: string; Secret: string }>(server, '/QuickConnect/Initiate', { method: 'POST' })
  return { code: data.Code, secret: data.Secret }
}

export async function isQuickConnectAuthorized(server: string, secret: string) {
  const data = await call<{ Authenticated?: boolean }>(server, `/QuickConnect/Connect?${query({ secret })}`)
  return data.Authenticated === true
}

export async function loginWithQuickConnect(server: string, secret: string) {
  const data = await call<{ AccessToken: string; User: { Id: string; Name: string } }>(server, '/Users/AuthenticateWithQuickConnect', {
    method: 'POST',
    body: JSON.stringify({ Secret: secret }),
  })
  return sessionFromAuth(normalizeUrl(server), data)
}

/**
 * Confirms a code shown on another device for the signed in user. Not via request(): Jellyfin answers 401
 * when Quick Connect is off, and request() would sign the phone out for that.
 */
export async function authorizeQuickConnect(s: Session, code: string) {
  const res = await fetch(`${s.server}/QuickConnect/Authorize?${query({ code: code.trim(), userId: s.userId })}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader(s.token) },
  })
  if (res.ok) return
  if (res.status === 404) throw new Error('Code ungültig oder abgelaufen')
  if (res.status === 401) {
    if (!(await quickConnectEnabled(s.server))) throw new Error('Quick Connect ist auf dem Server ausgeschaltet.')
    emitUnauthorized()
    throw new JellyfinError(401, 'Sitzung abgelaufen, bitte neu anmelden')
  }
  throw new JellyfinError(res.status, `Quick Connect fehlgeschlagen (${res.status})`)
}
