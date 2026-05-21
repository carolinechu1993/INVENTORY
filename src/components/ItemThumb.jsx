import { useEffect, useState } from 'react'
import { blobToObjectURL } from '../utils/imageCompress.js'

export default function ItemThumb({ blob, alt = '', className = '' }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const objectUrl = blobToObjectURL(blob)
    setUrl(objectUrl)
    return () => {
      if (objectUrl) {
        // 延後 revoke，避免 img 還在用舊 URL 時被回收造成 X
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
      }
    }
  }, [blob])

  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-slate-400 text-2xl ${className}`}>
        📦
      </div>
    )
  }
  return <img src={url} alt={alt} className={`object-cover ${className}`} />
}
