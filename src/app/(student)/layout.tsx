import { BottomNavigation } from "@/components/bottom-navigation";
import { getTeamThemeStyle, resolveTeamTheme } from "@/config/team-themes";
import { getCurrentProfileSummary } from "@/features/profile/data";

export default async function StudentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { profile } = await getCurrentProfileSummary();
  const theme = resolveTeamTheme(profile?.teamGroupName);

  return (
    <div
      data-team-theme={theme.slug}
      data-student-shell
      style={getTeamThemeStyle(profile?.teamGroupName)}
      className="mx-auto min-h-dvh w-full max-w-md overflow-x-clip bg-team-page shadow-[0_0_40px_rgba(29,39,36,0.08)]"
    >
      <main className="px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        {children}
      </main>
      <BottomNavigation />
    </div>
  );
}
