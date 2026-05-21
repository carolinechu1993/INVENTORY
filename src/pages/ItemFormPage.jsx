import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  addItem,
  updateItem,
  getItem,
  getCategories,
  getLocations,
  getUnits,
  deleteWishlistItem
} from '../db/inventoryDB.js'
import ImagePicker from '../components/ImagePicker.jsx'
import ChipInput from '../components/ChipInput.jsx'
import { formatDate } from '../utils/format.js'

const EMPTY = {
  name: '',
  category: '',
  quantity: 1,
  unit: '',
  location: '',
  expiryDate: '',
  notes: '',
  imageBlob: null
}

export default function ItemFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const routerLocation = useLocation()
  const isEdit = Boolean(id)

  const preset = routerLocation.state?.preset || null
  const fromWishlistId = routerLocation.state?.fromWishlistId || null

  const [form, setForm] = useState(() =>
    !isEdit && preset
      ? { ...EMPTY, ...sanitizePreset(preset) }
      : EMPTY
  )
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  const categories = useLiveQuery(() => getCategories(), [], [])
  const locations = useLiveQuery(() => getLocations(), [], [])
  const units = useLiveQuery(() => getUnits(), [], [])

  useEffect(() => {
    if (!isEdit) return
    (async () => {
      const item = await getItem(id)
      if (item) {
        setForm({
          name: item.name || '',
          category: item.category || '',
          quantity: item.quantity ?? 1,
          unit: item.unit || '',
          location: item.location || '',
          expiryDate: formatDate(item.expiryDate),
          notes: item.notes || '',
          imageBlob: item.imageBlob || null
        })
      }
      setLoading(false)
    })()
  }, [id, isEdit])

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) {
      alert('請輸入名稱')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        quantity: Number(form.quantity) || 0,
        unit: form.unit,
        location: form.location,
        expiryDate: form.expiryDate || null,
        notes: form.notes.trim(),
        imageBlob: form.imageBlob
      }
      if (isEdit) {
        await updateItem(Number(id), payload)
        navigate(`/item/${id}`)
      } else {
        await addItem(payload)
        if (fromWishlistId) {
          await deleteWishlistItem(fromWishlistId)
          navigate('/wishlist')
        } else {
          navigate('/')
        }
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-4 text-slate-500">載入中…</div>

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      {fromWishlistId && (
        <div className="card p-3 bg-sky-50 border-sky-200 text-sm text-sky-800">
          📥 從待購清單帶過來，補完位置與到期日後存檔，會自動從待購消失
        </div>
      )}

      <div className="card p-3 space-y-3">
        <Field label="名稱 *">
          <input
            className="input"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="例：薄鹽醬油"
            required
          />
        </Field>

        <Field label="圖片">
          <ImagePicker
            value={form.imageBlob}
            onChange={(blob) => update('imageBlob', blob)}
          />
        </Field>
      </div>

      <div className="card p-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="分類">
            <ChipInput
              value={form.category}
              onChange={(v) => update('category', v)}
              options={categories}
              placeholder="選或輸入"
            />
          </Field>
          <Field label="存放位置">
            <ChipInput
              value={form.location}
              onChange={(v) => update('location', v)}
              options={locations}
              placeholder="例：洗手台下方"
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="庫存數量">
            <input
              type="number"
              className="input"
              min="0"
              step="1"
              value={form.quantity}
              onChange={(e) => update('quantity', e.target.value)}
            />
          </Field>
          <Field label="單位" className="col-span-2">
            <ChipInput
              value={form.unit}
              onChange={(v) => update('unit', v)}
              options={units}
              placeholder="瓶 / 包 / 個…"
            />
          </Field>
        </div>

        <Field label="到期日">
          <div className="flex gap-2">
            <input
              type="date"
              className="input flex-1"
              value={form.expiryDate}
              onChange={(e) => update('expiryDate', e.target.value)}
            />
            {form.expiryDate && (
              <button
                type="button"
                onClick={() => update('expiryDate', '')}
                className="btn-secondary px-3 text-sm"
              >
                清除
              </button>
            )}
          </div>
          {!form.expiryDate && (
            <p className="text-xs text-slate-400 mt-1">沒有設定到期日（適用於沒有保存期限的物品）</p>
          )}
        </Field>

        <Field label="備註">
          <textarea
            className="input"
            rows="3"
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="購買地點、品牌、注意事項…"
          />
        </Field>
      </div>

      <div className="flex gap-2 sticky bottom-20 bg-slate-50 pt-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="btn-secondary flex-1"
        >
          取消
        </button>
        <button type="submit" className="btn-primary flex-[2]" disabled={saving}>
          {saving ? '儲存中…' : isEdit ? '儲存修改' : '新增'}
        </button>
      </div>
    </form>
  )
}

function sanitizePreset(preset) {
  const out = {}
  if (preset.name) out.name = preset.name
  if (preset.category) out.category = preset.category
  if (preset.unit) out.unit = preset.unit
  if (typeof preset.quantity === 'number' && preset.quantity > 0) {
    out.quantity = preset.quantity
  }
  if (preset.notes) out.notes = preset.notes
  return out
}

function Field({ label, children, className = '' }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <div className="text-sm font-medium text-slate-700">{label}</div>
      {children}
    </div>
  )
}

