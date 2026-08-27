# Prelaunch → Production 切換

切換目標：保留 profiles/session，清除所有預上線活動資料，讓 8/31 正式 reports、Map 與 Photo Wall 從零開始。

## 第一次部署測試模式

1. 先確認 migration，只套用尚未部署的 `20260826000000_rename_prelaunch_scope_and_harden_photos.sql`：

   ```bash
   npx supabase migration list
   npx supabase db push --dry-run
   npx supabase db push
   ```

2. 再部署應用程式。這個順序可避免新程式在欄位 rename 前查詢 `is_prelaunch_test`。
3. Vercel Production 設定 `PRELAUNCH_TEST_MODE=true`、`PRELAUNCH_TEST_WEEK=1`，然後 Redeploy。
4. 確認 Report、Map、Photo Wall 顯示預上線測試 banner，Admin 預設仍為正式資料，可切換到「預上線測試」。

## 8/30～8/31 正式切換

1. 通知同工停止內部測試，避免 cleanup 過程又產生新 TEST report。
2. 在 Admin 選擇「預上線測試」，確認 TEST reports 數量與照片數量。
3. 執行 dry run：

   ```bash
   npm run cleanup:prelaunch
   ```

4. 比對預計刪除的 reports、photos、teams involved、Storage objects 與 audit logs 數量。
5. 人工確認目標 Supabase project 正確後執行：

   ```bash
   npm run cleanup:prelaunch -- --execute
   ```

6. 檢查腳本 validation output：TEST reports / photos 為 0，profiles、admins、teams、missions 仍存在。
7. 確認所有 `is_prelaunch_test=false` team progress accepted total 為 0。
8. 確認正式 `/map` 全部在起點，正式 `/photos` 為空。
9. Vercel Production 將 `PRELAUNCH_TEST_MODE` 設為 `false` 或移除；一併移除 `PRELAUNCH_TEST_WEEK`。
10. 重新 Redeploy。只改 Environment Variables 不會回溯更新既有 deployment，必須部署才會套用。
11. 執行 Production smoke test：onboarding/session、report gate、map、photos、admin official filter。
12. 8/31 第一筆正式 report 在 Admin 確認 `is_prelaunch_test=false`，且小組從 0 步開始完整計入。

程式在 `2026-08-31 00:00 Asia/Taipei` 會自動忽略 prelaunch env；第 9–10 步仍應執行，避免留下誤導性的 Production 設定。
