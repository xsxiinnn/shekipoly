"use client";

import { useState } from "react";

import type { AdminReferenceData, AdminReportFilters } from "./types";

export function AdminFilters({
  references,
  filters,
  reportsMode = false,
  photoOnly = false,
}: {
  references: AdminReferenceData;
  filters: AdminReportFilters;
  reportsMode?: boolean;
  photoOnly?: boolean;
}) {
  const [groupId, setGroupId] = useState(filters.teamGroupId?.toString() ?? "");
  const [zoneId, setZoneId] = useState(filters.zoneId?.toString() ?? "");
  const [teamId, setTeamId] = useState(filters.teamId ?? "");
  const selectedGroupId = Number(groupId);
  const selectedZoneId = Number(zoneId);
  const zones = references.zones.filter(
    (zone) => !groupId || zone.teamGroupId === selectedGroupId,
  );
  const allowedZoneIds = new Set(zones.map((zone) => zone.id));
  const teams = references.teams.filter((team) =>
    zoneId
      ? team.zoneId === selectedZoneId
      : !groupId || allowedZoneIds.has(team.zoneId),
  );

  return (
    <form method="get" className="grid gap-3 rounded-2xl border border-border bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-xs font-bold text-muted">
        資料類型
        <select name="scope" defaultValue={filters.dataScope} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground">
          <option value="official">正式</option>
          <option value="test">預上線測試</option>
          <option value="all">全部</option>
        </select>
      </label>
      <label className="text-xs font-bold text-muted">
        活動週次
        <select name="week" defaultValue={filters.activityWeek ?? ""} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground">
          <option value="">全活動</option>
          {[1, 2, 3, 4, 5, 6].map((week) => <option key={week} value={week}>W{week}</option>)}
        </select>
      </label>
      <label className="text-xs font-bold text-muted">
        團隊
        <select
          name="group"
          value={groupId}
          onChange={(event) => {
            setGroupId(event.target.value);
            setZoneId("");
            setTeamId("");
          }}
          className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground"
        >
          <option value="">全部團隊</option>
          {references.teamGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
      </label>
      <label className="text-xs font-bold text-muted">
        區
        <select
          name="zone"
          value={zoneId}
          onChange={(event) => {
            setZoneId(event.target.value);
            setTeamId("");
          }}
          className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground"
        >
          <option value="">全部區</option>
          {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
        </select>
      </label>
      <label className="text-xs font-bold text-muted">
        小組
        <select name="team" value={teamId} onChange={(event) => setTeamId(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground">
          <option value="">全部小組</option>
          {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select>
      </label>

      {reportsMode ? (
        <>
          <label className="text-xs font-bold text-muted">
            任務
            <select name="mission" defaultValue={filters.missionId ?? ""} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground">
              <option value="">全部任務</option>
              {references.missions.map((mission) => <option key={mission.id} value={mission.id}>{mission.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-muted">
            3×5
            <select name="is3x5" defaultValue={filters.is3x5 === null ? "" : String(filters.is3x5)} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground">
              <option value="">全部</option><option value="true">是</option><option value="false">否</option>
            </select>
          </label>
          {photoOnly ? (
            <input type="hidden" name="photo" value="true" />
          ) : (
            <label className="text-xs font-bold text-muted">
              照片
              <select name="photo" defaultValue={filters.hasPhoto === null ? "" : String(filters.hasPhoto)} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground">
                <option value="">全部</option><option value="true">有照片</option><option value="false">無照片</option>
              </select>
            </label>
          )}
          <label className="text-xs font-bold text-muted">
            狀態
            <select name="status" defaultValue={filters.status ?? ""} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground">
              <option value="">全部</option><option value="active">Active</option><option value="void">Void</option>
            </select>
          </label>
          <label className="text-xs font-bold text-muted">
            照片顯示
            <select name="visibility" defaultValue={filters.photoVisibility ?? ""} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground">
              <option value="">全部</option><option value="visible">Visible</option><option value="hidden">Hidden</option>
            </select>
          </label>
          <label className="text-xs font-bold text-muted sm:col-span-2">
            搜尋回報者、朋友稱呼或小組
            <input name="search" defaultValue={filters.search ?? ""} maxLength={100} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground" />
          </label>
        </>
      ) : null}

      <div className="flex items-end gap-2">
        <button type="submit" className="h-10 flex-1 rounded-xl bg-foreground px-4 text-sm font-black text-white">套用篩選</button>
        <a href={reportsMode ? "/admin/reports" : "/admin"} className="flex h-10 items-center rounded-xl border border-border px-3 text-sm font-bold">清除</a>
      </div>
    </form>
  );
}
