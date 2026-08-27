# 預上線測試資料清理

這個流程只處理 `reports.is_prelaunch_test = true`、其引用的 Storage 照片，以及測試用 `team_progress`。不會刪除正式 reports、profiles、Auth users、admins、team hierarchy、missions、schema 或 migrations。

## 執行前

1. 在 Vercel Production 移除 `PRELAUNCH_TEST_MODE` 與 `PRELAUNCH_TEST_WEEK`，或將 mode 設為 `false`，再重新部署。
2. 確認目前 shell 指向正確的 Production Supabase project。
3. 在 SQL Editor 只讀確認範圍：

```sql
select count(*) as test_reports,
       count(*) filter (where photo_path is not null) as test_photos
from public.reports
where is_prelaunch_test = true;

select count(*) as official_reports
from public.reports
where is_prelaunch_test = false;
```

4. 備份或匯出測試紀錄（若同工需要留存）。

## 執行

使用 server-only service role key。預設只做 dry run，列出 TEST reports、照片、涉及小組、Storage objects 與 audit logs 數量，不修改資料。

```bash
npm run cleanup:prelaunch
```

確認數量後，才使用顯式 execute：

```bash
npm run cleanup:prelaunch -- --execute
```

Execute 會先刪除測試 report 引用的 Storage objects；Storage 全部成功後，依序刪除相關 audit logs、TEST reports 與 test progress rows。任一步失敗即停止，不會以 `is_prelaunch_test=false` 為刪除目標。Profiles 與 Auth identities 預設保留。

腳本使用目前 shell / `.env.local` 可用的 server credentials。不要把 service role key 寫入文件、source code 或 `NEXT_PUBLIC_` 變數。不要用 `db reset`。

## 驗收

```sql
select count(*) from public.reports where is_prelaunch_test = true;
select count(*) from public.team_progress where is_prelaunch_test = true;
select coalesce(sum(accepted_score), 0)
from public.team_progress
where is_prelaunch_test = false;
```

第一、二個結果應為 `0`。若正式活動尚未開始且沒有正式資料，第三個結果也應為 `0`。再人工確認正式 Map 全部在起點、正式 Photo Wall 無測試照片、Admin「正式」KPI 為 0，且 admin account、團隊資料與 6 個 missions 仍存在。
