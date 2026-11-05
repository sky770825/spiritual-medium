# 預約行事曆設計 — 2026-11-05

依使用者要求自主規劃、設計與部署，沿用深藍／金色品牌與完整名稱「宇宙玉皇大帝原始大天尊無上至尊」。

研究：OpenSalon 2026-10-21 commit 72cc34a（https://github.com/clawnify/OpenSalon/commit/72cc34a758c95be94ece086480dc4006928374a8），及 Cal.com / cal.diy 2026-10-30 commit a5ee96f。只參考日期、時段、封鎖與狀態流程，自行實作，未複製 AGPL 原始碼。

採用既有靜態 HTML 與 Vercel Functions + private Vercel Blob。比較過 Cal.com 全套部署（需另外的帳號與資料庫）及僅前端日曆（無法跨裝置防撞）；選擇小型服務端排程以保留現有網站並支援真實防撞。

預設週一至週六 14:00–18:00、19:00–21:00，週日休息；每場10/20/30分鐘，300/600/900元；每場後10分鐘緩衝，提前1小時、未來28天可約。這些時段是本次規劃預設，可由管理員修改，並非已知使用者的實際營業時間。

客戶：選時長 → 月曆 → 可用時段 → 填姓名／LINE名稱／問題／同意與簽名 → 伺服器原子預約 → 待確認紀錄 → LINE聯絡與下載ICS。申請時暫留24小時（不晚於開場）；老師確認後正式保留，未確認到期釋出。

管理：HTTPOnly 8小時登入、日曆與當日時間軸、確認／取消／開始／完成、倒數以排定結束時間計算（到排定時間才允許開始，開始晚不自動延長），剩餘5分鐘與到時提示；可封鎖休息與休假、設定每週開放時段。不能自動中斷外部LINE通話。

儲存：客戶資訊只存在private Blob，公開API只傳可用時段，get useCache:false保證讀最新版本；寫入以ETag ifMatch保證衝突重試後重新判斷可約，首次建立禁止覆寫。API有伺服器輸入驗證、請求去重、摘要不注入HTML、簡單限流、SameSite cookie及來源檢查。

驗收：時長／價格／緩衝／跨日與無效日期／提前預約／封鎖／到期／取消釋出／狀態／併發防撞測試；正式站重複時段併發測試後取消測試預約；手機390px無橫向溢出；所有API不可快取。

## 2026-11-05 更新：直播避開與LINE內通知
使用者指定20:00–22:00直播不排預約，22:00後恢復，23:00為最後可開始時段，午夜停止。已將既有開放日改為14–18、19–20、22–24，伺服器latestStartTime=23:00，服務與緩衝須在24:00前結束。週日仍沿用休息。正式配置已更新且三種時長驗證通過，沒有受影響的既有預約。

使用者已核准建立LINE Login channel2012387050，LIFF2012387050-7GZmUUJ4（openid、chat_message.write，未要求profile/email），連結原官方帳號。LIFF endpoint為/reserve.html。LINE內一對一來源、具傳送權限，且客戶明確勾選目前位於@740ihcar官方聊天室及同意傳送後，預約登記後將最小通知送到來源聊天室，不含問題或簽名。SDK不能辨識utou對方是否為官方帳號，依客戶明確確認；不得宣稱已技術驗證來源對方。失敗不取消已登記預約，提供手動摘要與重試。外部瀏覽器不自動傳送。

LINE channel仍為Developing；發布確認提示不能切回開發模式，已另請使用者確認。未核准正式發布前，官方選單維持原網站URL，不改成尚未對客戶開放的LIFF URL。尚未完成真實手機官方聊天室送訊實測，不以純函式測試冒稱端到端傳訊成功。

## 2026-11-05 後台行程檢視

電腦與手機使用同一個登入後台及 API；電腦顯示主行程與側欄，手機改為直式卡片。全天行程按時間列出 00:00–24:00 的預約、空檔、緩衝、私人封鎖及直播時段；七日總覽方便跨日檢視。卡片包含起訖、分鐘、狀態、問題摘要，展開可看完整內容。提供待確認篩選、搜尋、下一場與複製當日時間表（不含私人問題、聯絡資訊或簽名）。

驗證：18 項 Node 測試通過；本機示範涵蓋長問題、長姓名、已取消／到期、進行中及跨日預約。桌面 1280px 與手機 390px 實際瀏覽驗證；示範資料僅在 tests/dev-server.js 的 BOOKING_UI_FIXTURES=1 啟用，部署排除 tests，正式資料未加入示範預約。

## 2026-11-05 身分與審核結果通知

新預約可勾選綁定LINE，前端只傳ID token，伺服器呼叫LINE verify endpoint，核對iss/aud/exp/sub後保存user ID和同意時間，不保存token。未登入／未同意仍可人工預約，不猜測舊紀錄收件人。老師核准／取消先存預約及通知事件，再用官方Messaging API推播最小時間摘要。CAS mutation中沒有外部發訊；租約避免並行，固定UUID避免不確定結果重送重複，23小時後轉人工，開始交流後舊的未發通知標示superseded。接受成功只標示LINE已受理。失敗可由後台重試；沒有背景自動重送。已取消／到期／完成可移除並還原，仍保留紀錄。這不是資料永久清除功能。

正式設定缺口查核：2026-11-05 本機匯出的 LINE_CHANNEL_ACCESS_TOKEN 為空，但正式runtime顯示有設定；新增管理者 line-health 動作呼叫 bot/info，正式結果 line_http_401。以正式驗證為準，不能因匯出空白便斷言runtime不存在。既有Messaging API channel有既發憑證，尚待使用者同意安全存入Vercel。LINE Login應用仍Developing，發布的不可逆平台確認也待回答。程式部署不代表此兩項已啟用，手機客戶端實際通知尚未驗證。

參考LINE官方文件：https://developers.line.biz/en/docs/line-login/verify-id-token/ 、https://developers.line.biz/en/reference/messaging-api/nojs/#send-push-message 。

### 正式啟用更新（2026-11-05）

使用者回覆「你自己執行」授權執行兩項待確認步驟。LINE Login頻道已Published；官方帳號既有Channel access token已核對bot/info=200且basicId正確，安全更新Vercel production的敏感環境變數。未重新簽發。部署dpl_bTvHadthmkSoQX5F6iJEWXPdMfzY READY；正式後台line-health=ready，UI顯示官方LINE通知連線正常。三格選單20474766的A預約查詢連結已改https://liff.line.me/2012387050-7GZmUUJ4；B、C仍原文字功能。API預設六格狀態另查核。正式手機LINE登入／申請／核准實收尚未觀察，不聲稱端到端傳送完成。暫存憑證已刪除，不存repo或文件。

發訊權限補驗：正式line-health額外呼叫LINE validate/push（只驗證、不傳訊），結果ready；部署dpl_3fck7iLmLBv6inz6hVMkQnTd4J4A。另查API預設richmenu回403，不能以本次查核宣稱default404；Official Account Manager目前顯示的三格選單及LIFF連結已讀回確認。
