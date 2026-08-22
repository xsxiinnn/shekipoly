import { getAdminIdentity } from "@/features/admin/auth";
import { createReportsCsv, getReportsCsvFilename } from "@/features/admin/csv";
import { getAdminReportRowsForExport } from "@/features/admin/data";
import { parseAdminReportFilters } from "@/features/admin/filters";

export async function GET(request: Request) {
  if (!(await getAdminIdentity())) return new Response("Forbidden", { status: 403 });
  try {
    const url = new URL(request.url);
    const filters = parseAdminReportFilters(Object.fromEntries(url.searchParams));
    const rows = await getAdminReportRowsForExport(filters);
    const csv = createReportsCsv(rows);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${getReportsCsvFilename(filters.activityWeek)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Unable to export admin reports CSV", error);
    return new Response("Unable to export reports", { status: 500 });
  }
}
