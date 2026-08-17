export type MapTeam = {
  id: string;
  name: string;
  totalScore: number;
  currentSquare: number;
  pointsToNextSquare: number;
  flagColor: string;
};

export type MapAgeGroup = {
  id: number;
  name: string;
  teams: MapTeam[];
};

export type MapData = {
  ageGroups: MapAgeGroup[];
  initialAgeGroupId: number;
};
