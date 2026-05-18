export async function blobToBase64(blob) {
  if (!blob) return null
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export function base64ToBlob(base64) {
  if (!base64) return null
  const parts = base64.split(',')
  const meta = parts[0] || ''
  const data = parts.length === 2 ? parts[1] : parts[0]
  const typeMatch = meta.match(/data:([^;]+);/)
  const type = typeMatch ? typeMatch[1] : 'image/jpeg'
  const byteString = atob(data)
  const buffer = new ArrayBuffer(byteString.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < byteString.length; i++) {
    view[i] = byteString.charCodeAt(i)
  }
  return new Blob([buffer], { type })
}
