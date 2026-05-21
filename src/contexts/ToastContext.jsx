import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

const ToastContext = createContext({ showToast: () => {} })

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setToast(null)
  }, [])

  const showToast = useCallback((opts) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const id = Date.now() + Math.random()
    const duration = opts.duration ?? 7000
    setToast({ id, ...opts })
    if (duration !== Infinity) {
      timerRef.current = setTimeout(() => {
        setToast((cur) => (cur?.id === id ? null : cur))
        timerRef.current = null
      }, duration)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <ToastContext.Provider value={{ showToast, dismiss }}>
      {children}
      {toast && <ToastView toast={toast} onDismiss={dismiss} />}
    </ToastContext.Provider>
  )
}

function ToastView({ toast, onDismiss }) {
  async function handleAction() {
    try {
      await toast.action?.handler?.()
    } finally {
      onDismiss()
    }
  }

  return (
    <div className="fixed left-0 right-0 bottom-20 z-30 px-4 pointer-events-none">
      <div className="max-w-2xl mx-auto pointer-events-auto">
        <div className="bg-slate-800 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-[fadeIn_0.2s_ease]">
          <span className="flex-1 text-sm">{toast.message}</span>
          {toast.action && (
            <button
              onClick={handleAction}
              className="text-sky-300 font-bold text-sm px-2 py-1"
            >
              {toast.action.label}
            </button>
          )}
          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-white px-1 leading-none text-xl"
            aria-label="關閉"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
