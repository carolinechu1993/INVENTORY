import Dexie from 'dexie'
import {
  deleteItemFromCloud,
  deleteWishlistFromCloud,
  isCloudMode,
  isRemoteOrigin,
  pushItem,
  pushMeta,
  pushWishlistItem
} from '../firebase/sync.js'

export const db = new Dexie('InventoryDB')

db.version(1).stores({
  items: '++id, name, category, location, expiryDate, inUse, updatedAt',
  meta: 'key'
})

db.version(2).stores({
  items: '++id, name, category, location, expiryDate, inUse, updatedAt',
  meta: 'key',
  wishlist: '++id, name, category, priority, purchased, addedAt'
})

const OLD_V2_CATEGORIES = ['食品', '清潔用品', '化妝品', '保養品', '紙類', '零食', '飲品', '藥品', '其他']
const OLD_V2_LOCATIONS = ['廚房', '浴室', '客廳', '臥室', '儲藏室', '冰箱', '其他']
const OLD_V2_UNITS = ['瓶', '包', '個', '盒', '罐', '袋', '組', '張']

db.version(3)
  .stores({
    items: '++id, name, category, location, expiryDate, inUse, updatedAt',
    meta: 'key',
    wishlist: '++id, name, category, priority, purchased, addedAt'
  })
  .upgrade(async (tx) => {
    const meta = tx.table('meta')
    const resetIfStockDefault = async (key, oldDefault) => {
      const row = await meta.get(key)
      if (row && JSON.stringify(row.value) === JSON.stringify(oldDefault)) {
        await meta.delete(key)
      }
    }
    await resetIfStockDefault('categories', OLD_V2_CATEGORIES)
    await resetIfStockDefault('locations', OLD_V2_LOCATIONS)
    await resetIfStockDefault('units', OLD_V2_UNITS)
  })

db.version(4)
  .stores({
    items: '++id, name, category, location, expiryDate, inUse, updatedAt',
    meta: 'key',
    wishlist: '++id, name, category, priority, purchased, addedAt'
  })
  .upgrade(async (tx) => {
    await tx.table('meta').delete('locations')
  })

db.version(5)
  .stores({
    items: '++id, name, category, location, expiryDate, inUse, updatedAt',
    meta: 'key',
    wishlist: '++id, name, category, priority, addedAt'
  })
  .upgrade(async (tx) => {
    await tx.table('wishlist').filter((w) => w.purchased === true).delete()
  })

export const DEFAULT_CATEGORIES = [
  '廁所與清潔用品',
  '廚房用品與食品',
  '化妝品與保養品',
  '藥品與保健品',
  '其他'
]
export const DEFAULT_LOCATIONS = []
export const DEFAULT_UNITS = ['瓶', '包', '個', '袋']
export const DEFAULT_EXPIRY_WARN_DAYS = 7

export async function getMeta(key, fallback = null) {
  const row = await db.meta.get(key)
  return row ? row.value : fallback
}

export async function setMeta(key, value) {
  await db.meta.put({ key, value })
  if (isCloudMode() && !isRemoteOrigin('meta', key) && !LOCAL_ONLY_META_KEYS.has(key)) {
    pushMeta(key, value).catch((e) => console.warn('pushMeta failed', e))
  }
}

// 這些 meta key 只屬於本機（不應該同步到雲端）
const LOCAL_ONLY_META_KEYS = new Set([
  'currentHousehold',
  'lastBackupAt',
  'changesSinceBackup'
])

export async function getCategories() {
  return await getMeta('categories', DEFAULT_CATEGORIES)
}
export async function getLocations() {
  return await getMeta('locations', DEFAULT_LOCATIONS)
}
export async function getUnits() {
  return await getMeta('units', DEFAULT_UNITS)
}
export async function setCategories(list) {
  await setMeta('categories', list)
}
export async function setLocations(list) {
  await setMeta('locations', list)
}
export async function setUnits(list) {
  await setMeta('units', list)
}

export async function getExpiryWarnDays() {
  return await getMeta('expiryWarnDays', DEFAULT_EXPIRY_WARN_DAYS)
}
export async function setExpiryWarnDays(days) {
  await setMeta('expiryWarnDays', days)
}

export async function getReminderSettings() {
  return {
    expiry: await getMeta('remindExpiry', true),
    zeroStock: await getMeta('remindZeroStock', true),
    backup: await getMeta('remindBackup', true)
  }
}
export async function setReminderSetting(key, value) {
  const map = {
    expiry: 'remindExpiry',
    zeroStock: 'remindZeroStock',
    backup: 'remindBackup'
  }
  if (!map[key]) throw new Error('unknown reminder key')
  await setMeta(map[key], value)
}

export async function getBrowserNotifyEnabled() {
  return await getMeta('browserNotifyEnabled', false)
}
export async function setBrowserNotifyEnabled(enabled) {
  await setMeta('browserNotifyEnabled', enabled)
}

