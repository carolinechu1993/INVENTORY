import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { isFirebaseReady, subscribeAuth, consumeRedirectResult } from '../firebase/auth.js'
import { getHouseholdsForCurrentUser } from '../firebase/household.js'
import {
  setActiveHousehold,
  startCloudListeners,
  stopCloudListeners
} from '../firebase/sync.js'
import { getMeta, setMeta } from '../db/inventoryDB.js'

const SyncContext = createContext({
  ready: false,
  user: null,
  household: null,
  syncStatus: 'idle',
  online: true
})

const HOUSEHOLD_META_KEY = 'currentHousehold'

export function SyncProvider({ children }) {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState(null)
  const [household, setHousehold] = useState(null)
  const [syncStatus, setSyncStatus] = useState('idle') // idle | syncing | error
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    if (!isFirebaseReady()) {
      setReady(true)
      return
    }
    consumeRedirectResult().catch(() => {})

    const unsub = subscribeAuth(async (u) => {
      setUser(u || null)
      if (!u) {
        setHousehold(null)
        setActiveHousehold(null)
        stopCloudListeners()
        setReady(true)
        return
      }
      try {
        // 1. 從本地 meta 找之前記得的 household
        const savedId = await getMeta(HOUSEHOLD_META_KEY, null)
        // 2. 從 Firestore 查目前這個 user 是哪些 household 的成員
        const hh = await getHouseholdsForCurrentUser()
        let active = null
        if (savedId) {
          active = hh.find((h) => h.householdId === savedId) || null
        }
        if (!active && hh.length === 1) {
          active = hh[0]
        }
        if (active) {
          setHousehold(active)
          setActiveHousehold(active.householdId)
          await setMeta(HOUSEHOLD_META_KEY, active.householdId)
          setSyncStatus('syncing')
          startCloudListeners()
          setTimeout(() => setSyncStatus('idle'), 2000)
        } else {
          setHousehold(null)
          setActiveHousehold(null)
          stopCloudListeners()
        }
      } catch (e) {
        console.error('sync init failed', e)
        setSyncStatus('error')
      } finally {
        setReady(true)
      }
    })
    return () => {
      unsub?.()
      stopCloudListeners()
    }
  }, [])

  const setActiveHouseholdFromUI = useCallback(async (hh) => {
    if (hh) {
      setHousehold(hh)
      setActiveHousehold(hh.householdId)
      await setMeta(HOUSEHOLD_META_KEY, hh.householdId)
      setSyncStatus('syncing')
      startCloudListeners()
      setTimeout(() => setSyncStatus('idle'), 2000)
    } else {
      setHousehold(null)
      setActiveHousehold(null)
      await setMeta(HOUSEHOLD_META_KEY, null)
      stopCloudListeners()
    }
  }, [])

  const value = useMemo(
    () => ({
      ready,
      user,
      household,
      syncStatus,
      online,
      cloudMode: !!household,
      firebaseReady: isFirebaseReady(),
      setActiveHouseholdFromUI
    }),
    [ready, user, household, syncStatus, online, setActiveHouseholdFromUI]
  )

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

export function useSync() {
  return useContext(SyncContext)
}
