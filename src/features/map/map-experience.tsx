"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import { getTeamThemeStyle, resolveTeamTheme } from "@/config/team-themes";
import { useStudentShellTheme } from "@/features/theme/use-student-shell-theme";

import type { MapData, MapTeam, MapTeamGroup } from "./types";

const BOARD_SQUARES = [
  31, 32, 33, 34, 35, 36,
  30, 29, 28, 27, 26, 25,
  19, 20, 21, 22, 23, 24,
  18, 17, 16, 15, 14, 13,
  7, 8, 9, 10, 11, 12,
  6, 5, 4, 3, 2, 1,
] as const;

const SPECIAL_SQUARES: Record<number, string> = {
  5: "禱告站",
  9: "相遇站",
  13: "祝福站",
  18: "探訪站",
  23: "故事站",
  28: "烤肉站",
  33: "教會站",
  36: "同行終點",
};

function FlagIcon({ color, label }: { color: string; label: string }) {
  return (
    <svg
      aria-label={label}
      className="h-4 w-3 drop-shadow-sm"
      viewBox="0 0 12 16"
      role="img"
    >
      <path d="M2 1v14" stroke="#42514c" strokeLinecap="round" strokeWidth="1.3" />
      <path d="M2.5 1.5h7.8L8.6 4.3l1.7 2.8H2.5Z" fill={color} />
    </svg>
  );
}

function SquareFlags({ teams }: { teams: MapTeam[] }) {
  const visibleTeams = teams.length > 3 ? teams.slice(0, 2) : teams;
  const hiddenCount = teams.length - visibleTeams.length;

  return (
    <div className="absolute inset-x-0.5 bottom-0.5 flex items-end justify-center gap-px">
      {visibleTeams.map((team, index) => (
        <motion.span
          key={team.id}
          layoutId={`team-flag-${team.id}`}
          initial={{ opacity: 0, y: 5, rotate: -8 }}
          animate={{ opacity: 1, y: index % 2 === 0 ? 0 : -2, rotate: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 25 }}
        >
          <FlagIcon color={team.flagColor} label={`${team.name}旗子`} />
        </motion.span>
      ))}
      {hiddenCount > 0 ? (
        <motion.span
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-0.5 rounded-full bg-foreground px-1 py-0.5 text-[8px] font-black leading-none text-white shadow-sm"
        >
          +{hiddenCount}
        </motion.span>
      ) : null}
    </div>
  );
}

function MapSquare({
  square,
  teams,
  onSelect,
}: {
  square: number;
  teams: MapTeam[];
  onSelect: () => void;
}) {
  const specialLabel = SPECIAL_SQUARES[square];
  const teamDescription = teams.length === 0 ? "沒有小組" : `${teams.length} 個小組`;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`第 ${square} 格${specialLabel ? `，${specialLabel}` : ""}，${teamDescription}`}
      className={`relative aspect-square min-w-0 overflow-hidden rounded-[10px] border text-left shadow-[0_2px_7px_rgba(29,39,36,0.05)] transition-transform active:scale-95 ${
        specialLabel
          ? "border-[#e4ba67] bg-[#fff1cc]"
          : square % 2 === 0
            ? "border-border bg-white"
            : "border-[#d8e9e1] bg-[#eef7f2]"
      }`}
    >
      <span className="absolute left-1 top-0.5 text-[9px] font-black tabular-nums text-foreground/70">
        {String(square).padStart(2, "0")}
      </span>
      {specialLabel ? (
        <span className="absolute inset-x-0 top-[34%] px-0.5 text-center text-[8px] font-black leading-none text-[#8d5d13]">
          {specialLabel}
        </span>
      ) : null}
      {teams.length > 0 ? <SquareFlags teams={teams} /> : null}
    </button>
  );
}

