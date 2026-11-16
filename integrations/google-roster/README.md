# Google 預約名單

已建立的名單：https://docs.google.com/spreadsheets/d/1H7DY6K7UYVS862WpMMw6gS92Rq3USIG1kfd7mKcE3nQ/edit

Apps Script 是此表的綁定專案；原始碼在 Code.gs，權限清單在 appsscript.json。僅限目前文件、外部請求、背景排程，不要求全Drive讀寫。ROSTER_TOKEN 應保存於指令碼屬性，與Vercel production的 BOOKING_ROSTER_TOKEN相符；不要放進儲存格、程式碼、repo或文件。

每5分鐘自動同步已啟用。2026-11-16 正式驗收：透過真實LINE登入建立專用測試預約、由老師核准改期後，10:38 的自動同步已在名單顯示新日期、時間及通知狀態；並非手動覆寫名單。可在「同步狀態」查看最後成功時間，或使用試算表「預約名單」選單手動更新／停用。重新安裝時需於Apps Script執行enableAutoSync並授權，確認僅有一筆syncBookings時鐘排程與下一輪執行成功；不得將已完成授權的正式環境當作未安裝重新設定。

同步內容為未移除預約的日期、時間、姓名、LINE顯示名稱、分鐘、費用、預約狀態、通知狀態、預約編號及更新時間。不包含問題、簽名、LINE user ID或任何登入憑證。取消及到期保留狀態；已移除不輸出。試算表是核對用副本，排程與核准仍以網站後台為準。同步失敗顯示錯誤並保留先前成功時間與資料；沒有公開名單API。
