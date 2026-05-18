import { db, markBackupDone } from '../db/inventoryDB.js'

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function exportToJsonFile() {
  const items = await db.items.toArray()
  const wishlist = await db.wishlist.toArray()
  const meta = await db.meta.toArray()

  const serializedItems = []
  for (const item of items) {
    const copy = { ...item }
    if (item.imageBlob instanceof Blob) {
      copy.imageBase64 = await blobToBase64(item.imageBlob)
      copy.imageType = item.imageBlob.type
      delete copy.imageBlob
    }
    serializedItems.push(copy)
  }

  const payload = {
    schema: 'inventory-backup',
    version: 2,
    exportedAt: new Date().toISOString(),
    items: serializedItems,
    wishlist,
    meta
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  a.href = url
  a.download = `inventory-backup-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  await markBackupDone()
  return { count: items.length, wishlistCount: wishlist.length }
}
