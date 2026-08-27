import { createClient } from "@supabase/supabase-js";

const execute = process.argv.includes("--execute");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type TestReportInventoryRow = {
  id: string;
  team_id: string;
  photo_path: string | null;
};

async function loadAllTestReports() {
  const rows: TestReportInventoryRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("reports")
      .select("id, team_id, photo_path")
      .eq("is_prelaunch_test", true)
      .order("id")
      .range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return rows;
}

const reports = await loadAllTestReports();

const reportIds = reports.map((report) => report.id);
const teamIds = new Set(reports.map((report) => report.team_id));
const photoPaths = reports.flatMap((report) =>
  typeof report.photo_path === "string" ? [report.photo_path] : [],
);

async function countExistingObjects(paths: string[]) {
  const namesByFolder = new Map<string, Set<string>>();
  for (const path of paths) {
    const separator = path.indexOf("/");
    if (separator <= 0) continue;
    const folder = path.slice(0, separator);
    const name = path.slice(separator + 1);
    const names = namesByFolder.get(folder) ?? new Set<string>();
    names.add(name);
    namesByFolder.set(folder, names);
  }

  let existing = 0;
  for (const [folder, targetNames] of namesByFolder) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.storage
        .from("mission-photos")
        .list(folder, { limit: 1000, offset });
      if (error) throw error;
      existing += (data ?? []).filter((object) => targetNames.has(object.name)).length;
      if ((data ?? []).length < 1000) break;
    }
  }
  return existing;
}

const existingStorageObjects = await countExistingObjects(photoPaths);

let auditCount = 0;
for (let offset = 0; offset < reportIds.length; offset += 200) {
  const batch = reportIds.slice(offset, offset + 200);
  const { count, error } = await supabase
    .from("admin_audit_logs")
    .select("id", { count: "exact", head: true })
    .in("target_report_id", batch);
  if (error) throw error;
  auditCount += count ?? 0;
}

console.log(execute ? "PRELAUNCH CLEANUP EXECUTE" : "PRELAUNCH CLEANUP DRY RUN");
console.log(`TEST reports: ${reportIds.length}`);
console.log(`TEST photos referenced: ${photoPaths.length}`);
console.log(`Teams involved: ${teamIds.size}`);
console.log(`Storage objects found: ${existingStorageObjects}`);
console.log(`Related audit logs: ${auditCount}`);
console.log("Profiles: preserved");

if (!execute) {
  console.log("No data changed. Re-run with --execute only after reviewing these counts.");
  process.exit(0);
}

for (let offset = 0; offset < photoPaths.length; offset += 100) {
  const batch = photoPaths.slice(offset, offset + 100);
  const { error } = await supabase.storage.from("mission-photos").remove(batch);
  if (error) throw new Error(`Storage cleanup stopped before database deletion: ${error.message}`);
}

for (let offset = 0; offset < reportIds.length; offset += 200) {
  const batch = reportIds.slice(offset, offset + 200);
  const { error } = await supabase
    .from("admin_audit_logs")
    .delete()
    .in("target_report_id", batch);
  if (error) throw error;
}

const { error: reportsError } = await supabase
  .from("reports")
  .delete()
  .eq("is_prelaunch_test", true);
if (reportsError) throw reportsError;

const { error: progressError } = await supabase
  .from("team_progress")
  .delete()
  .eq("is_prelaunch_test", true);
if (progressError) throw progressError;

const remainingTestPhotoObjects = await countExistingObjects(photoPaths);

const [testReports, officialReports, officialProgress, profiles, admins, teams, missions] =
  await Promise.all([
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("is_prelaunch_test", true),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("is_prelaunch_test", false),
    supabase.from("team_progress").select("accepted_score").eq("is_prelaunch_test", false),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("admins").select("user_id", { count: "exact", head: true }),
    supabase.from("teams").select("id", { count: "exact", head: true }),
    supabase.from("missions").select("id", { count: "exact", head: true }),
  ]);
const validationError = testReports.error ?? officialReports.error ?? officialProgress.error
  ?? profiles.error ?? admins.error ?? teams.error ?? missions.error;
if (validationError) throw validationError;

console.log("Cleanup validation");
console.log(`Official reports count: ${officialReports.count ?? 0}`);
console.log(`Official accepted total: ${(officialProgress.data ?? []).reduce((sum, row) => sum + row.accepted_score, 0)}`);
console.log(`Test reports count: ${testReports.count ?? 0}`);
console.log(`Test photos remaining in Storage: ${remainingTestPhotoObjects}`);
console.log(`Profiles retained: ${profiles.count ?? 0}`);
console.log(`Admins retained: ${admins.count ?? 0}`);
console.log(`Teams retained: ${teams.count ?? 0}`);
console.log(`Missions retained: ${missions.count ?? 0}`);

if ((testReports.count ?? 0) !== 0 || remainingTestPhotoObjects !== 0) {
  throw new Error("Prelaunch cleanup validation failed; review the counts above.");
}
