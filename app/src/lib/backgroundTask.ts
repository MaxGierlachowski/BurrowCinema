import '@/lib/platform'

import * as BackgroundTask from 'expo-background-task'
import * as TaskManager from 'expo-task-manager'
import { useEffect } from 'react'
import { getDrawServer, listDraws } from '@shared/draws'
import type { Session } from '@shared/jellyfin'
import { load } from '@shared/storage'
import { syncSettings } from '@shared/userSettings'
import { notifyInvitation, scheduleDrawReminders, takeNewInvitations, useNotificationTaps } from './notifications'

const TASK = 'burrowcinema-draws'

/**
 * Runs every now and then while the app is closed: looks for new invitations and keeps the
 * start and end reminders in sync. Defined at module level so it also exists in a headless start.
 */
TaskManager.defineTask(TASK, async () => {
  try {
    const session = load<Session | null>('bc.session', null)
    if (!session) return BackgroundTask.BackgroundTaskResult.Success
    await syncSettings(session)
    if (!getDrawServer()) return BackgroundTask.BackgroundTaskResult.Success
    const draws = await listDraws(session)
    for (const draw of takeNewInvitations(session.userId, draws)) await notifyInvitation(draw)
    await scheduleDrawReminders(draws)
    return BackgroundTask.BackgroundTaskResult.Success
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed
  }
})

/** Registers the periodic check; safe to call repeatedly. The task itself does nothing without a session. */
export async function registerBackgroundCheck() {
  try {
    if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return
    if (await TaskManager.isTaskRegisteredAsync(TASK)) return
    await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 30 })
  } catch {
    // Background checks are a bonus; the app works without them.
  }
}

/** For the root layout: once signed in, register the background check and open tapped notifications. */
export function useDrawNotifications(signedIn: boolean) {
  useEffect(() => {
    if (signedIn) registerBackgroundCheck()
  }, [signedIn])
  useNotificationTaps(signedIn)
}
