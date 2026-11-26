import * as Notifications from 'expo-notifications'
import { router, type Href } from 'expo-router'
import { useEffect } from 'react'
import { Platform } from 'react-native'
import type { DrawSummary } from '@shared/draws'
import { load, save } from '@shared/storage'

const CHANNEL = 'draws'
const ASKED_KEY = 'bc.notifications.asked'
const seenKey = (userId: string) => `bc.draws.seen.${userId}`
const startId = (id: string) => `draw-start-${id}`
const endId = (id: string) => `draw-end-${id}`

// Also show notifications while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
})

/** Android 13+ only shows the permission prompt once a channel exists. */
export async function ensureChannel() {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Auslosungen',
    description: 'Einladungen, Start und Ende von Auslosungen',
    importance: Notifications.AndroidImportance.HIGH,
  })
}

export const getPermission = () => Notifications.getPermissionsAsync()

export async function requestPermission() {
  await ensureChannel()
  save(ASKED_KEY, true)
  return Notifications.requestPermissionsAsync()
}

/** Asks once, the first time the Auslosung tab is opened. Returns whether notifications are allowed. */
export async function askOnce() {
  await ensureChannel()
  const current = await getPermission()
  if (current.granted || load(ASKED_KEY, false) || !current.canAskAgain) return current.granted
  return (await requestPermission()).granted
}

const urlData = (id: string) => ({ url: `/draws/${id}` })

async function scheduleAt(identifier: string, date: number, title: string, body: string, id: string) {
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: { title, body, data: urlData(id) },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL },
  })
}

/**
 * Local reminders for start and end of every draw the user takes part in. Identifiers are stable per draw,
 * so calling this again replaces them; reminders of draws that are gone or ended are cancelled.
 */
export async function scheduleDrawReminders(draws: DrawSummary[]) {
  if (!(await getPermission()).granted) return
  const now = Date.now()
  const wanted = new Set<string>()
  for (const draw of draws) {
    if (draw.status === 'scheduled' && draw.startsAt > now) {
      wanted.add(startId(draw.id))
      await scheduleAt(startId(draw.id), draw.startsAt, `Auslosung startet: ${draw.title}`, 'Jetzt swipen und mitentscheiden', draw.id)
    }
    if (draw.status !== 'ended' && draw.endsAt > now) {
      wanted.add(endId(draw.id))
      await scheduleAt(endId(draw.id), draw.endsAt, draw.title, 'Auslosung beendet: Ergebnis ansehen', draw.id)
    }
  }
  const scheduled = await Notifications.getAllScheduledNotificationsAsync()
  await Promise.all(
    scheduled
      .filter((n) => /^draw-(start|end)-/.test(n.identifier) && !wanted.has(n.identifier))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  )
}

/** Draws the user was invited to and has not seen yet. On the very first check everything counts as seen. */
export function takeNewInvitations(userId: string, draws: DrawSummary[]) {
  const seen = load<string[] | null>(seenKey(userId), null)
  save(seenKey(userId), draws.map((d) => d.id))
  if (!seen) return []
  return draws.filter((d) => !d.isOwner && d.status !== 'ended' && !seen.includes(d.id))
}

export async function notifyInvitation(draw: DrawSummary) {
  await Notifications.scheduleNotificationAsync({
    identifier: `draw-invite-${draw.id}`,
    content: { title: `Neue Auslosung von ${draw.owner.name}: ${draw.title}`, body: 'Jetzt swipen und mitentscheiden', data: urlData(draw.id) },
    trigger: { channelId: CHANNEL },
  })
}

/** Called whenever the app fetched the draw list: the user sees the list, so nothing in it is a new invitation. */
export function onDrawsFetched(userId: string, draws: DrawSummary[]) {
  takeNewInvitations(userId, draws)
  scheduleDrawReminders(draws).catch(() => undefined)
}

/** Opens the draw a tapped notification belongs to, also when the tap launched the app. */
export function useNotificationTaps(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const open = (response: Notifications.NotificationResponse | null) => {
      const url = response?.notification.request.content.data?.url
      if (typeof url !== 'string') return
      Notifications.clearLastNotificationResponse()
      router.push(url as Href)
    }
    open(Notifications.getLastNotificationResponse())
    const subscription = Notifications.addNotificationResponseReceivedListener(open)
    return () => subscription.remove()
  }, [enabled])
}
