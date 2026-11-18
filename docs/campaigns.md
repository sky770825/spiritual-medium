# 老師後台分眾群發

入口：`/admin/calendar.html` 的「分眾群發」，共用老師管理登入 Cookie。

預設以台北時間2026-10-15起「已觀測到的加入好友日期」篩選。日期來源只接受有正確LINE簽章的follow事件且`follow.isUnblocked === false`；解除封鎖不視為新加入。已知封鎖和日期未知者排除、UID去重。沒有觀測紀錄時顯示0並阻止群發；不把預約日期、首次互動或匯入當日當作加入日期。

歷史10/15～啟用記錄前的逐人加入日期無法由目前資料還原。LINE subscriptionPeriod API只有day_7/day_30/day_90/day_180/day_365，不等同任意日曆日期。官方後台查核時沒有受眾包。本功能不宣稱歷史名單完整，也不把最近30天混充10/15起的受眾。

好友事件接收端`/api/line/audience-webhook`只記錄UID、加入日期及封鎖狀態，不回覆訊息或保存聊天內容。需在官方帳號Messaging API設為該正式URL並啟用Webhook。既有歡迎與關鍵字原生回覆保持原設定。連線檢查可以由LINE平台發送空events驗證簽章與private Blob寫入，沒有訊息推播。

訊息是限制長度的Flex標題／內容，可附固定預約連結；先預覽受眾數及訊息、最後確認才呼叫multicast。單次最多500人，超出時要求縮小範圍，不默默截斷。可明確選擇已綁定的單人測試對象，測試與正式紀錄分開。測試也會消耗LINE額度。

Private Blob `booking/audience-v1.json`與預約狀態隔離，共用ETag CAS。草稿不可修改收件人或內容，15分鐘有效；傳送租約120秒、固定retry key、首次發送後23小時內可安全重試。同一內容及收件人24小時內沿用原紀錄，避免重建重送。LINE 200或帶accepted request ID的409標為已受理，不表示送達或已讀。網路失敗須使用原紀錄重試，不另建群發。

發送前讀LINE用量，額度不足或用量無法核對時不發送。此為查詢當下數值，其他系統同時發送可能改變額度；LINE仍是最終用量判定者。介面不回傳群發UID或憑證；同源POST及登入驗證，Webhook簽章驗證原始bytes（Vercel lazy getter不可先JSON解析）。

驗證：`npm test` 67項；`tests/dev-audience-server.js`提供隔離示範，內建假LINE回應且無production憑證，不會發真訊息。正式LINE格式驗證與空事件連線驗證需另核對實際結果。未經指定訊息及對象，不對真客戶發送驗收群發。

官方依據：https://developers.line.biz/en/reference/messaging-api/nojs/（follow、demographic filters、multicast、retry key及webhook endpoint test）；https://raw.githubusercontent.com/vercel/vercel/main/packages/node/src/serverless-functions/helpers.ts（lazy body getter與原始stream還原）。
