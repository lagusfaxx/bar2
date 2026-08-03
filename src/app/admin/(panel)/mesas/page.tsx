import { TablesManager } from "@/components/admin/tables-manager";
import { AdminHeader } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = { title: "Mesas" };

export default async function TablesPage() {
  const tables = await prisma.posTable.findMany({
    orderBy: [{ position: "asc" }, { number: "asc" }],
    include: {
      _count: { select: { sessions: { where: { status: "OPEN" } } } },
    },
  });

  return (
    <>
      <AdminHeader
        title="Mesas"
        description="El salón tal como lo ven los garzones en su teléfono."
      />

      <TablesManager
        tables={tables.map((table) => ({
          id: table.id,
          number: table.number,
          name: table.name,
          zone: table.zone,
          seats: table.seats,
          active: table.active,
          openSessions: table._count.sessions,
        }))}
      />
    </>
  );
}
