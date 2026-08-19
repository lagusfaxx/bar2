import { TablesManager } from "@/components/admin/tables-manager";
import { AdminHeader } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = { title: "Mesas" };

export default async function TablesPage() {
  const [zones, tables] = await Promise.all([
    prisma.posZone.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      include: { _count: { select: { tables: true } } },
    }),
    prisma.posTable.findMany({
      orderBy: [{ position: "asc" }, { number: "asc" }],
      include: {
        zone: { select: { id: true, name: true } },
        _count: { select: { sessions: { where: { status: "OPEN" } } } },
      },
    }),
  ]);

  return (
    <>
      <AdminHeader
        title="Mesas del salón"
        description="Estas son las mesas que los garzones ven en su teléfono para tomar los pedidos."
      />

      <TablesManager
        zones={zones.map((zone) => ({
          id: zone.id,
          name: zone.name,
          color: zone.color,
          active: zone.active,
          tables: zone._count.tables,
        }))}
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
