import { DashboardShell } from "@/components/dashboard-shell";

export const metadata = { title: "Dashboard — Thirdwatch" };

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
