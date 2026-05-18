import { useState } from 'react'
import { useSync } from '../contexts/SyncContext.jsx'
import {
  signInWithGoogle,
  signOut
} from '../firebase/auth.js'
import {
  createHousehold,
  joinHouseholdByCode,
  leaveHousehold
} from '../firebase/household.js'
import { uploadEntireLocalDb, replaceLocalWithCloud } from '../firebase/sync.js'
import { db } from '../db/inventoryDB.js'

export default function HouseholdSection() {
  const { firebaseReady, ready, user, household, setActiveHouseholdFromUI } = useSync()
  const [mode, setMode] = useState(null) // 'create' | 'join' | null
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!firebaseReady) {
    return (
      <section className="card p-4 space-y-2">
        <h2 className="font-semibold">家庭共用</h2>
        <p className="text-sm text-amber-700">Firebase 尚未設定，這個功能暫時無法使用</p>
      </section>
    )
  }

  if (!ready) {
    return (
      <section className="card p-4">
        <h2 className="font-semibold">家庭共用</h2>
        <p className="text-sm text-slate-500 mt-2">載入中…</p>
      </section>
    )
  }

  async function handleSignIn() {
    setError('')
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch (e) {
      setError(e.message || '登入失敗')
    } finally {
      setBusy(false)
    }
  }

  async function handleSignOut() {
    setBusy(true)
    try {
      await signOut()
    } finally {
      setBusy(false)
    }
  }

  // 未登入
  if (!user) {
    return (
      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">家庭共用</h2>
        <p className="text-sm text-slate-500">
          目前是<b className="text-slate-700">單機模式</b>，資料只在這支手機。
          <br />
          想跟家人即時共用一份庫存？用 Google 登入即可開始。
        </p>
        <button onClick={handleSignIn} className="btn-primary w-full" disabled={busy}>
          {busy ? '登入中…' : '🔑 用 Google 登入'}
        </button>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </section>
    )
  }

  // 已登入 + 已在家庭
  if (household) {
    return <InHouseholdView household={household} user={user} onLeft={() => setActiveHouseholdFromUI(null)} onSignOut={handleSignOut} />
  }

  // 已登入 + 還沒選/建立家庭
  return (
    <section className="card p-4 space-y-3">
      <h2 className="font-semibold">家庭共用</h2>
      <p className="text-sm text-slate-600">
        登入身分：<b>{user.displayName || user.email}</b>
        <button onClick={handleSignOut} className="text-xs text-slate-400 underline ml-2">登出</button>
      </p>
      {!mode && (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setMode('create')} className="btn-primary text-sm py-2.5">
            🏠 建立家庭
          </button>
          <button onClick={() => setMode('join')} className="btn-secondary text-sm py-2.5">
            👥 加入家庭
          </button>
        </div>
      )}
      {mode === 'create' && (
        <CreateForm
          onDone={(hh) => { setActiveHouseholdFromUI(hh); setMode(null) }}
          onCancel={() => setMode(null)}
        />
      )}
      {mode === 'join' && (
        <JoinForm
          onDone={(hh) => { setActiveHouseholdFromUI(hh); setMode(null) }}
          onCancel={() => setMode(null)}
        />
      )}
    </section>
  )
}

function CreateForm({ onDone, onCancel }) {
  const [name, setName] = useState('我家')
  const [uploadLocal, setUploadLocal] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const hh = await createHousehold(name.trim() || '我家')
      // 先把 active household 設好（必須在 upload 之前）
      // 但這裡 onDone 會 setActiveHouseholdFromUI；先 set 再 upload 比較乾淨
      onDone(hh)
      if (uploadLocal) {
        // 等到 sync 啟動後再上傳（給 listener 0.5 秒接上）
        setTimeout(() => uploadEntireLocalDb().catch((err) => console.warn('upload failed', err)), 500)
      }
    } catch (e) {
      setError(e.message || '建立失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleCreate} className="space-y-2 pt-2 border-t border-slate-100">
      <label className="block space-y-1">
        <span className="text-sm font-medium">家庭名稱</span>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例：我家、陳家"
          maxLength={20}
        />
      </label>
      <LocalUploadHint checked={uploadLocal} onChange={setUploadLocal} />
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1" disabled={busy}>
          取消
        </button>
        <button type="submit" className="btn-primary flex-[2]" disabled={busy}>
          {busy ? '建立中…' : '建立家庭'}
        </button>
      </div>
    </form>
  )
}

