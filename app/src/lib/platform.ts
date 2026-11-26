import { configurePlatform } from '@shared/platform'
import Storage from 'expo-sqlite/kv-store'
import { Platform } from 'react-native'
import { toast } from 'sonner-native'

// Must run before anything reads storage, so it is imported first in the root layout.
configurePlatform({
  storage: {
    getItem: (key) => Storage.getItemSync(key),
    setItem: (key, value) => Storage.setItemSync(key, value),
    removeItem: (key) => void Storage.removeItemSync(key),
  },
  deviceName: `BurrowCinema ${Platform.OS === 'ios' ? 'iOS' : 'Android'}`,
  notify: { success: (m) => toast.success(m), error: (m) => toast.error(m), warning: (m) => toast.warning(m) },
  // Native apps may talk to http servers in the home network.
  blocksInsecureRequests: false,
})
