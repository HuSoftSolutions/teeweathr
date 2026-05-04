import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/firebase/session";
import { AdminShell } from "./admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = cookieStore.get("__session")?.value;

  if (!session) redirect("/login?redirect=/admin");

  const user = await verifySession(session);

  if (!user || user.role !== "admin") redirect("/login?redirect=/admin");

  return <AdminShell user={user}>{children}</AdminShell>;
}
