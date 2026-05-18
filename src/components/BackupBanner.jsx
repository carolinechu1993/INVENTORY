import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getMeta, getReminderSettings } from '../db/inventoryDB.js'

const DAYS_THRESHOLD = 7
const CHANGES_THRESHOLD = 20

export default function BackupBanner() {
  const [dismissed, setDismissed] = useState(false)
  const [status, setStatus] = useState({ lastBackupAt: null, changesSinceBackup: 0 })

  const itemCount = useLiveQuery(() => db.items.count(), [], 0)
  const refreshKey = useLiveQuery(() => db.meta.toArray(), [], null)
  const reminderOn = useLiveQuery(async () => (await getReminderSettings()).backup, [], true)

  useEffect(() => {
    (async () => {
      const lastBackupAt = await getMeta('lastBackupAt', null)
      const changesSinceBackup = await getMeta('changesSinceBackup', 0)
      setStatus({ lastBackupAt, changesSinceBackup })
    })()
  }, [refreshKey, itemCount])

  if (!reminderOn || dismissed || itemCount === 0) return null

  const now = Date.now()
  const daysSince = status.lastBackupAt
    ? Math.floor((now - status.lastBackupAt) / (1000 * 60 * 60 * 24))
    : null

  const needBackup =
    status.lastBackupAt === null ||
    status.changesSinceBackup >= CHANGES_THRESHOLD ||
    (daysSince !== null && daysSince >= DAYS_THRESHOLD)

  if (!needBackup) return null

  let message
  if (status.lastBackupAt === null) {
    message = `已有 ${itemCount} 筆資料，建議先匯出備份`
  } else if (daysSince !== null && daysSince >= DAYS_THRESHOLD) {
    message = `已 ${daysSince} 天未備份，建議匯出一份`
  } else {
    message = `自上次備份已新增/修改 ${status.changesSinceBackup} 筆，建議匯出`
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-sm">
      <span className="text-amber-600">⚠️</span>
      <span className="flex-1 text-amber-900">{message}</span>
      <Link to="/settings" className="text-amber-700 underline font-medium">
        去備份
      </Link>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-600 px-1"
        aria-label="關閉"
      >
        ×
      </button>
    </div>
  )
}
