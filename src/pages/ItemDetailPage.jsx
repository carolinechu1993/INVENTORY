import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  addItem,
  addWishlistItem,
  deleteItem,
  getExpiryWarnDays,
  getItem,
  updateItem
} from '../db/inventoryDB.js'
import ItemThumb from '../components/ItemThumb.jsx'
import { expiryLabel, formatDate } from '../utils/format.js'
import { useToast } from '../contexts/ToastContext.jsx'

export default function ItemDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const warnDays = useLiveQuery(() => getExpiryWarnDays(), [], 7)
  const { showToast } = useToast()

  useEffect(() => {
    (async () => {
      const data = await getItem(id)
      setItem(data)
      setLoading(false)
    })()
  }, [id])

  async function handleAddToWishlist() {
    if (!confirm(`把「${item.name}」加入購物清單？`)) return
    await addWishlistItem({
      name: item.name,
      category: item.category,
      quantity: 1,
      unit: item.unit,
      priority: 'normal'
    })
    alert('已加入購物清單')
  }

  async function handleAdjustQuantity(delta) {
    const next = Math.max(0, (item.quantity || 0) + delta)
    await updateItem(item.id, { quantity: next })
    setItem({ ...item, quantity: next })
  }

  async function handleDelete() {
    if (!confirm(`確定要刪除「${item.name}」？`)) return
    const snapshot = item
    await deleteItem(item.id)
    showToast({
      message: `已刪除「${snapshot.name}」`,
      action: {
        label: '復原',
        handler: async () => {
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
    navigate('/')
  }

  if (loading) return <div className="p-4 text-slate-500">載入中…</div>
  if (!item) {
    return (
      <div className="p-4 text-center">
        <p className="text-slate-500 mb-3">找不到這筆資料</p>
        <Link to="/" className="btn-primary inline-flex">回列表</Link>
      </div>
    )
  }

  const exp = expiryLabel(item.expiryDate, warnDays)

  return (
    <div className="p-4 space-y-4">
      <ItemThumb
        blob={item.imageBlob}
        alt={item.name}
        className="w-full aspect-square max-h-80 rounded-xl"
      />

      <div className="card p-4 space-y-3">
        <h1 className="text-2xl font-bold">{item.name}</h1>

        <div className="flex flex-wrap gap-1.5">
          {item.category && <span className="chip bg-slate-100 text-slate-600">{item.category}</span>}
          {item.location && <span className="chip bg-slate-100 text-slate-600">📍 {item.location}</span>}
          {exp.text && <span className={`chip ${exp.color}`}>{exp.text}</span>}
          {(item.quantity ?? 0) === 0 && (
            <span className="chip bg-amber-100 text-amber-700">已用完</span>
          )}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={() => handleAdjustQuantity(-1)}
            className="w-10 h-10 rounded-full border border-slate-300 text-xl"
          >
            −
          </button>
          <div className="flex-1 text-center">
            <div className="text-3xl font-bold">{item.quantity ?? 0}</div>
            <div className="text-sm text-slate-500">{item.unit || '個'}</div>
          </div>
          <button
            onClick={() => handleAdjustQuantity(1)}
            className="w-10 h-10 rounded-full border border-slate-300 text-xl"
          >
            +
          </button>
        </div>
      </div>

      <div className="card p-4 space-y-2 text-sm">
        <Row label="到期日" value={formatDate(item.expiryDate) || '—'} />
        <Row label="存放位置" value={item.location || '—'} />
        <Row label="分類" value={item.category || '—'} />
        <Row label="最後更新" value={formatDate(item.updatedAt)} />
      </div>

      {item.notes && (
        <div className="card p-4">
          <div className="text-sm font-medium text-slate-700 mb-1">備註</div>
          <p className="whitespace-pre-wrap text-slate-700">{item.notes}</p>
        </div>
      )}

      <div className="space-y-2">
        <button
          onClick={handleAddToWishlist}
          className="btn-secondary w-full"
        >
          🛒 加入購物清單
        </button>
        <Link to={`/item/${item.id}/edit`} className="btn-primary w-full">
          編輯
        </Link>
        <button onClick={handleDelete} className="btn-danger w-full">
          刪除
        </button>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-800">{value}</span>
    </div>
  )
}
