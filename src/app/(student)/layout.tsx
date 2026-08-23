import { BottomNavigation } from "@/components/bottom-navigation";

export default function StudentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-md overflow-x-clip bg-background shadow-[0_0_40px_rgba(29,39,36,0.08)]">
      <main className="px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        {children}
      </main>
      <BottomNavigation />
    </div>
  );
}
