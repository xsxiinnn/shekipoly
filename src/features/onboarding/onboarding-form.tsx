"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { getTeamThemeStyle, resolveTeamTheme } from "@/config/team-themes";
import { createClient } from "@/lib/supabase/client";

import { saveProfile } from "./actions";
import type { OnboardingData } from "./types";

const fieldClassName =
  "h-12 w-full min-w-0 rounded-2xl border border-border bg-white px-4 text-base text-foreground outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-[#eef1ee] disabled:text-muted";

const initialActionState = { message: null };

export function OnboardingForm({
  teamGroups,
  zones,
  teams,
  profile,
  hasSession: initialHasSession,
}: Omit<OnboardingData, "error">) {
  const router = useRouter();
  const authStarted = useRef(false);
  const [authStatus, setAuthStatus] = useState<"loading" | "ready" | "error">(
    initialHasSession ? "ready" : "loading",
  );
  const [authError, setAuthError] = useState<string | null>(null);
  const profileTeam = teams.find((team) => team.id === profile?.teamId);
  const profileZone = zones.find((zone) => zone.id === profileTeam?.zoneId);
  const [selectedTeamGroupId, setSelectedTeamGroupId] = useState(
    profileZone ? String(profileZone.teamGroupId) : "",
  );
  const [selectedZoneId, setSelectedZoneId] = useState(
    profileZone ? String(profileZone.id) : "",
  );
  const [selectedTeamId, setSelectedTeamId] = useState(profile?.teamId ?? "");
  const [state, formAction, isPending] = useActionState(
    saveProfile,
    initialActionState,
  );

  useEffect(() => {
    if (initialHasSession || authStarted.current) {
      return;
    }

    authStarted.current = true;
    const createAnonymousSession = async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.signInAnonymously();

        if (error) {
          throw error;
        }

        setAuthStatus("ready");
        router.refresh();
      } catch (error) {
        console.error("Unable to create anonymous session", error);
        setAuthError("目前無法建立使用者識別，請稍後重新整理再試。");
        setAuthStatus("error");
      }
    };

    void createAnonymousSession();
  }, [initialHasSession, router]);

  const availableZones = useMemo(() => {
    if (!selectedTeamGroupId) return [];
    return zones.filter(
      (zone) => String(zone.teamGroupId) === selectedTeamGroupId,
    );
  }, [selectedTeamGroupId, zones]);

  const availableTeams = useMemo(() => {
    if (!selectedTeamGroupId || !selectedZoneId) return [];

    return teams.filter((team) => String(team.zoneId) === selectedZoneId);
  }, [selectedTeamGroupId, selectedZoneId, teams]);

  const handleTeamGroupChange = (value: string) => {
    setSelectedTeamGroupId(value);
    setSelectedZoneId("");
    setSelectedTeamId("");
  };

  const handleZoneChange = (value: string) => {
    setSelectedZoneId(value);
    setSelectedTeamId("");
  };

  const isFormReady =
    authStatus === "ready" &&
    selectedTeamGroupId !== "" &&
    selectedZoneId !== "" &&
    selectedTeamId !== "";

  const selectedTeamGroup = teamGroups.find(
    (teamGroup) => String(teamGroup.id) === selectedTeamGroupId,
  );
  const selectedTheme = resolveTeamTheme(selectedTeamGroup?.name);

  return (
    <main
      data-team-theme={selectedTheme.slug}
      style={getTeamThemeStyle(selectedTeamGroup?.name)}
      className="mx-auto min-h-dvh w-full max-w-md overflow-x-clip bg-team-page px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-team-on-primary shadow-[0_0_40px_rgba(29,39,36,0.08)] transition-colors duration-300"
    >
      <header>
        <div className="flex size-12 items-center justify-center rounded-2xl bg-team-on-primary/15 text-xl font-black shadow-[0_8px_20px_rgba(29,39,36,0.14)]">
          走
        </div>
        <p className="mt-6 text-xs font-bold tracking-[0.18em]">青年關懷大富翁</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">
          {profile ? "修改我的資料" : "先認識你一下"}
        </h1>
        <p className="mt-3 max-w-sm text-sm leading-6 text-team-on-primary/75">
          {profile
            ? "選擇不同團隊時，主視覺會立即跟著切換。"
            : "完成基本資料後，就可以開始參與任務與查看小組進度。"}
        </p>
      </header>

      <form
        action={formAction}
        className="mt-7 space-y-5 rounded-[28px] bg-surface p-5 text-team-text-primary shadow-[0_12px_32px_rgba(29,39,36,0.15)]"
      >
      <div>
        <label htmlFor="name" className="mb-2 block text-sm font-bold">
          姓名
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={80}
          autoComplete="name"
          defaultValue={profile?.name ?? ""}
          placeholder="請輸入你的姓名"
          aria-describedby={state.fieldErrors?.name ? "name-error" : undefined}
          className={fieldClassName}
        />
        {state.fieldErrors?.name ? (
          <p id="name-error" className="mt-1.5 text-xs font-semibold text-red-600">
            {state.fieldErrors.name}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="team_group_id" className="mb-2 block text-sm font-bold">
          團隊
        </label>
        <select
          id="team_group_id"
          name="team_group_id"
          required
          value={selectedTeamGroupId}
          onChange={(event) => handleTeamGroupChange(event.target.value)}
          className={fieldClassName}
        >
          <option value="">請選擇團隊</option>
          {teamGroups.map((teamGroup) => (
            <option key={teamGroup.id} value={teamGroup.id}>
              {teamGroup.name}
            </option>
          ))}
        </select>
        {state.fieldErrors?.teamGroupId ? (
          <p className="mt-1.5 text-xs font-semibold text-red-600">
            {state.fieldErrors.teamGroupId}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="zone_id" className="mb-2 block text-sm font-bold">
          區
        </label>
        <select
          id="zone_id"
          name="zone_id"
          required
          disabled={!selectedTeamGroupId || availableZones.length === 0}
          value={selectedZoneId}
          onChange={(event) => handleZoneChange(event.target.value)}
          className={fieldClassName}
        >
          <option value="">
            {selectedTeamGroupId ? "請選擇區" : "請先選擇團隊"}
          </option>
          {availableZones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.name}
            </option>
          ))}
        </select>
        {selectedTeamGroupId && availableZones.length === 0 ? (
          <p className="mt-1.5 text-xs font-semibold text-amber-700">
            這個團隊目前尚未設定區。
          </p>
        ) : null}
        {state.fieldErrors?.zoneId ? (
          <p className="mt-1.5 text-xs font-semibold text-red-600">
            {state.fieldErrors.zoneId}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="team_id" className="mb-2 block text-sm font-bold">
          小組
        </label>
        <select
          id="team_id"
          name="team_id"
          required
          disabled={!selectedZoneId || availableTeams.length === 0}
          value={selectedTeamId}
          onChange={(event) => setSelectedTeamId(event.target.value)}
          className={fieldClassName}
        >
          <option value="">
            {selectedZoneId ? "請選擇小組" : "請先選擇區"}
          </option>
          {availableTeams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
        {selectedZoneId && availableTeams.length === 0 ? (
          <p className="mt-1.5 text-xs font-semibold text-amber-700">
            這個區目前尚未設定小組。
          </p>
        ) : null}
        {state.fieldErrors?.teamId ? (
          <p className="mt-1.5 text-xs font-semibold text-red-600">
            {state.fieldErrors.teamId}
          </p>
        ) : null}
      </div>

      {authStatus === "loading" ? (
        <div className="flex items-center gap-2 rounded-2xl bg-brand-soft px-4 py-3 text-sm font-semibold text-brand">
          <span className="size-4 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
          正在建立安全識別…
        </div>
      ) : null}

      {authError ? (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {authError}
        </p>
      ) : null}

      {state.message ? (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
        >
          {state.message}
        </p>
      ) : null}

      <div className="space-y-2 pt-2">
        <motion.button
          type="submit"
          disabled={!isFormReady || isPending}
          whileTap={isFormReady ? { scale: 0.98 } : undefined}
          className="flex h-13 w-full items-center justify-center rounded-2xl border-2 border-team-control-border bg-team-control px-5 text-base font-black text-team-control-text shadow-[0_8px_20px_rgba(29,39,36,0.16)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {isPending ? "儲存中…" : profile ? "儲存修改" : "完成設定"}
        </motion.button>
        {profile ? (
          <Link
            href="/report"
            className="flex h-11 w-full items-center justify-center rounded-2xl text-sm font-bold text-muted"
          >
            取消修改
          </Link>
        ) : null}
      </div>
      </form>
    </main>
  );
}
