import { redirect } from "next/navigation";
import { requireRole } from "@/server/auth";
import { getPlayerById } from "@/server/queries";

// หน้านักเตะรวมเข้ากับหน้าสโมสรแล้ว — เก็บไว้ให้ลิงก์เดิมยังพาไปถูกที่
export default async function PlayersAdminPage({ searchParams }: PageProps<"/admin/players">) {
  await requireRole("ADMIN");
  const sp = await searchParams;

  if (typeof sp.edit === "string") {
    const player = await getPlayerById(sp.edit);
    if (player) redirect(`/admin/teams/${player.teamId}?player=${player.id}`);
  }
  if (typeof sp.team === "string") redirect(`/admin/teams/${sp.team}`);
  if (typeof sp.q === "string" && sp.q.trim()) redirect(`/admin/teams?q=${encodeURIComponent(sp.q.trim())}`);
  redirect("/admin/teams");
}
