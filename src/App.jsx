import { useEffect } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import ListPage from './pages/ListPage.jsx'
import ItemFormPage from './pages/ItemFormPage.jsx'
import ItemDetailPage from './pages/ItemDetailPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import WishlistPage from './pages/WishlistPage.jsx'
import BackupBanner from './components/BackupBanner.jsx'
import { maybeShowReminderNotification } from './utils/notify.js'
import { useSync } from './contexts/SyncContext.jsx'

export default function App() {
  const { cloudMode, syncStatus, online, household } = useSync()

  useEffect(() => {
    maybeShowReminderNotification()
  }, [])

  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto">
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="font-bold text-lg flex items-center gap-2">
            <span className="text-xl">📦</span>
            <span>生活庫存</span>
          </div>
          <SyncIndicator cloudMode={cloudMode} syncStatus={syncStatus} online={online} household={household} />
        </div>
        <BackupBanner />
      </header>

      <main className="flex-1 pb-20">
        <Routes>
          <Route path="/" element={<ListPage />} />
          <Route path="/new" element={<ItemFormPage />} />
          <Route path="/item/:id" element={<ItemDetailPage />} />
          <Route path="/item/:id/edit" element={<ItemFormPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<ListPage />} />
        </Routes>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-white border-t border-slate-200 z-20">
        <div className="grid grid-cols-4">
          <BottomTab to="/" label="庫存" icon="📋" />
          <BottomTab to="/wishlist" label="購物" icon="🛒" />
          <BottomTab to="/new" label="新增" icon="➕" />
          <BottomTab to="/settings" label="設定" icon="⚙️" />
        </div>
        <div style={{ height: 'env(safe-area-inset-bottom)' }} />
      </nav>
    </div>
  )
}

function SyncIndicator({ cloudMode, syncStatus, online, household }) {
  if (!cloudMode) {
    return <span className="text-xs text-slate-400">單機</span>
  }
  if (!online) {
    return <span className="text-xs text-amber-600" title="離線中，重連後會自動同步">📴 離線</span>
  }
  if (syncStatus === 'syncing') {
    return <span className="text-xs text-sky-600" title="同步中">☁️ 同步中</span>
  }
  if (syncStatus === 'error') {
    return <span className="text-xs text-rose-600" title="同步失敗">⚠️ 同步失敗</span>
  }
  return <span className="text-xs text-emerald-600" title={`已連到家庭：${household?.name || ''}`}>☁️ 已同步</span>
}

function BottomTab({ to, label, icon }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex flex-col items-center py-2 text-xs ${
          isActive ? 'text-sky-600 font-semibold' : 'text-slate-500'
        }`
      }
    >
      <span className="text-xl leading-none mb-0.5">{icon}</span>
      <span>{label}</span>
    </NavLink>
  )
}
