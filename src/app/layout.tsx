import type { Metadata, Viewport } from "next";
import { Suspense } from "react";

import { NavigationFeedback } from "@/components/navigation-feedback";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "青年關懷大富翁",
    template: "%s｜青年關懷大富翁",
  },
  description: "青年關懷大富翁學生行動網站",
};

export const viewport: Viewport = {
  themeColor: "#f7f7f2",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<LayoutProps<"/">>) {
  return (
    <html lang="zh-Hant" className="h-full antialiased">
      <body className="min-h-full">
        {children}
        <Suspense fallback={null}>
          <NavigationFeedback />
        </Suspense>
      </body>
    </html>
  );
}
