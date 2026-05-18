export async function compressImage(file, { maxSide = 800, quality = 0.8 } = {}) {
  const bitmap = await loadBitmap(file)
  const { width, height } = scaleSize(bitmap.width, bitmap.height, maxSide)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, width, height)

  const blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
  )

  if (typeof bitmap.close === 'function') bitmap.close()
  return blob
}

function scaleSize(w, h, maxSide) {
  if (w <= maxSide && h <= maxSide) return { width: w, height: h }
  if (w >= h) {
    const ratio = maxSide / w
    return { width: maxSide, height: Math.round(h * ratio) }
  }
  const ratio = maxSide / h
  return { width: Math.round(w * ratio), height: maxSide }
}

async function loadBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      // fallthrough
    }
  }
  return await loadImageElement(file)
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}

export function blobToObjectURL(blob) {
  if (!blob) return null
  return URL.createObjectURL(blob)
}
