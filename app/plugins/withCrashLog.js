const { withMainApplication } = require('expo/config-plugins')

// Writes every uncaught crash (native, or a fatal JavaScript error that React Native rethrows natively)
// to files/last-crash.txt, so the app can show it on the next start. Released builds otherwise close silently.
const HANDLER = `
    // BurrowCinema crash log
    val previousCrashHandler = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { thread, error ->
      try {
        java.io.File(filesDir, "last-crash.txt").writeText(android.util.Log.getStackTraceString(error).take(12000))
      } catch (_: Throwable) {
      }
      previousCrashHandler?.uncaughtException(thread, error)
    }
`

module.exports = function withCrashLog(config) {
  return withMainApplication(config, (mod) => {
    const source = mod.modResults.contents
    if (source.includes('BurrowCinema crash log')) return mod
    const anchor = 'super.onCreate()'
    if (!source.includes(anchor)) throw new Error('withCrashLog: super.onCreate() not found in MainApplication')
    mod.modResults.contents = source.replace(anchor, anchor + '\n' + HANDLER)
    return mod
  })
}
