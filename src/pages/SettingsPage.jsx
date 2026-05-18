import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  clearAllData,
  getBackupStatus,
  getCategories,
  setCategories,
  getLocations,
  setLocations,
  getUnits,
  setUnits,
  getExpiryWarnDays,
  setExpiryWarnDays,
  getReminderSettings,
  setReminderSetting,
  getBrowserNotifyEnabled
} from '../db/inventoryDB.js'
import { exportToJsonFile } from '../utils/exportJson.js'
import { exportToExcelFile } from '../utils/exportExcel.js'
import { importFromJsonFile } from '../utils/importJson.js'
import { formatDate } from '../utils/format.js'
import {
  disableBrowserNotifications,
  enableBrowserNotifications,
  getNotificationPermission,
  isNotificationSupported
} from '../utils/notify.js'
import HouseholdSection from '../components/HouseholdSection.jsx'

export default function SettingsPage() {
  const fileInputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState({ lastBackupAt: null, changesSinceBackup: 0, itemCount: 0 })

  const refreshKey = useLiveQuery(() => db.meta.toArray(), [], null)
  const itemCount = useLiveQuery(() => db.items.count(), [], 0)

  useEffect(() => {
    getBackupStatus().then(setStatus)
  }, [refreshKey, itemCount])

  async function handleExportJson() {
    setBusy(true)
    try {
      const { count, wishlistCount } = await exportToJsonFile()
      alert(`已匯出 ${count} 筆庫存、${wishlistCount} 筆購物清單`)
    } catch (e) {
      alert('匯出失敗：' + e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleExportExcel() {
    setBusy(true)
    try {
      const { count } = await exportToExcelFile()
      alert(`已匯出 ${count} 筆資料到 Excel`)
    } catch (e) {
      alert('匯出失敗：' + e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!confirm('匯入會清除目前所有資料並用備份檔取代，確定？')) return
    setBusy(true)
    try {
      const { count, wishlistCount } = await importFromJsonFile(file)
      alert(`已還原 ${count} 筆庫存、${wishlistCount} 筆購物清單`)
    } catch (e) {
      alert('匯入失敗：' + e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleClearAll() {
    if (!confirm('真的要清除所有資料嗎？建議先匯出備份。此動作無法復原')) return
    if (!confirm('再次確認：清除後資料會永久消失')) return
    setBusy(true)
    try {
      await clearAllData()
      alert('已清除所有資料')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <HouseholdSection />
      <ReminderSettings />

      <OptionListManager
        title="分類管理"
        getList={getCategories}
        setList={setCategories}
        placeholder="例：寵物用品"
      />
      <OptionListManager
        title="位置管理"
        getList={getLocations}
        setList={setLocations}
        placeholder="例：洗手台下方"
        hint="可輸入像「洗手台下方」「廚房第二層櫃」這種具體位置"
      />
      <OptionListManager
        title="單位管理"
        getList={getUnits}
        setList={setUnits}
        placeholder="例：條"
      />

      <section className="card p-4 space-y-2">
        <h2 className="font-semibold">備份狀態</h2>
        <div className="text-sm space-y-1 text-slate-600">
          <div>目前資料筆數：<b className="text-slate-800">{status.itemCount}</b></div>
          <div>
            上次備份：
            <b className="text-slate-800">
              {status.lastBackupAt ? formatDate(status.lastBackupAt) : '從未備份'}
            </b>
          </div>
          <div>
            自上次備份後變更：
            <b className="text-slate-800">{status.changesSinceBackup}</b> 筆
          </div>
        </div>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">匯出 / 備份</h2>
        <p className="text-sm text-slate-500">
          JSON 為完整備份（含圖片、購物清單），可在任何時候還原。
          Excel 適合給家人看或印出來。
        </p>
        <button onClick={handleExportJson} className="btn-primary w-full" disabled={busy}>
          ⬇ 匯出 JSON 備份檔（含圖片）
        </button>
        <button onClick={handleExportExcel} className="btn-secondary w-full" disabled={busy}>
          ⬇ 匯出 Excel 清單
        </button>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">從備份還原</h2>
        <p className="text-sm text-slate-500">
          選擇之前匯出的 <code>inventory-backup-*.json</code> 檔案。
          <span className="text-rose-600 font-medium">會清空目前資料</span>，請小心使用。
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="btn-secondary w-full"
          disabled={busy}
        >
          📂 選擇備份檔還原
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleImport}
        />
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold text-rose-600">危險區</h2>
        <button onClick={handleClearAll} className="btn-danger w-full" disabled={busy}>
          🗑 清除所有資料
        </button>
      </section>

      <p className="text-center text-xs text-slate-400 pt-2">
        v0.2.0 · 本地優先 · 無雲端、無追蹤
      </p>
    </div>
  )
}

function ReminderSettings() {
  const supported = isNotificationSupported()
  const reminders = useLiveQuery(
    () => getReminderSettings(),
    [],
    { expiry: true, zeroStock: true, backup: true }
  )
  const warnDays = useLiveQuery(() => getExpiryWarnDays(), [], 7)
  const browserOn = useLiveQuery(() => getBrowserNotifyEnabled(), [], false)
  const [draftDays, setDraftDays] = useState(7)
  const [perm, setPerm] = useState(supported ? getNotificationPermission() : 'unsupported')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setDraftDays(warnDays)
  }, [warnDays])

  async function toggleReminder(key, value) {
    await setReminderSetting(key, value)
  }

  async function handleSaveDays(value) {
    const v = Math.max(1, Math.min(60, Number(value) || 7))
    setDraftDays(v)
    await setExpiryWarnDays(v)
  }

  async function handleEnableBrowser() {
    setBusy(true)
    const result = await enableBrowserNotifications()
    setPerm(result)
    if (result === 'denied') {
      alert('瀏覽器拒絕了通知權限。請到瀏覽器設定→網站權限→通知，改成「允許」')
    }
    setBusy(false)
  }

  async function handleDisableBrowser() {
    await disableBrowserNotifications()
  }

  return (
    <section className="card p-4 space-y-3">
      <h2 className="font-semibold">提醒設定</h2>

      <ToggleRow
        label="即將到期提醒"
        desc="列表頂端顯示 N 筆即將到期、物品上的紅色標籤"
        checked={reminders.expiry}
        onChange={(v) => toggleReminder('expiry', v)}
      />
      {reminders.expiry && (
        <div className="pl-2 border-l-2 border-sky-200 space-y-1">
          <div className="text-sm text-slate-500">
            到期前 <b className="text-sky-600">{draftDays}</b> 天內視為「即將到期」
          </div>
          <input
            type="range"
            min="1"
            max="30"
            value={draftDays}
            onChange={(e) => setDraftDays(Number(e.target.value))}
            onMouseUp={(e) => handleSaveDays(e.target.value)}
            onTouchEnd={(e) => handleSaveDays(e.target.value)}
            className="w-full"
          />
        </div>
      )}

      <ToggleRow
        label="庫存歸零提醒"
        desc="列表頂端顯示已用完的物品數，並在物品上掛「已用完」標籤"
        checked={reminders.zeroStock}
        onChange={(v) => toggleReminder('zeroStock', v)}
      />

      <ToggleRow
        label="備份提醒"
        desc="超過 7 天或累積 20 筆變更未匯出時，跳橫幅提醒"
        checked={reminders.backup}
        onChange={(v) => toggleReminder('backup', v)}
      />

      <div className="border-t border-slate-200 pt-3">
        <div className="font-medium text-sm mb-1">🔔 瀏覽器系統通知</div>
        {!supported ? (
          <p className="text-xs text-slate-500">
            此瀏覽器不支援通知（建議改用 Chrome / Edge / Safari）
          </p>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-2">
              開啟後，每次開 App 會把上述勾選的提醒以瀏覽器通知跳出（每天最多一次）。
              <br />
              <span className="text-amber-700">※ 免費版無法做完全背景推播</span>
            </p>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-slate-600">
                權限：<b className={perm === 'granted' ? 'text-emerald-600' : ''}>{permLabel(perm)}</b>
                {browserOn && perm === 'granted' && (
                  <span className="text-emerald-600 ml-2">・ 通知已啟用</span>
                )}
              </div>
              {browserOn && perm === 'granted' ? (
                <button onClick={handleDisableBrowser} className="btn-secondary text-xs py-1">
                  關閉通知
                </button>
              ) : (
                <button onClick={handleEnableBrowser} className="btn-primary text-xs py-1" disabled={busy}>
                  啟用通知
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function ToggleRow({ label, desc, checked, onChange }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 w-5 h-5 accent-sky-500"
      />
      <div className="flex-1">
        <div className="font-medium text-sm">{label}</div>
        {desc && <div className="text-xs text-slate-500 mt-0.5">{desc}</div>}
      </div>
    </label>
  )
}

function permLabel(p) {
  if (p === 'granted') return '已允許'
  if (p === 'denied') return '已拒絕'
  if (p === 'default') return '尚未詢問'
  return '不支援'
}

function OptionListManager({ title, getList, setList, placeholder, hint }) {
  const items = useLiveQuery(() => getList(), [getList], [])
  const [draft, setDraft] = useState('')
  const [editingIndex, setEditingIndex] = useState(-1)
  const [editValue, setEditValue] = useState('')

  async function handleAdd() {
    const v = draft.trim()
    if (!v) return
    if (items.includes(v)) {
      alert('已存在')
      return
    }
    await setList([...items, v])
    setDraft('')
  }

  async function handleRemove(value) {
    if (!confirm(`從選單移除「${value}」？\n（不會影響已建立的物品）`)) return
    await setList(items.filter((x) => x !== value))
  }

  function startEdit(index, value) {
    setEditingIndex(index)
    setEditValue(value)
  }

  async function commitEdit(oldValue) {
    const v = editValue.trim()
    if (!v || v === oldValue) {
      setEditingIndex(-1)
      return
    }
    if (items.includes(v)) {
      alert('已存在這個選項')
      return
    }
    const next = items.map((x) => (x === oldValue ? v : x))
    await setList(next)
    setEditingIndex(-1)
  }

  return (
    <section className="card p-4 space-y-2">
      <h2 className="font-semibold">{title}</h2>
      {hint && <p className="text-sm text-slate-500">{hint}</p>}
      <div className="flex gap-2">
        <input
          className="input flex-1"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder={placeholder}
        />
        <button onClick={handleAdd} className="btn-primary px-4">新增</button>
      </div>
      <ul className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
        {items.length === 0 && (
          <li className="text-sm text-slate-400 py-2">尚無選項</li>
        )}
        {items.map((item, idx) => (
          <li key={item} className="py-1.5 flex items-center gap-2">
            {editingIndex === idx ? (
              <>
                <input
                  className="input flex-1 py-1 text-sm"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && commitEdit(item)}
                  autoFocus
                />
                <button onClick={() => commitEdit(item)} className="text-sm text-sky-600">
                  存
                </button>
                <button onClick={() => setEditingIndex(-1)} className="text-sm text-slate-500">
                  取消
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm">{item}</span>
                <button onClick={() => startEdit(idx, item)} className="text-xs text-slate-500 px-2">
                  改
                </button>
                <button onClick={() => handleRemove(item)} className="text-xs text-rose-500 px-2">
                  刪
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
