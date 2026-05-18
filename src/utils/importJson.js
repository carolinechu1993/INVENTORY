import { bulkRestore, markBackupDone } from '../db/inventoryDB.js'

function base64ToBlob(base64, type = 'image/jpeg') {
  const parts = base64.split(',')
  const data = parts.length === 2 ? parts[1] : parts[0]
  const byteString = atob(data)
  const buffer = new ArrayBuffer(byteString.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < byteString.length; i++) {
    view[i] = byteString.charCodeAt(i)
  }
  return new Blob([buffer], { type })
}

export async function importFromJsonFile(file) {
  const text = await file.text()
  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error('檔案不是有效的 JSON')
  }
  if (payload?.schema !== 'inventory-backup') {
    throw new Error('檔案不是本 App 的備份格式')
  }
  const items = Array.isArray(payload.items) ? payload.items : []
  const wishlistRaw = Array.isArray(payload.wishlist) ? payload.wishlist : []
  const meta = Array.isArray(payload.meta) ? payload.meta : []

  const wishlist = wishlistRaw
    .filter((w) => w.purchased !== true)
    .map(({ purchased, purchasedAt, ...rest }) => rest)

  const restoredItems = items.map((item) => {
    const copy = { ...item }
    if (copy.imageBase64) {
      copy.imageBlob = base64ToBlob(copy.imageBase64, copy.imageType || 'image/jpeg')
      delete copy.imageBase64
      delete copy.imageType
    }
    return copy
  })

  await bulkRestore({ items: restoredItems, wishlist, metaEntries: meta })
  await markBackupDone()
  return { count: restoredItems.length, wishlistCount: wishlist.length }
}
