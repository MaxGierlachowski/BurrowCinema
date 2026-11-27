import Storage from 'expo-sqlite/kv-store'

// Custom entry: catch fatal JavaScript errors as early as possible. In a release build they would
// close the app without any hint; instead they are stored and shown on the next start.
const CRASH_KEY = 'bc.lastCrash'

const read = () => {
  try {
    return Storage.getItemSync(CRASH_KEY)
  } catch {
    return null
  }
}

const previousHandler = ErrorUtils.getGlobalHandler()
ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
  try {
    if (isFatal) Storage.setItemSync(CRASH_KEY, `${error?.message ?? error}\n\n${error?.stack ?? ''}`.slice(0, 6000))
  } catch {
    // Nothing more we can do.
  }
  previousHandler(error, isFatal)
})

const crash = read()
if (crash) {
  Storage.removeItemSync(CRASH_KEY)
  require('./src/CrashReport').showCrashReport(crash)
} else {
  require('expo-router/entry')
}
