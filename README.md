# 生活庫存管理 PWA

管理家中日用品（醬油、沐浴乳、化妝品、面紙、零食…）的庫存、到期日、位置與圖片。

- 📱 **手機優先** — 設計為加到主畫面即可像 App 使用
- 🔒 **本地優先** — 資料只存在你的瀏覽器，不上傳任何雲端
- 💾 **可匯出可還原** — JSON（完整含圖片）/ Excel（給家人看）
- 📷 **拍照 / 上傳** — 自動壓縮，省空間
- ⚡ **離線可用** — PWA service worker 預先快取
- 💰 **完全免費** — 開源、可部署到 GitHub Pages

## 快速開始

```bash
npm install
npm run dev          # 開發模式 http://localhost:5173
npm run build        # 編譯到 dist/
npm run preview      # 預覽 build 結果
```

## 在手機上測試

### 方法 1：本機 Wi-Fi
1. 電腦執行 `npm run dev`
2. 看終端機輸出的 Network IP（例 `http://192.168.x.x:5173`）
3. 手機連同個 Wi-Fi，瀏覽器打開該網址
4. Chrome / Safari 選單 → 「加入主畫面」

### 方法 2：部署到 GitHub Pages（推薦，可隨時用）
1. 把專案推到 GitHub repo（公開或私人皆可）
2. 在 repo 加入 `.github/workflows/deploy.yml`（範例如下）
3. Settings → Pages → Source 選 GitHub Actions
4. 推完 main 後自動部署，會給你一個 `https://你的帳號.github.io/repo名/` 網址
5. 手機開該網址 → 加到主畫面

範例 workflow：

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push: { branches: [main] }
permissions: { contents: read, pages: write, id-token: write }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages }
    steps:
      - uses: actions/deploy-pages@v4
```

## 資料安全（重要）

App 採用 **多層備援**：

| 層級 | 機制 |
|---|---|
| L1 | IndexedDB 即時寫入 |
| L2 | 累積 20 筆變更或 7 天未備份 → 開啟時顯示橫幅提醒 |
| L3 | 設定頁一鍵匯出 JSON（完整還原用，含圖片） |
| L4 | 設定頁一鍵匯出 Excel（純文字，給家人看） |
| L5 | 隨時可選 JSON 還原 |

**強烈建議**：
- 第一次使用前先到設定頁試一次「匯出」與「還原」流程
- 每月匯出一份 JSON 存到 Google Drive / iCloud / Email 自己

## 專案結構

```
src/
├── main.jsx              入口 + HashRouter
├── App.jsx               路由、底部 nav、header
├── db/
│   └── inventoryDB.js    Dexie schema + CRUD
├── pages/
│   ├── ListPage.jsx      列表 + 搜尋 + 篩選 + 排序
│   ├── ItemFormPage.jsx  新增 / 編輯
│   ├── ItemDetailPage.jsx 詳情頁（含數量增減、使用中切換）
│   └── SettingsPage.jsx  匯出匯入、清除
├── components/
│   ├── ImagePicker.jsx   拍照 / 相簿選圖
│   ├── ItemThumb.jsx     縮圖（自動處理 Blob URL）
│   └── BackupBanner.jsx  備份提醒橫幅
├── utils/
│   ├── imageCompress.js  Canvas 壓縮（最大邊 800px, JPEG 80%）
│   ├── exportJson.js
│   ├── exportExcel.js
│   ├── importJson.js
│   └── format.js         日期、到期天數
└── styles/index.css      Tailwind
```

## 技術棧

- **React 18** + **Vite 5** — 前端框架與構建
- **React Router 6** — 用 HashRouter，部署到子路徑也能跑
- **Dexie 4** — IndexedDB 封裝
- **dexie-react-hooks** — `useLiveQuery` 自動響應資料變化
- **Tailwind CSS 3** — UI
- **vite-plugin-pwa** — 自動產生 service worker 與 manifest
- **SheetJS (xlsx)** — Excel 匯出

## 未來可擴充

- 到期日 / 即將用完瀏覽器通知
- 多 Profile（家用 / 公司）
- 條碼掃描自動帶入商品名稱（OpenFoodFacts API）
- Google Drive 自動備份（使用者自己的帳號，零成本）

## 授權

MIT
