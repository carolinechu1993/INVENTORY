import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  addItem,
  db,
  deleteItem,
  getCategories,
  getLocations,
  getExpiryWarnDays,
  getReminderSettings,
  getItem,
  updateItem
} from '../db/inventoryDB.js'
import ItemThumb from '../components/ItemThumb.jsx'
import { daysUntil, expiryLabel } from '../utils/format.js'
import { useToast } from '../contexts/ToastContext.jsx'

const SORTS = [
  { key: 'updated', label: '最新更新' },
  { key: 'expiry', label: '到期日近' },
  { key: 'name', label: '名稱' }
]

const VIEW_MODE_KEY = 'listViewShowImages'

export default function ListPage() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [location, setLocation] = useState('')
  const [sortKey, setSortKey] = useState('updated')
  const [showImages, setShowImages] = useState(() => {
    const saved = localStorage.getItem(VIEW_MODE_KEY)
    return saved === null ? true : saved === 'true'
  })

  function toggleShowImages() {
    const next = !showImages
    setShowImages(next)
    localStorage.setItem(VIEW_MODE_KEY, String(next))
  }

  const items = useLiveQuery(() => db.items.toArray(), [], [])
  const categories = useLiveQuery(() => getCategories(), [], [])
  const locations = useLiveQuery(() => getLocations(), [], [])
  const warnDays = useLiveQuery(() => getExpiryWarnDays(), [], 7)
  const reminders = useLiveQuery(() => getReminderSettings(), [], { expiry: true, zeroStock: true, backup: true })

  const filtered = useMemo(() => {
    let list = items
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(
        (i) =>
          i.name?.toLowerCase().includes(q) ||
          i.notes?.toLowerCase().includes(q) ||
          i.category?.toLowerCase().includes(q) ||
          i.location?.toLowerCase().includes(q)
      )
    }
    if (category) list = list.filter((i) => i.category === category)
    if (location) list = list.filter((i) => i.location === location)

    if (sortKey === 'updated') {
      list = [...list].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    } else if (sortKey === 'expiry') {
      list = [...list].sort((a, b) => {
        const da = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity
        const db_ = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity
        return da - db_
      })
    } else if (sortKey === 'name') {
      list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-Hant'))
    }
    return list
  }, [items, query, category, location, sortKey])

  const expiringSoonCount = useMemo(
    () => items.filter((i) => {
      const d = daysUntil(i.expiryDate)
      return d !== null && d <= warnDays
    }).length,
    [items, warnDays]
  )

  const zeroStockCount = useMemo(
    () => items.filter((i) => (i.quantity ?? 0) === 0).length,
    [items]
  )

  return (
    <div className="p-4 space-y-3">
      <div className="card p-3 space-y-2">
        <input
          className="input"
          placeholder="🔍 搜尋名稱、備註、分類…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <select
            className="input flex-1 min-w-0"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">全部分類</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            className="input flex-1 min-w-0"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          >
            <option value="">全部位置</option>
            {locations.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between gap-1 text-sm">
          <button
            onClick={toggleShowImages}
            className="px-2 py-1 rounded text-xs text-slate-600 bg-slate-100 active:bg-slate-200"
            title={showImages ? '切換為緊湊模式（隱藏圖片）' : '切換為顯示圖片'}
          >
            {showImages ? '🖼 圖文' : '📃 緊湊'}
          </button>
          <div className="flex gap-1">
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSortKey(s.key)}
                className={`px-2 py-1 rounded text-xs ${
                  sortKey === s.key
                    ? 'bg-sky-100 text-sky-700 font-semibold'
                    : 'text-slate-500'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500 px-1 flex-wrap gap-2">
        <span>共 {filtered.length} 筆</span>
        <div className="flex gap-3">
          {reminders.expiry && expiringSoonCount > 0 && (
            <span className="text-rose-600">
              ⚠️ {expiringSoonCount} 筆 {warnDays} 天內到期
            </span>
          )}
          {reminders.zeroStock && zeroStockCount > 0 && (
            <span className="text-amber-700">
              📭 {zeroStockCount} 筆已用完
            </span>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState hasAny={items.length > 0} />
      ) : (
        <ul className="space-y-2">
          {filtered.map((item) => (
            <ItemRow key={item.id} item={item} warnDays={warnDays} showImage={showImages} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ItemRow({ item, warnDays, showImage = true }) {
  const exp = expiryLabel(item.expiryDate, warnDays)
  const isEmpty = (item.quantity ?? 0) === 0
  const [busy, setBusy] = useState(false)
  const { showToast } = useToast()

  async function adjustQty(delta) {
    const next = Math.max(0, (item.quantity || 0) + delta)
    if (next === (item.quantity || 0)) return
    setBusy(true)
    try {
      await updateItem(item.id, { quantity: next })
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`刪除「${item.name}」？`)) return
    const snapshot = await getItem(item.id)
    await deleteItem(item.id)
    showToast({
      message: `已刪除「${item.name}」`,
      action: {
        label: '復原',
        handler: async () => {
          if (!snapshot) return
          await addItem({
            name: snapshot.name,
            category: snapshot.category,
            quantity: snapshot.quantity,
            unit: snapshot.unit,
            location: snapshot.location,
            expiryDate: snapshot.expiryDate,
            notes: snapshot.notes,
            imageBlob: snapshot.imageBlob
          })
        }
      }
    })
  }

  return (
    <li className={`card overflow-hidden ${isEmpty ? 'opacity-70' : ''}`}>
      <Link to={`/item/${item.id}`} className="block p-3 active:bg-slate-50">
        <div className="flex gap-3">
          {showImage && (
            <ItemThumb
              blob={item.imageBlob}
              alt={item.name}
              className="w-16 h-16 rounded-lg shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold truncate">{item.name}</h3>
              {isEmpty && (
                <span className="chip bg-amber-100 text-amber-700 shrink-0">已用完</span>
              )}
            </div>
            <div className="text-sm text-slate-500 mt-0.5">
              📍 {item.location || '未設位置'}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {item.category && <span className="chip bg-slate-100 text-slate-600">{item.category}</span>}
              {exp.text && <span className={`chip ${exp.color}`}>{exp.text}</span>}
            </div>
          </div>
        </div>
      </Link>
      <div className="flex items-center gap-2 px-3 pb-3 pt-2 border-t border-slate-100">
        <button
          onClick={() => adjustQty(-1)}
          disabled={busy || (item.quantity || 0) === 0}
          className="w-9 h-9 rounded-full border border-slate-300 text-lg leading-none disabled:opacity-30 active:bg-slate-100"
          aria-label="減少 1"
        >−</button>
        <div className="text-base font-semibold min-w-[3.5rem] text-center">
          {item.quantity ?? 0}
          <span className="text-xs text-slate-500 ml-0.5 font-normal">{item.unit || ''}</span>
        </div>
        <button
          onClick={() => adjustQty(1)}
          disabled={busy}
          className="w-9 h-9 rounded-full border border-slate-300 text-lg leading-none disabled:opacity-30 active:bg-slate-100"
          aria-label="增加 1"
        >+</button>
        <div className="flex-1" />
        <button
          onClick={handleDelete}
          className="text-xs text-rose-500 px-3 py-2"
        >刪除</button>
      </div>
    </li>
  )
}

function EmptyState({ hasAny }) {
  return (
    <div className="text-center py-12 text-slate-500">
      <div className="text-5xl mb-3">📦</div>
      <p className="mb-4">
        {hasAny ? '沒有符合篩選條件的物品' : '還沒有任何物品，現在就來新增第一筆吧'}
      </p>
      {!hasAny && (
        <Link to="/new" className="btn-primary inline-flex">
          ➕ 新增物品
        </Link>
      )}
    </div>
  )
}
