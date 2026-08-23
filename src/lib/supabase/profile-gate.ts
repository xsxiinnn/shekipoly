export type ProfileGateDestination = "allow" | "/onboarding" | "/report";

export function getProfileGateDestination(options: {
  hasUser: boolean;
  hasProfile: boolean;
  pathname: string;
  isEditingProfile: boolean;
  method: string;
}): ProfileGateDestination {
  const isOnboarding = options.pathname === "/onboarding";

  if (!options.hasUser) return isOnboarding ? "allow" : "/onboarding";
  if (!options.hasProfile) return isOnboarding ? "allow" : "/onboarding";
  if (
    isOnboarding &&
    !options.isEditingProfile &&
    options.method !== "POST"
  ) return "/report";

  return "allow";
}
