export type ReportMission = {
  id: number;
  name: string;
  description: string;
  baseScore: number;
};

export type ReportProfile = {
  name: string;
  teamGroupName: string;
  zoneName: string;
  teamName: string;
};

export type ReportPageData = {
  profile: ReportProfile | null;
  missions: ReportMission[];
  error: string | null;
  errorKind: "config" | "session" | "profile" | "missions" | "unknown" | null;
};

export type ReportSuccess = {
  reportId: string;
  missionName: string;
  is3x5: boolean;
  missionScore: number;
  photoBonus: number;
  hasPhoto: boolean;
  rawScore: number;
  acceptedScore: number;
  activityWeek: number;
  teamName: string;
  teamWeeklyScore: number;
  teamTotalScore: number;
  currentSquare: number;
  stepsToNextSquare: number;
};

export type ReportActionState = {
  status: "idle" | "error" | "success";
  message: string | null;
  fieldErrors?: Partial<
    Record<"friendAlias" | "is3x5" | "missionId" | "story" | "photo", string>
  >;
  result?: ReportSuccess;
};
