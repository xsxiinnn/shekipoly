export type MapTeam = {
  id: string;
  name: string;
  zoneName: string;
  totalScore: number;
  currentSquare: number;
  pointsToNextSquare: number;
  flagColor: string;
};

export type MapTeamGroup = {
  id: number;
  name: string;
  teams: MapTeam[];
};

export type MapData = {
  teamGroups: MapTeamGroup[];
  initialTeamGroupId: number | null;
  error: string | null;
};
