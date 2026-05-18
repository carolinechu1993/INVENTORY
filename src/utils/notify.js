import {
  db,
  getBrowserNotifyEnabled,
  getExpiryWarnDays,
  getReminderSettings,
  setBrowserNotifyEnabled
} from '../db/inventoryDB.js'
import { daysUntil } from './format.js'

const LAST_NOTIFY_KEY = 'lastReminderNotifyDate'

export function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return await Notification.requestPermission()
}

export async function enableBrowserNotifications() {
  const perm = await requestNotificationPermission()
  if (perm !== 'granted') {
    await setBrowserNotifyEnabled(false)
    return perm
  }
  await setBrowserNotifyEnabled(true)
  return 'granted'
}

export async function disableBrowserNotifications() {
  await setBrowserNotifyEnabled(false)
}

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export async function maybeShowReminderNotification() {
  if (!isNotificationSupported()) return
  if (!(await getBrowserNotifyEnabled())) return
  if (Notification.permission !== 'granted') return

  const todays = todayKey()
  const last = localStorage.getItem(LAST_NOTIFY_KEY)
  if (last === todays) return

  const settings = await getReminderSettings()
  const warnDays = await getExpiryWarnDays()
  const items = await db.items.toArray()

  const messages = []

  if (settings.expiry) {
    const flagged = items.filter((i) => {
      const d = daysUntil(i.expiryDate)
      return d !== null && d <= warnDays
    })
    if (flagged.length) {
      const names = flagged.slice(0, 3).map((i) => i.name).join('、')
      messages.push(`${flagged.length} 項即將/已過期：${names}${flagged.length > 3 ? '…' : ''}`)
    }
  }

  if (settings.zeroStock) {
    const empty = items.filter((i) => (i.quantity ?? 0) === 0)
    if (empty.length) {
      const names = empty.slice(0, 3).map((i) => i.name).join('、')
      messages.push(`${empty.length} 項已用完：${names}${empty.length > 3 ? '…' : ''}`)
    }
  }

  if (messages.length === 0) return

  try {
    new Notification('庫存提醒', {
      body: messages.join('\n'),
      icon: './icons/icon.svg',
      tag: 'inventory-reminder'
    })
    localStorage.setItem(LAST_NOTIFY_KEY, todays)
  } catch (e) {
    console.warn('Notification failed', e)
  }
}
