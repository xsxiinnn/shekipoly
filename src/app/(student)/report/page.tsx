import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = {
  title: "任務回報",
};

export default function ReportPage() {
  return <EmptyState title="任務回報" description="完成任務後，在這裡回報成果。" />;
}
