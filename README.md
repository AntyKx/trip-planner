# Trip Planner

旅遊行程規劃 APP 原型（Next.js 16 App Router + TypeScript + Tailwind + Prisma），部署在 Vercel。

**正式站**：https://trip-planner-flax-ten.vercel.app

## 功能

- **行程管理**：建立/刪除行程，每個行程分成多天，用頁籤切換（不會整頁往下疊）
- **每日時間軸**：拖曳排序景點/餐廳，卡片圖片貼齊左邊、內容截斷保持列表緊湊
- **地圖**：Google Maps 顯示當天路線與地點，跟時間軸頁籤同步（只顯示目前選到的那天）
- **自動優化路線**：用 Google Directions `optimizeWaypoints` 依開車距離重排一天內的景點順序
- **景點/餐廳搜尋**：`/explore` 頁面串 Google Places API (New) Text Search，可依國家（TW/JP）搜尋、直接加入行程
- **景點詳情預覽**：點景點名稱開啟詳情視窗（評分、電話、官網、營業時間、Google 評論），時間軸項目跟搜尋結果都共用同一個元件；搜尋結果的詳情視窗底部有「加為餐廳/景點」按鈕
- **導航連結**：每個項目卡片有 🧭 圖示，點下去直接開 Google Maps 導航
- **天氣預報**：用 Open-Meteo（免金鑰）依每天第一個地點座標顯示天氣徽章（僅支援未來 ~16 天內）
- **封面圖片**：行程可設定封面圖——從已收集的地點照片挑、貼網址，或從手機相簿直接上傳（Vercel Blob 前端直傳）
- **多人協作名單**：可用 email 邀請協作者並設定角色，但目前沒有登入系統，僅管理「誰有存取權」的名單，不做實際權限限制

## 技術棧與架構重點

- **框架**：Next.js 16 App Router，Server Components + Server Actions 為主
- **資料庫**：Neon Postgres（Vercel Marketplace 整合），Prisma ORM。Schema 用 `onDelete: Cascade` 讓刪除行程/項目時自動清掉底下的 TripDay/Item/Route/Collaborator（Place、User 是共用資料，不會被連帶刪除）
- **地圖 / 景點資料**：Google Maps JavaScript API + Places API (New)。**API 金鑰有 HTTP Referrer 限制**，所以所有 Places 呼叫（搜尋、詳情）都從瀏覽器端直接打，不走 Server Action——伺服器對伺服器的請求沒有 Referer，會被擋
- **照片上傳**：Vercel Blob，用 `@vercel/blob/client` 前端直傳（`src/app/api/upload/route.ts` 只負責發 token）。**不能**透過 Server Action 上傳大檔案，因為 Vercel Function 有 4.5MB 的硬性請求大小限制，且無法用任何設定調高
- **狀態同步**：`TripDayBoard` 元件統一管理「目前選到第幾天」，同時餵給時間軸和地圖，避免兩者分開各自選天數而不同步
- **圖示與配色**：lucide-react 圖示（不用 emoji 當操作按鈕，emoji 在不同裝置顯示不一致），主色 teal

## 已知限制

- 沒有登入系統，`Collaborator` 只是名單管理，不做實際權限檢查
- 只有 `provider: "google"` 的地點能看到即時詳情（電話/評論/營業時間），HotPepper、TDX 等其他 provider 目前只存基本資料
- Prisma 透過 D1（如果之後改部署到 Cloudflare）不支援 transaction，目前 Postgres 上沒有這個限制

## 本機開發

```bash
npm install
npm run seed   # 建立示範行程資料（重複執行是安全的，不會清掉既有資料）
npm run dev
```

需要 `.env.local`：`DATABASE_URL`、`DATABASE_URL_UNPOOLED`、`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`、`BLOB_READ_WRITE_TOKEN`（`vercel env pull .env.local` 可以直接拉正式環境變數）。

## 部署

```bash
npx vercel --prod
```

Prisma Client 會透過 `postinstall` hook 自動重新產生，確保 Vercel 的 build cache 不會用到舊的 schema。
