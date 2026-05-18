import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  addWishlistItem,
  deleteWishlistItem,
  getCategories,
  getUnits,
  updateWishlistItem
} from '../db/inventoryDB.js'
import ChipInput from '../components/ChipInput.jsx'

const PRIORITY_OPTIONS = [
  { key: 'high', label: '急', color: 'bg-rose-100 text-rose-700' },
  { key: 'normal', label: '一般', color: 'bg-slate-100 text-slate-600' },
  { key: 'low', label: '不急', color: 'bg-slate-100 text-slate-500' }
]

export default function WishlistPage() {
  const [query, setQuery] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  const wishlist = useLiveQuery(() => db.wishlist.toArray(), [], [])
  const inventory = useLiveQuery(() => db.items.toArray(), [], [])
  const categories = useLiveQuery(() => getCategories(), [], [])
  const units = useLiveQuery(() => getUnits(), [], [])

  const lowStock = useMemo(() => {
    const wishedNames = new Set(wishlist.map((w) => w.name))
    return inventory.filter((i) => {
      if (wishedNames.has(i.name)) return false
      return (i.quantity ?? 0) === 0
    })
  }, [inventory, wishlist])

  const filtered = useMemo(() => {
    let list = wishlist
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(
        (w) => w.name?.toLowerCase().includes(q) || w.notes?.toLowerCase().includes(q)
      )
    }
    const priorityRank = { high: 0, normal: 1, low: 2 }
    list = [...list].sort((a, b) => {
      const pa = priorityRank[a.priority] ?? 1
      const pb = priorityRank[b.priority] ?? 1
      if (pa !== pb) return pa - pb
      return (b.addedAt || 0) - (a.addedAt || 0)
    })
    return list
  }, [wishlist, query])

  async function handleAddFromLowStock(item) {
    await addWishlistItem({
      name: item.name,
      category: item.category,
      quantity: 1,
      unit: item.unit,
      priority: 'normal'
    })
  }

  return (
    <div className="p-4 space-y-3">
      <div className="card p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-1.5">
            <span>🛒</span>
            <span>待購清單</span>
            <span className="text-slate-400 text-sm font-normal">({wishlist.length})</span>
          </h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-primary text-sm py-1.5"
          >
            {showAddForm ? '收起' : '➕ 新增'}
          </button>
        </div>
        <input
          className="input"
          placeholder="🔍 搜尋待購清單…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {showAddForm && (
        <AddWishForm
          categories={categories}
          units={units}
          onAdded={() => setShowAddForm(false)}
        />
      )}

      {lowStock.length > 0 && (
        <div className="card p-3 space-y-2 border-amber-200 bg-amber-50">
          <div className="text-sm font-semibold text-amber-800">
            💡 庫存不足建議補貨（{lowStock.length}）
          </div>
          <ul className="space-y-1.5">
            {lowStock.slice(0, 6).map((i) => (
              <li key={i.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">
                  {i.name}
                  <span className="text-slate-500 ml-1">
                    （{i.quantity ?? 0} {i.unit || ''}）
                  </span>
                </span>
                <button
                  onClick={() => handleAddFromLowStock(i)}
                  className="text-sky-600 text-xs px-2 py-1 rounded bg-white border border-sky-200"
                >
                  加入清單
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState hasAny={wishlist.length > 0} />
      ) : (
        <>
          <p className="text-xs text-slate-400 px-1">
            勾選代表「已買到」→ 會跳到新增表單補位置與到期日 → 存後自動從待購消失
          </p>
          <ul className="space-y-2">
            {filtered.map((w) => (
              <WishRow key={w.id} item={w} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function EmptyState({ hasAny }) {
  return (
    <div className="text-center py-12 text-slate-500">
      <div className="text-5xl mb-3">🛒</div>
      <p>{hasAny ? '沒有符合搜尋的待購項目' : '待購清單目前是空的'}</p>
    </div>
  )
}

function WishRow({ item }) {
  const navigate = useNavigate()
  const priority = PRIORITY_OPTIONS.find((p) => p.key === item.priority) || PRIORITY_OPTIONS[1]
  const [busy, setBusy] = useState(false)

  function handleConfirmBought() {
    if (!confirm(`已經買到「${item.name}」了嗎？\n\n確認後會跳到新增表單，補位置與到期日後存檔，即加入庫存並從待購消失。`)) return
    navigate('/new', {
      state: {
        preset: {
          name: item.name,
          category: item.category || '',
          quantity: item.quantity || 1,
          unit: item.unit || '',
          notes: item.notes || ''
        },
        fromWishlistId: item.id
      }
    })
  }

  async function adjustQty(delta) {
    const next = Math.max(1, (item.quantity || 1) + delta)
    if (next === (item.quantity || 1)) return
    setBusy(true)
    try {
      await updateWishlistItem(item.id, { quantity: next })
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`刪除「${item.name}」？\n（從待購清單移除，不會加入庫存）`)) return
    await deleteWishlistItem(item.id)
  }

  return (
    <li className="card overflow-hidden">
      <div className="p-3 flex items-start gap-3">
        <button
          type="button"
          onClick={handleConfirmBought}
          className="mt-1 w-6 h-6 rounded border-2 border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 flex items-center justify-center shrink-0"
          aria-label="標記為已買到"
          title="點我代表已經買到了"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`chip ${priority.color}`}>{priority.label}</span>
            <h3 className="font-semibold truncate">{item.name}</h3>
          </div>
          {item.category && (
            <div className="text-sm text-slate-500 mt-0.5">{item.category}</div>
          )}
          {item.notes && (
            <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{item.notes}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 pb-3 pt-2 border-t border-slate-100">
        <button
          onClick={() => adjustQty(-1)}
          disabled={busy || (item.quantity || 1) <= 1}
          className="w-9 h-9 rounded-full border border-slate-300 text-lg leading-none disabled:opacity-30 active:bg-slate-100"
          aria-label="減少 1"
        >−</button>
        <div className="text-base font-semibold min-w-[3.5rem] text-center">
          {item.quantity || 1}
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

function AddWishForm({ categories, units, onAdded }) {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unit, setUnit] = useState('')
  const [category, setCategory] = useState('')
  const [priority, setPriority] = useState('normal')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await addWishlistItem({
      name: name.trim(),
      quantity: Number(quantity) || 1,
      unit,
      category,
      priority,
      notes: notes.trim()
    })
    setName('')
    setQuantity(1)
    setUnit('')
    setCategory('')
    setPriority('normal')
    setNotes('')
    setSaving(false)
    onAdded?.()
  }

  return (
    <form onSubmit={handleSubmit} className="card p-3 space-y-2">
      <input
        className="input"
        placeholder="想買什麼？（必填）"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        required
      />
      <div className="grid grid-cols-3 gap-2">
        <input
          type="number"
          min="1"
          className="input"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <div className="col-span-2">
          <ChipInput
            value={unit}
            onChange={setUnit}
            options={units}
            placeholder="單位"
          />
        </div>
      </div>
      <ChipInput
        value={category}
        onChange={setCategory}
        options={categories}
        placeholder="分類（選填）"
      />
      <div className="flex gap-1">
        {PRIORITY_OPTIONS.map((p) => (
          <button
            type="button"
            key={p.key}
            onClick={() => setPriority(p.key)}
            className={`flex-1 py-1.5 rounded text-sm ${
              priority === p.key
                ? 'bg-sky-100 text-sky-700 font-semibold'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <textarea
        className="input"
        rows="2"
        placeholder="備註（選填）"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <button type="submit" className="btn-primary w-full" disabled={saving}>
        {saving ? '加入中…' : '加入清單'}
      </button>
    </form>
  )
}
