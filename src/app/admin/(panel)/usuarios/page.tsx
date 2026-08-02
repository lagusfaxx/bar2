import { redirect } from "next/navigation";

import { UsersManager } from "@/components/admin/users-manager";
import { AdminHeader } from "@/components/admin/ui";
import { getPanelSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Usuarios" };

export default async function AdminUsuariosPage() {
  const session = await getPanelSession();

  // Solo un administrador gestiona cuentas del panel.
  if (session?.role !== "ADMIN") {
    redirect("/admin");
  }

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  return (
    <>
      <AdminHeader
        title="Usuarios del panel"
        description="Administradores, editores y equipo de sala con acceso a la app de BarzuCard."
      />

      <UsersManager users={users} currentUserId={session.userId} />
    </>
  );
}
