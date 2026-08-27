export type AdminRole = "admin" | "super_admin";

export type AdminIdentity = {
  userId: string;
  email: string | null;
  role: AdminRole;
};

export type AdminReferenceData = {
  teamGroups: Array<{ id: number; name: string }>;
  zones: Array<{ id: number; name: string; teamGroupId: number }>;
  teams: Array<{ id: string; name: string; zoneId: number }>;
  missions: Array<{ id: number; name: string }>;
};

export type AdminKpis = {
  reportCount: number;
  careCount: number;
  threeByFiveCount: number;
  photoCount: number;
  rawSteps: number;
  acceptedSteps: number;
  participatingTeamCount: number;
};

export type AdminTeamGroupOverview = {
  id: number;
  name: string;
  teamCount: number;
  participatingTeamCount: number;
  reportCount: number;
  rawSteps: number;
  acceptedSteps: number;
  photoCount: number;
};

export type AdminTeamProgressRow = {
  teamGroupId: number;
  teamGroupName: string;
  zoneId: number;
  zoneName: string;
  teamId: string;
  teamName: string;
  weeks: [number, number, number, number, number, number];
  rawTotal: number;
  acceptedTotal: number;
  currentSquare: number;
  remainder: number;
};

export type AdminDashboardData = {
  kpis: AdminKpis;
  teamGroups: AdminTeamGroupOverview[];
  progress: AdminTeamProgressRow[];
  references: AdminReferenceData;
  error: string | null;
};

export type AdminReportFilters = {
  dataScope: "official" | "test" | "all";
  activityWeek: number | null;
  teamGroupId: number | null;
  zoneId: number | null;
  teamId: string | null;
  missionId: number | null;
  is3x5: boolean | null;
  hasPhoto: boolean | null;
  status: "active" | "void" | null;
  photoVisibility: "visible" | "hidden" | null;
  search: string | null;
};

export type AdminReportRow = {
  id: string;
  createdAt: string;
  activityWeek: number;
  reporterName: string;
  teamGroupId: number;
  teamGroupName: string;
  zoneId: number;
  zoneName: string;
  teamId: string;
  teamName: string;
  friendAlias: string;
  missionId: number;
  missionName: string;
  is3x5: boolean;
  missionScore: number;
  photoBonus: number;
  rawScore: number;
  acceptedScore: number;
  story: string;
  photoPath: string | null;
  photoVisibility: "visible" | "hidden";
  status: "active" | "void";
  voidedAt: string | null;
  voidReason: string | null;
  signedUrl?: string | null;
  isTest: boolean;
};

export type AdminReportsPageData = {
  items: AdminReportRow[];
  total: number;
  page: number;
  pageSize: number;
  references: AdminReferenceData;
  error: string | null;
};

export type AdminAuditLog = {
  id: number;
  action: string;
  createdAt: string;
  adminUserId: string;
  metadata: Record<string, unknown>;
};

export type AdminReportDetailData = {
  report: AdminReportRow | null;
  auditLogs: AdminAuditLog[];
  error: string | null;
};