function TeamCard({ team }: { team: MapTeam }) {
  const isFinished = team.currentSquare === 36;

  return (
    <li className="rounded-2xl border border-border bg-surface p-3.5 shadow-[0_5px_18px_rgba(29,39,36,0.04)]">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft">
          <FlagIcon color={team.flagColor} label={`${team.name}旗子`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">{team.name}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-brand">{team.zoneName}</p>
          <p className="mt-0.5 text-xs text-muted">
            {isFinished
              ? "已抵達同行終點"
              : `距離下一格還差 ${team.pointsToNextSquare} 步`}
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-x-3 text-right">
          <div>
            <p className="text-[10px] font-semibold text-muted">累積</p>
            <p className="text-sm font-black tabular-nums text-foreground">{team.totalScore}步</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-muted">目前</p>
            <p className="text-sm font-black tabular-nums text-brand">第{team.currentSquare}格</p>
          </div>
        </div>
      </div>
    </li>
  );
}

function TeamSheet({
  square,
  teams,
  onClose,
}: {
  square: number;
  teams: MapTeam[];
  onClose: () => void;
}) {
  const specialLabel = SPECIAL_SQUARES[square];

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[70] bg-foreground/35 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="square-sheet-title"
        className="absolute inset-x-0 bottom-0 mx-auto max-h-[72dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-surface px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 360, damping: 34 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.15em] text-brand">第 {square} 格</p>
            <h2 id="square-sheet-title" className="mt-1 text-xl font-black">
              {specialLabel ?? "同行路徑"}
            </h2>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label="關閉小組名單"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background text-xl text-muted"
          >
            ×
          </button>
        </div>

        {teams.length > 0 ? (
          <ul className="mt-5 space-y-2">
            {teams.map((team) => (
              <li
                key={team.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-background px-3.5 py-3"
              >
                <FlagIcon color={team.flagColor} label={`${team.name}旗子`} />
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{team.name}</span>
                <span className="text-xs font-semibold tabular-nums text-muted">
                  {team.totalScore} 步
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-5 rounded-2xl bg-background px-4 py-8 text-center text-sm text-muted">
            目前還沒有小組走到這一格
          </div>
        )}
      </motion.section>
    </motion.div>
  );
}

export function MapExperience({ teamGroups, initialTeamGroupId, error }: MapData) {
  const [selectedTeamGroupId, setSelectedTeamGroupId] = useState(initialTeamGroupId);
  const [selectedSquare, setSelectedSquare] = useState<number | null>(null);

  const selectedTeamGroup =
    teamGroups.find((teamGroup) => teamGroup.id === selectedTeamGroupId) ??
    teamGroups[0];
  const selectedTheme = resolveTeamTheme(selectedTeamGroup?.name);
  useStudentShellTheme(selectedTeamGroup?.name);

  const teamsBySquare = useMemo(() => {
    const groupedTeams = new Map<number, MapTeam[]>();
    for (const team of selectedTeamGroup?.teams ?? []) {
      const teams = groupedTeams.get(team.currentSquare) ?? [];
      teams.push(team);
      groupedTeams.set(team.currentSquare, teams);
    }
    return groupedTeams;
  }, [selectedTeamGroup]);

  const handleTeamGroupChange = (teamGroup: MapTeamGroup) => {
    setSelectedTeamGroupId(teamGroup.id);
    setSelectedSquare(null);
  };

  if (!selectedTeamGroup) {
    return (
      <section className="mt-4 rounded-3xl border border-dashed border-border bg-surface px-5 py-12 text-center shadow-sm">
        <p className="text-sm font-black text-foreground">
          {error ? "地圖載入失敗" : "目前還沒有小組開始前進。"}
        </p>
        <p className="mt-2 text-sm leading-6 text-muted">
          {error ?? "完成第一筆關懷回報後，小組旗子就會出現在這裡。"}
        </p>
      </section>
    );
  }

  const selectedSquareTeams =
    selectedSquare === null ? [] : (teamsBySquare.get(selectedSquare) ?? []);

  return (
    <div
      data-team-theme={selectedTheme.slug}
      style={getTeamThemeStyle(selectedTeamGroup.name)}
      className="min-w-0 overflow-x-clip pb-4"
    >
      <header className="pb-4 pt-2 text-team-on-primary">
        <p className="text-xs font-bold tracking-[0.18em]">青年關懷大富翁</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight">同行地圖</h1>
            <p className="mt-1 text-sm text-team-on-primary">每累積 10 步，旗子前進 1 格</p>
          </div>
          <span className="shrink-0 rounded-full border border-team-control-border bg-team-control px-2.5 py-1 text-xs font-bold text-team-control-text">
            36 格
          </span>
        </div>
      </header>

      <div
        role="tablist"
        aria-label="團隊"
        className="grid grid-cols-4 gap-1 rounded-2xl border border-border bg-surface p-1 shadow-sm"
      >
        {teamGroups.map((teamGroup) => {
          const isSelected = teamGroup.id === selectedTeamGroup.id;

          return (
            <button
              key={teamGroup.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => handleTeamGroupChange(teamGroup)}
              className={`relative min-w-0 rounded-xl px-0.5 py-2 text-[11px] font-bold leading-tight ${
                isSelected ? "text-team-control-text" : "text-muted"
              }`}
            >
              {isSelected ? (
                <motion.span
                  layoutId="selected-team-group"
                  className="absolute inset-0 rounded-xl border border-team-control-border bg-team-control ring-2 ring-team-control-border"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
              <span className="relative break-words">{teamGroup.name}</span>
            </button>
          );
        })}
      </div>

      <section aria-label={`${selectedTeamGroup.name}同行地圖`} className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-3 px-0.5 text-team-on-primary">
          <h2 className="text-sm font-black">{selectedTeamGroup.name}</h2>
          <p className="text-xs font-semibold">{selectedTeamGroup.teams.length} 個小組</p>
        </div>
        <div className="grid min-w-0 grid-cols-6 gap-[3px] rounded-2xl bg-border p-[3px] shadow-[0_8px_24px_rgba(29,39,36,0.09)]">
          {BOARD_SQUARES.map((square) => (
            <MapSquare
              key={square}
              square={square}
              teams={teamsBySquare.get(square) ?? []}
              onSelect={() => setSelectedSquare(square)}
            />
          ))}
        </div>
        <p className="mt-2 px-1 text-center text-[11px] font-semibold text-team-on-primary">
          點選格子查看所在小組
        </p>
      </section>

      <section className="mt-7" aria-labelledby="team-progress-title">
        <div className="mb-3 flex items-end justify-between gap-3 text-team-on-primary">
          <div>
            <p className="text-xs font-bold tracking-[0.14em]">小組進度</p>
            <h2 id="team-progress-title" className="mt-0.5 text-xl font-black">
              {selectedTeamGroup.name}小組
            </h2>
          </div>
          <span className="text-xs font-semibold">累積／目前格</span>
        </div>

        {selectedTeamGroup.teams.length > 0 ? (
          <ul className="space-y-2.5">
            {[...selectedTeamGroup.teams]
              .sort((first, second) => second.totalScore - first.totalScore)
              .map((team) => (
                <TeamCard key={team.id} team={team} />
              ))}
          </ul>
        ) : (
          <div className="rounded-3xl border border-dashed border-border bg-surface px-5 py-10 text-center text-sm text-muted shadow-sm">
            目前還沒有小組開始前進。
          </div>
        )}
      </section>

      <AnimatePresence>
        {selectedSquare !== null ? (
          <TeamSheet
            key="team-sheet"
            square={selectedSquare}
            teams={selectedSquareTeams}
            onClose={() => setSelectedSquare(null)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