function LocalUploadHint({ checked, onChange }) {
  const [count, setCount] = useState(null)
  if (count === null) {
    db.items.count().then(setCount).catch(() => setCount(0))
  }
  if (count === 0) return null
  return (
    <label className="flex items-start gap-2 text-sm text-slate-700 bg-sky-50 p-2 rounded">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      <span>
        把目前手機上的 <b>{count}</b> 筆庫存當作家庭起始資料一起上傳（取消勾選則不上傳，雲端會是空的）
      </span>
    </label>
  )
}

function JoinForm({ onDone, onCancel }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [localCount, setLocalCount] = useState(null)
  if (localCount === null) {
    db.items.count().then(setLocalCount).catch(() => setLocalCount(0))
  }

  async function handleJoin(e) {
    e.preventDefault()
    const trimmed = code.trim().toLowerCase()
    if (!trimmed) return
    if (localCount > 0) {
      if (!confirm(`加入家庭後將使用家庭的庫存資料，本地 ${localCount} 筆會被取代。\n建議先到上面的「匯出 JSON」備份保險。\n\n確定要加入嗎？`)) return
    }
    setError('')
    setBusy(true)
    try {
      const hh = await joinHouseholdByCode(trimmed)
      // 先清本地，set active，listener 會自動拉雲端資料下來
      await replaceLocalWithCloud()
      onDone(hh)
    } catch (e) {
      setError(e.message || '加入失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleJoin} className="space-y-2 pt-2 border-t border-slate-100">
      <label className="block space-y-1">
        <span className="text-sm font-medium">家庭代碼</span>
        <input
          className="input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="例：happy-cat-42"
          autoFocus
        />
      </label>
      {localCount > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
          ⚠️ 你手機現有 {localCount} 筆庫存，加入後會被家庭資料取代
        </p>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1" disabled={busy}>
          取消
        </button>
        <button type="submit" className="btn-primary flex-[2]" disabled={busy || !code.trim()}>
          {busy ? '加入中…' : '加入家庭'}
        </button>
      </div>
    </form>
  )
}

function InHouseholdView({ household, user, onLeft, onSignOut }) {
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(household.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 不支援 clipboard 就提示手動
      prompt('複製這段代碼：', household.code)
    }
  }

  async function handleLeave() {
    if (!confirm(`確定要退出家庭「${household.name}」？\n\n本地資料會保留（變回單機模式），未來家庭的更新不會再同步給你。\n之後若想重新加入，再次輸入代碼即可。`)) return
    setBusy(true)
    try {
      await leaveHousehold(household.householdId)
      onLeft()
    } catch (e) {
      alert('退出失敗：' + e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card p-4 space-y-3 bg-sky-50 border-sky-200">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-1.5">
          ☁️ <span>家庭共用</span>
        </h2>
        <span className="text-xs text-emerald-700">即時同步中</span>
      </div>

      <div>
        <div className="text-xs text-slate-500">家庭名稱</div>
        <div className="font-semibold">{household.name}</div>
      </div>

      <div>
        <div className="text-xs text-slate-500 mb-1">家庭代碼（分享給家人加入）</div>
        <div className="flex gap-2">
          <code className="flex-1 px-3 py-2 bg-white border border-sky-300 rounded font-mono text-base">
            {household.code}
          </code>
          <button onClick={handleCopy} className="btn-secondary px-3">
            {copied ? '✓ 已複製' : '複製'}
          </button>
        </div>
      </div>

      <div className="text-xs text-slate-500">
        成員 {household.members?.length || 1} 人 · 你以 <b>{user.displayName || user.email}</b> 同步
      </div>

      <div className="flex gap-2 pt-2 border-t border-sky-200">
        <button onClick={onSignOut} className="btn-secondary flex-1 text-sm py-1.5" disabled={busy}>
          登出
        </button>
        <button onClick={handleLeave} className="btn-danger flex-1 text-sm py-1.5" disabled={busy}>
          退出家庭
        </button>
      </div>
    </section>
  )
}
