export type PhotoWallTeamGroup = {
  id: number;
  name: string;
};

export type PhotoWallItem = {
  id: string;
  signedUrl: string;
  teamGroupName: string;
  zoneName: string;
  teamName: string;
  reporterName: string;
  missionName: string;
  dateLabel: string;
  story: string | null;
};

export type PhotoWallData = {
  teamGroups: PhotoWallTeamGroup[];
  selectedTeamGroupId: number | null;
  items: PhotoWallItem[];
  page: number;
  hasMore: boolean;
  error: string | null;
  errorKind: "session" | "profile" | "config" | "unknown" | null;
  isTestMode: boolean;
};
