import { File, Paths } from 'expo-file-system'
import Storage from 'expo-sqlite/kv-store'

// Custom entry: show the last crash instead of the app when there was one. A native handler
// (plugins/withCrashLog.js) writes every crash to a file; fatal JavaScript errors are stored here too.
const CRASH_KEY = 'bc.lastCrash'

function takeLastCrash() {
  try {
    const file = new File(Paths.document, 'last-crash.txt')
    if (file.exists) {
      const text = file.textSync()
      file.delete()
      return text
    }
  } catch {
    // ignore, try the JavaScript copy
  }
  try {
    const text = Storage.getItemSync(CRASH_KEY)
    if (text) Storage.removeItemSync(CRASH_KEY)
    return text
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

const crash = takeLastCrash()
if (crash) require('./src/CrashReport').showCrashReport(crash)
else require('expo-router/entry')
