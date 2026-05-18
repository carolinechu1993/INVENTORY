import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch
} from 'firebase/firestore'
import { firestore } from './config.js'
import { getCurrentUser } from './auth.js'
import { base64ToBlob, blobToBase64 } from './images.js'
import { db } from '../db/inventoryDB.js'

let activeHouseholdId = null
let unsubItems = null
let unsubWishlist = null
let unsubMeta = null
const remoteOriginIds = new Set()

export function setActiveHousehold(householdId) {
  activeHouseholdId = householdId
}

export function getActiveHousehold() {
  return activeHouseholdId
}

export function isCloudMode() {
  return activeHouseholdId !== null
}

function markRemoteOrigin(table, id) {
  remoteOriginIds.add(`${table}:${id}`)
  setTimeout(() => remoteOriginIds.delete(`${table}:${id}`), 1500)
}

export function isRemoteOrigin(table, id) {
  return remoteOriginIds.has(`${table}:${id}`)
}

function itemsCol() {
  return collection(firestore, 'households', activeHouseholdId, 'items')
}
function wishlistCol() {
  return collection(firestore, 'households', activeHouseholdId, 'wishlist')
}
function metaCol() {
  return collection(firestore, 'households', activeHouseholdId, 'meta')
}

async function serializeItemForCloud(item) {
  const out = {
    name: item.name || '',
    category: item.category || '',
    quantity: item.quantity ?? 0,
    unit: item.unit || '',
    location: item.location || '',
    expiryDate: item.expiryDate || null,
    notes: item.notes || '',
    createdAt: item.createdAt || Date.now(),
    updatedAt: item.updatedAt || Date.now(),
    updatedBy: getCurrentUser()?.uid || null,
    imageBase64: null
  }
  if (item.imageBlob instanceof Blob) {
    out.imageBase64 = await blobToBase64(item.imageBlob)
  }
  return out
}

function deserializeItemFromCloud(data) {
  const copy = { ...data }
  if (copy.imageBase64) {
    copy.imageBlob = base64ToBlob(copy.imageBase64)
  } else {
    copy.imageBlob = null
  }
  delete copy.imageBase64
  delete copy.updatedBy
  return copy
}

export async function pushItem(itemId, item) {
  if (!isCloudMode()) return
  const payload = await serializeItemForCloud(item)
  await setDoc(doc(itemsCol(), String(itemId)), payload, { merge: true })
}

export async function pushWishlistItem(id, item) {
  if (!isCloudMode()) return
  const payload = {
    name: item.name || '',
    category: item.category || '',
    quantity: item.quantity ?? 1,
    unit: item.unit || '',
    priority: item.priority || 'normal',
    notes: item.notes || '',
    addedAt: item.addedAt || Date.now(),
    updatedAt: Date.now(),
    updatedBy: getCurrentUser()?.uid || null
  }
  await setDoc(doc(wishlistCol(), String(id)), payload, { merge: true })
}

export async function deleteItemFromCloud(itemId) {
  if (!isCloudMode()) return
  await deleteDoc(doc(itemsCol(), String(itemId)))
}

export async function deleteWishlistFromCloud(id) {
  if (!isCloudMode()) return
  await deleteDoc(doc(wishlistCol(), String(id)))
}

export async function pushMeta(key, value) {
  if (!isCloudMode()) return
  await setDoc(doc(metaCol(), key), {
    value,
    updatedAt: serverTimestamp()
  })
}

export async function uploadEntireLocalDb() {
  if (!isCloudMode()) return
  const items = await db.items.toArray()
  const wishlist = await db.wishlist.toArray()
  const meta = await db.meta.toArray()

  const batch1 = writeBatch(firestore)
  for (const it of items) {
    const payload = await serializeItemForCloud(it)
    batch1.set(doc(itemsCol(), String(it.id)), payload)
  }
  await batch1.commit()

  const batch2 = writeBatch(firestore)
  for (const w of wishlist) {
    batch2.set(doc(wishlistCol(), String(w.id)), {
      name: w.name || '',
      category: w.category || '',
      quantity: w.quantity ?? 1,
      unit: w.unit || '',
      priority: w.priority || 'normal',
      notes: w.notes || '',
      addedAt: w.addedAt || Date.now(),
      updatedAt: Date.now(),
      updatedBy: getCurrentUser()?.uid || null
    })
  }
  for (const m of meta) {
    batch2.set(doc(metaCol(), m.key), { value: m.value, updatedAt: serverTimestamp() })
  }
  await batch2.commit()
}

export async function replaceLocalWithCloud() {
  if (!isCloudMode()) return
  // 拉一次完整 snapshot 蓋掉本地
  await db.items.clear()
  await db.wishlist.clear()
  // meta 保留使用者的提醒設定，但 categories/locations/units 用雲端的
  // 為簡化先全清，由後續監聽器自動補回
  await db.meta.clear()
}

export function startCloudListeners() {
  stopCloudListeners()
  if (!isCloudMode()) return

  unsubItems = onSnapshot(itemsCol(), (snap) => {
    snap.docChanges().forEach((change) => {
      const idStr = change.doc.id
      const numericId = Number(idStr)
      const id = Number.isNaN(numericId) ? idStr : numericId
      if (change.type === 'removed') {
        markRemoteOrigin('items', id)
        db.items.delete(id).catch(console.warn)
      } else {
        const data = deserializeItemFromCloud(change.doc.data())
        markRemoteOrigin('items', id)
        db.items.put({ ...data, id }).catch(console.warn)
      }
    })
  })

  unsubWishlist = onSnapshot(wishlistCol(), (snap) => {
    snap.docChanges().forEach((change) => {
      const idStr = change.doc.id
      const numericId = Number(idStr)
      const id = Number.isNaN(numericId) ? idStr : numericId
      if (change.type === 'removed') {
        markRemoteOrigin('wishlist', id)
        db.wishlist.delete(id).catch(console.warn)
      } else {
        const data = change.doc.data()
        markRemoteOrigin('wishlist', id)
        db.wishlist.put({ ...data, id }).catch(console.warn)
      }
    })
  })

  unsubMeta = onSnapshot(metaCol(), (snap) => {
    snap.docChanges().forEach((change) => {
      const key = change.doc.id
      if (change.type === 'removed') {
        markRemoteOrigin('meta', key)
        db.meta.delete(key).catch(console.warn)
      } else {
        const data = change.doc.data()
        markRemoteOrigin('meta', key)
        db.meta.put({ key, value: data.value }).catch(console.warn)
      }
    })
  })
}

export function stopCloudListeners() {
  if (unsubItems) { unsubItems(); unsubItems = null }
  if (unsubWishlist) { unsubWishlist(); unsubWishlist = null }
  if (unsubMeta) { unsubMeta(); unsubMeta = null }
}
