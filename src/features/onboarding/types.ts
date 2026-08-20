export type TeamGroupOption = {
  id: number;
  name: string;
};

export type ZoneOption = {
  id: number;
  name: string;
  teamGroupId: number;
};

export type TeamOption = {
  id: string;
  name: string;
  zoneId: number;
};

export type EditableProfile = {
  name: string;
  teamId: string;
};

export type OnboardingData = {
  teamGroups: TeamGroupOption[];
  zones: ZoneOption[];
  teams: TeamOption[];
  profile: EditableProfile | null;
  hasSession: boolean;
  error: string | null;
};

export type OnboardingActionState = {
  message: string | null;
  fieldErrors?: Partial<Record<"name" | "teamGroupId" | "zoneId" | "teamId", string>>;
};