async function bumpChangeCounter() {
  const current = await getMeta('changesSinceBackup', 0)
  await setMeta('changesSinceBackup', current + 1)
}

async function ensureInList(metaKey, defaultList, value) {
  const trimmed = (value || '').trim()
  if (!trimmed) return
  const list = await getMeta(metaKey, defaultList)
  if (list.includes(trimmed)) return
  await setMeta(metaKey, [...list, trimmed])
}

export async function ensureCategory(value) {
  await ensureInList('categories', DEFAULT_CATEGORIES, value)
}
export async function ensureLocation(value) {
  await ensureInList('locations', DEFAULT_LOCATIONS, value)
}
export async function ensureUnit(value) {
  await ensureInList('units', DEFAULT_UNITS, value)
}

export async function addItem(item) {
  const now = Date.now()
  const payload = { ...item, createdAt: now, updatedAt: now }
  const id = await db.items.add(payload)
  await ensureCategory(item.category)
  await ensureLocation(item.location)
  await ensureUnit(item.unit)
  await bumpChangeCounter()
  if (isCloudMode() && !isRemoteOrigin('items', id)) {
    pushItem(id, { ...payload, id }).catch((e) => console.warn('pushItem failed', e))
  }
  return id
}

export async function updateItem(id, patch) {
  const merged = { ...patch, updatedAt: Date.now() }
  await db.items.update(id, merged)
  if (patch.category !== undefined) await ensureCategory(patch.category)
  if (patch.location !== undefined) await ensureLocation(patch.location)
  if (patch.unit !== undefined) await ensureUnit(patch.unit)
  await bumpChangeCounter()
  if (isCloudMode() && !isRemoteOrigin('items', id)) {
    const fresh = await db.items.get(id)
    if (fresh) pushItem(id, fresh).catch((e) => console.warn('pushItem failed', e))
  }
}

export async function deleteItem(id) {
  await db.items.delete(id)
  await bumpChangeCounter()
  if (isCloudMode() && !isRemoteOrigin('items', id)) {
    deleteItemFromCloud(id).catch((e) => console.warn('deleteItemFromCloud failed', e))
  }
}

export async function getItem(id) {
  return await db.items.get(Number(id))
}

export async function getAllItems() {
  return await db.items.orderBy('updatedAt').reverse().toArray()
}

export async function addWishlistItem(item) {
  const now = Date.now()
  const payload = {
    name: item.name,
    category: item.category || '',
    quantity: item.quantity || 1,
    unit: item.unit || '',
    priority: item.priority || 'normal',
    notes: item.notes || '',
    addedAt: now,
    updatedAt: now
  }
  const id = await db.wishlist.add(payload)
  await ensureCategory(item.category)
  await ensureUnit(item.unit)
  await bumpChangeCounter()
  if (isCloudMode() && !isRemoteOrigin('wishlist', id)) {
    pushWishlistItem(id, { ...payload, id }).catch((e) => console.warn('pushWishlistItem failed', e))
  }
  return id
}

export async function updateWishlistItem(id, patch) {
  const merged = { ...patch, updatedAt: Date.now() }
  await db.wishlist.update(id, merged)
  await bumpChangeCounter()
  if (isCloudMode() && !isRemoteOrigin('wishlist', id)) {
    const fresh = await db.wishlist.get(id)
    if (fresh) pushWishlistItem(id, fresh).catch((e) => console.warn('pushWishlistItem failed', e))
  }
}

export async function deleteWishlistItem(id) {
  await db.wishlist.delete(id)
  await bumpChangeCounter()
  if (isCloudMode() && !isRemoteOrigin('wishlist', id)) {
    deleteWishlistFromCloud(id).catch((e) => console.warn('deleteWishlistFromCloud failed', e))
  }
}

export async function markBackupDone() {
  await setMeta('lastBackupAt', Date.now())
  await setMeta('changesSinceBackup', 0)
}

export async function getBackupStatus() {
  const lastBackupAt = await getMeta('lastBackupAt', null)
  const changesSinceBackup = await getMeta('changesSinceBackup', 0)
  const itemCount = await db.items.count()
  return { lastBackupAt, changesSinceBackup, itemCount }
}

export async function clearAllData() {
  await db.items.clear()
  await db.wishlist.clear()
  await db.meta.clear()
}

export async function bulkRestore({ items = [], wishlist = [], metaEntries = [] }) {
  await db.transaction('rw', db.items, db.wishlist, db.meta, async () => {
    await db.items.clear()
    await db.wishlist.clear()
    await db.meta.clear()
    if (items.length) await db.items.bulkAdd(items)
    if (wishlist.length) await db.wishlist.bulkAdd(wishlist)
    for (const entry of metaEntries) {
      await db.meta.put(entry)
    }
  })
}
