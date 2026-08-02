/**
 * Crea (o actualiza) un usuario administrador del panel.
 *
 * Pensado para el primer arranque en produccion, donde no se corre el seed:
 *
 *   ADMIN_EMAIL=hola@barzuo.com ADMIN_PASSWORD='...' npm run create:admin
 *
 * Tambien acepta los datos por argumento:
 *
 *   npm run create:admin -- hola@barzuo.com 'MiClave123' 'Nombre Apellido'
 *
 * Si el usuario ya existe, actualiza su contrasena y lo deja como ADMIN
 * activo: sirve tambien para recuperar el acceso.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const [argEmail, argPassword, argName] = process.argv.slice(2);

  const email = (argEmail ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = argPassword ?? process.env.ADMIN_PASSWORD ?? "";
  const name = argName ?? process.env.ADMIN_NAME ?? "Administrador BARZUO";

  if (!email || !email.includes("@")) {
    throw new Error(
      "Indicá un email válido (ADMIN_EMAIL o primer argumento del comando).",
    );
  }

  if (password.length < 8) {
    throw new Error(
      "La contraseña debe tener al menos 8 caracteres (ADMIN_PASSWORD o segundo argumento).",
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name, passwordHash, role: "ADMIN" },
    update: { name, passwordHash, role: "ADMIN", active: true },
  });

  console.log(`\nListo. Administrador disponible:\n  ${user.email}\n`);
  console.log("Ingresá en /admin/login con esa cuenta.\n");
}

main()
  .catch((error) => {
    console.error(`\n${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
