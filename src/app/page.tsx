import { AlfredApp } from "@/components/alfred-app";
import { getFoundationStatus } from "@/services/foundation-status";

export const dynamic = "force-dynamic";

export default async function Home() {
  return <AlfredApp initialStatus={await getFoundationStatus()} />;
}
