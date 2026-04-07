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
  const admin = await prisma.user.upsert({
    where:  { email: "admin@example.com" },
    update: {},
    create: {
      email:    "admin@example.com",
      name:     "Admin",
      password: await bcrypt.hash("admin123", 10),
      role:     "ADMIN",
    },
  });

  await prisma.user.upsert({
    where:  { email: "user@example.com" },
    update: {},
    create: {
      email:    "user@example.com",
      name:     "Usuario Demo",
      password: await bcrypt.hash("user123", 10),
      role:     "USER",
    },
  });

  // ── Categorías ─────────────────────────────────────────────
  const electronics = await prisma.category.upsert({
    where:  { slug: "electronica" },
    update: {},
    create: { name: "Electrónica", slug: "electronica", description: "Gadgets y tecnología" },
  });

  const clothing = await prisma.category.upsert({
    where:  { slug: "ropa" },
    update: {},
    create: { name: "Ropa", slug: "ropa", description: "Moda y accesorios" },
  });

  // Subcategorías
  const phones = await prisma.category.upsert({
    where:  { slug: "telefonos" },
    update: {},
    create: { name: "Teléfonos", slug: "telefonos", parentId: electronics.id },
  });

  const shirts = await prisma.category.upsert({
    where:  { slug: "camisetas" },
    update: {},
    create: { name: "Camisetas", slug: "camisetas", parentId: clothing.id },
  });

  // ── Tags ───────────────────────────────────────────────────
  const tagNuevo  = await prisma.tag.upsert({ where: { slug: "nuevo"  }, update: {}, create: { name: "Nuevo",  slug: "nuevo"  } });
  const tagOferta = await prisma.tag.upsert({ where: { slug: "oferta" }, update: {}, create: { name: "Oferta", slug: "oferta" } });

  // ── Productos ──────────────────────────────────────────────
  const phone = await prisma.product.upsert({
    where:  { slug: "smartphone-x100" },
    update: {},
    create: {
      name:         "Smartphone X100",
      slug:         "smartphone-x100",
      description:  "El mejor smartphone de gama media con cámara de 108MP",
      price:        599.99,
      comparePrice: 799.99,
      published:    true,
      categoryId:   phones.id,
      tags:         { connect: [{ id: tagNuevo.id }, { id: tagOferta.id }] },
      images: {
        create: [
          { url: "https://placehold.co/800x800?text=X100+Front", alt: "Smartphone X100 frontal", position: 0 },
          { url: "https://placehold.co/800x800?text=X100+Back",  alt: "Smartphone X100 trasera", position: 1 },
        ],
      },
      variants: {
        create: [
          { sku: "X100-128GB-NEGRO", name: "128GB / Negro", stock: 15 },
          { sku: "X100-256GB-NEGRO", name: "256GB / Negro", stock: 8, price: 649.99 },
          { sku: "X100-128GB-BLANCO", name: "128GB / Blanco", stock: 10 },
        ],
      },
    },
  });

  await prisma.product.upsert({
    where:  { slug: "camiseta-basica-blanca" },
    update: {},
    create: {
      name:       "Camiseta básica blanca",
      slug:       "camiseta-basica-blanca",
      description: "100% algodón, corte regular",
      price:      19.99,
      published:  true,
      categoryId: shirts.id,
      tags:       { connect: [{ id: tagNuevo.id }] },
      images: {
        create: [
          { url: "https://placehold.co/800x800?text=Camiseta", alt: "Camiseta blanca", position: 0 },
        ],
      },
      variants: {
        create: [
          { sku: "CAM-BLANCA-S",  name: "S",  stock: 20 },
          { sku: "CAM-BLANCA-M",  name: "M",  stock: 30 },
          { sku: "CAM-BLANCA-L",  name: "L",  stock: 25 },
          { sku: "CAM-BLANCA-XL", name: "XL", stock: 15 },
        ],
      },
    },
  });

  // Producto borrador — no visible en la tienda pública
  await prisma.product.upsert({
    where:  { slug: "auriculares-pro" },
    update: {},
    create: {
      name:       "Auriculares Pro",
      slug:       "auriculares-pro",
      price:      89.99,
      published:  false,   // borrador
      categoryId: electronics.id,
    },
  });

  // ── Descuentos ─────────────────────────────────────────────
  await prisma.discount.upsert({
    where:  { code: "VERANO20" },
    update: {},
    create: {
      code:      "VERANO20",
      type:      "PERCENT",
      value:     20,
      minAmount: 50,
      maxUses:   100,
      active:    true,
    },
  });

  await prisma.discount.upsert({
    where:  { code: "DESCUENTO10" },
    update: {},
    create: {
      code:      "DESCUENTO10",
      type:      "FIXED",
      value:     10,
      minAmount: 30,
      active:    true,
    },
  });

  await prisma.storeSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      whatsappNumber: null,   // el admin lo configura desde el panel
      storeName: 'Mi Tienda',
    },
  })

  console.log("✅  Seed completo:");
  console.log("   Categorías: Electrónica, Ropa + subcategorías");
  console.log("   Productos:  Smartphone X100, Camiseta básica, Auriculares (borrador)");
  console.log("   Descuentos: VERANO20 (20%), DESCUENTO10 ($10 fijo)");
  console.log("   Usuarios:   admin@example.com / admin123");
  console.log("              user@example.com  / user123");
  console.log('   Configuración: StoreSettings creado (whatsappNumber vacío)')
}

main()
  .catch((e) => { console.error("❌  Seed falló:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
