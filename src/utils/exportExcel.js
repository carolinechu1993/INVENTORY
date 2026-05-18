import * as XLSX from 'xlsx'
import { db } from '../db/inventoryDB.js'
import { formatDate } from './format.js'

export async function exportToExcelFile() {
  const items = await db.items.orderBy('updatedAt').reverse().toArray()
  const rows = items.map((item) => ({
    名稱: item.name || '',
    分類: item.category || '',
    數量: item.quantity ?? '',
    單位: item.unit || '',
    存放位置: item.location || '',
    到期日: formatDate(item.expiryDate),
    使用中: item.inUse ? '是' : '否',
    備註: item.notes || '',
    建立日期: formatDate(item.createdAt),
    最後更新: formatDate(item.updatedAt)
  }))

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '庫存清單')

  const colWidths = [
    { wch: 20 }, { wch: 10 }, { wch: 6 }, { wch: 6 }, { wch: 10 },
    { wch: 12 }, { wch: 6 }, { wch: 30 }, { wch: 12 }, { wch: 12 }
  ]
  worksheet['!cols'] = colWidths

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  XLSX.writeFile(workbook, `inventory-${stamp}.xlsx`)
  return { count: items.length }
}
