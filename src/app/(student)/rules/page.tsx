import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = {
  title: "遊戲規則",
};

export default function RulesPage() {
  return <EmptyState title="遊戲規則" description="開始遊戲前，先了解活動方式與注意事項。" />;
}
