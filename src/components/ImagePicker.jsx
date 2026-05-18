import { useEffect, useRef, useState } from 'react'
import { compressImage, blobToObjectURL } from '../utils/imageCompress.js'

export default function ImagePicker({ value, onChange }) {
  const [previewUrl, setPreviewUrl] = useState(null)
  const [busy, setBusy] = useState(false)
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)

  useEffect(() => {
    if (!value) {
      setPreviewUrl(null)
      return
    }
    const url = blobToObjectURL(value)
    setPreviewUrl(url)
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [value])

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const compressed = await compressImage(file)
      onChange(compressed)
    } catch (err) {
      console.error(err)
      alert('圖片處理失敗，請改用相簿選一張試試')
    } finally {
      setBusy(false)
    }
  }

  function clearImage() {
    onChange(null)
  }

  return (
    <div className="space-y-2">
      {previewUrl ? (
        <div className="relative">
          <img
            src={previewUrl}
            alt="預覽"
            className="w-full max-h-64 object-cover rounded-lg border border-slate-200"
          />
          <button
            type="button"
            onClick={clearImage}
            className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center"
            aria-label="移除圖片"
          >
            ×
          </button>
        </div>
      ) : (
        <div className="aspect-video flex items-center justify-center bg-slate-100 rounded-lg text-slate-400 border-2 border-dashed border-slate-300">
          {busy ? '處理中…' : '尚未選擇圖片'}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          className="btn-secondary flex-1"
          onClick={() => cameraInputRef.current?.click()}
          disabled={busy}
        >
          拍照
        </button>
        <button
          type="button"
          className="btn-secondary flex-1"
          onClick={() => galleryInputRef.current?.click()}
          disabled={busy}
        >
          相簿
        </button>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  )
}
