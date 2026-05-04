import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/firebase/session";
import { DashboardShell } from "./dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = cookieStore.get("__session")?.value;

  if (!session) redirect("/login?redirect=/dashboard");

  const user = await verifySession(session);

  if (!user || user.role !== "business") redirect("/login?redirect=/dashboard");

  return <DashboardShell user={user}>{children}</DashboardShell>;
}
