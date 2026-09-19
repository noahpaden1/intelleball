import type { Metadata } from "next";
import { DashboardScreen } from "@/components/dashboard/DashboardScreen";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <DashboardScreen />;
}
