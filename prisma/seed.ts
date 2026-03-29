import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import bcrypt from "bcryptjs";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱  Seeding database...");

  // ── Usuarios ──────────────────────────────────────────────
  // upsert: si ya existe el email, actualiza — nunca duplica
  const adminPassword = await bcrypt.hash("admin123", 10);
  const userPassword  = await bcrypt.hash("user123", 10);

  const admin = await prisma.user.upsert({
    where:  { email: "admin@example.com" },
    update: {},
    create: {
      email:    "admin@example.com",
      name:     "Admin",
      password: adminPassword,
      role:     "ADMIN",
    },
  });

  const user = await prisma.user.upsert({
    where:  { email: "user@example.com" },
    update: {},
    create: {
      email:    "user@example.com",
      name:     "Usuario Demo",
      password: userPassword,
      role:     "USER",
    },
  });

  // ── Posts de ejemplo ──────────────────────────────────────
  await prisma.post.createMany({
    skipDuplicates: true,
    data: [
      { title: "Primer post",    content: "Contenido de ejemplo",  published: true,  authorId: admin.id },
      { title: "Post borrador",  content: "Aún no publicado",      published: false, authorId: admin.id },
      { title: "Post del user",  content: "Escrito por el usuario", published: true, authorId: user.id  },
    ],
  });

  console.log("✅  Seed completo:");
  console.log(`   admin@example.com  /  admin123  (ADMIN)`);
  console.log(`   user@example.com   /  user123   (USER)`);
}

main()
  .catch((e) => {
    console.error("❌  Seed falló:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());