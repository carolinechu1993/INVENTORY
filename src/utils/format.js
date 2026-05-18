export function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  const diffMs = target - today
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

export function formatDate(input) {
  if (!input) return ''
  const d = new Date(input)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function expiryLabel(dateStr, warnDays = 7) {
  const days = daysUntil(dateStr)
  if (days === null) return { text: '', color: '' }
  if (days < 0) return { text: `已過期 ${-days} 天`, color: 'bg-rose-100 text-rose-700' }
  if (days === 0) return { text: '今天到期', color: 'bg-rose-100 text-rose-700' }
  if (days <= warnDays) return { text: `剩 ${days} 天`, color: 'bg-rose-100 text-rose-700' }
  if (days <= warnDays * 4) return { text: `剩 ${days} 天`, color: 'bg-amber-100 text-amber-700' }
  return { text: `剩 ${days} 天`, color: 'bg-emerald-100 text-emerald-700' }
}
