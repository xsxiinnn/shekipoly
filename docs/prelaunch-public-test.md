# 預上線公開測試 Checklist

測試前確認 Vercel Production 已設定 `PRELAUNCH_TEST_MODE=true`、`PRELAUNCH_TEST_WEEK=1`，頁面顯示「🧪 測試模式」。所有測試資料都應標記為 TEST。

## Onboarding

- [ ] 第一次從公開網址進站會進入 onboarding
- [ ] 可依序選姓名、團隊、區、小組並完成設定
- [ ] 關閉 browser 再開仍保留 session/profile
- [ ] 神榮耀團隊 → 6區可看到品凡小組
- [ ] 洞見團隊 → 9區不再看到品凡小組

## Report

- [ ] 一般朋友可選任務並成功回報
- [ ] 3×5 朋友任務分數正確加倍
- [ ] story 可儲存
- [ ] 照片可上傳且 Photo Bonus 為 +3（不因 3×5 加倍）
- [ ] 照片 consent 流程正常
- [ ] 成功畫面標示「測試回報」
- [ ] 同一小組測試週所有 active report 都完整計入，沒有每週上限

## Map

- [ ] 頂端顯示測試模式 banner
- [ ] 只顯示測試步數，旗子依每 10 步前進
- [ ] 品凡小組只出現在神榮耀團隊
- [ ] 團隊、小組與格數正確

## Photo Wall

- [ ] 頂端顯示測試模式 banner
- [ ] 測試照片會出現，正式照片不混入
- [ ] 團隊分類正確
- [ ] lightbox 顯示照片與 story
- [ ] hidden / void 照片不顯示

## Mobile Photos

- [ ] iPhone Safari：HEIC/HEIF 圖庫照片可預覽、轉檔、上傳
- [ ] iPhone 直式照片方向正確
- [ ] iPhone 橫式照片方向正確
- [ ] Android Chrome 可拍照與從相簿上傳

## Admin

- [ ] 儀表板預設「正式」且不受測試資料影響
- [ ] 切換「測試」可看到測試 KPI / progress
- [ ] 回報頁顯示 TEST badge
- [ ] void 測試 report 後，只重算同 team/week 的測試額度
- [ ] 隱藏／重新顯示測試照片正常，分數不變
- [ ] CSV 依正式／測試 filter 匯出

## 關閉測試模式

- [ ] 移除或關閉兩個 PRELAUNCH env 並重新部署
- [ ] 8/31 前 submit 回到「目前不在活動回報期間」
- [ ] 依 `docs/prelaunch-test-cleanup.md` 人工清理測試資料
- [ ] 8/31 正式第一筆從 official 0 步開始
