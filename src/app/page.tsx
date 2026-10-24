import { AlfredApp } from "@/components/alfred-app";
import { getFoundationStatus } from "@/services/foundation-status";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authenticate, csrfToken } from "@/services/auth-service";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();
  const session = await authenticate(new Request("http://127.0.0.1", { headers: { cookie: cookieStore.toString() } })).catch(() => null);
  if (!session) redirect("/login");
  return <AlfredApp initialStatus={await getFoundationStatus()} user={session.user} csrfToken={csrfToken(session.token)} />;
}
