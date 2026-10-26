import "server-only";
import { db } from "@/server/db";

export async function listAuditLogs({ page = 1, perPage = 50 } = {}) {
  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { user: { select: { name: true, role: true } } },
    }),
    db.auditLog.count(),
  ]);
  return { logs, total, pages: Math.ceil(total / perPage) };
}

export async function recentAuditLogs(take = 8) {
  return db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { user: { select: { name: true } } },
  });
}
