import { Prisma } from "../../../../generated/prisma/client.js";
import { prisma } from "../../../../lib/prisma.js";
import { NotFoundError, ConflictError, ValidationError } from "../../../config/errors.js";
import type {
  CreateProductInput, UpdateProductInput,
  CreateVariantInput, UpdateVariantInput,
  CreateImageInput,   ProductFilters,
} from "./product.schema.js";

import { deleteFromCloudinary } from "../../../services/cloudinary.service.js";

// ── Selección reutilizable ─────────────────────────────────
// Lo que devuelve la tienda pública — sin campos internos
const publicProductSelect = {
  id: true, name: true, slug: true,
  description: true, price: true, comparePrice: true,
  published: true, createdAt: true, updatedAt: true,
  category: { select: { id: true, name: true, slug: true } },
  variants: {
    select: { id: true, sku: true, name: true, stock: true, price: true },
    orderBy: { id: "asc" as const },
  },
  images: {
    select: { id: true, url: true, publicId: true, alt: true, position: true },
    orderBy: { position: "asc" as const },
  },
  tags: { select: { id: true, name: true, slug: true } },
  _count: { select: { variants: true } },
} satisfies Prisma.ProductSelect;

// ── Helpers ────────────────────────────────────────────────
// Construye el WHERE de Prisma desde los filtros del query
function buildWhereClause(filters: ProductFilters, adminMode = false): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};

  // Públicos solo ven productos publicados — admin ve todo
  if (!adminMode) where.published = true;
  if (filters.published !== undefined && adminMode) where.published = filters.published;

  if (filters.q) {
    where.OR = [
      { name:        { contains: filters.q, mode: "insensitive" } },
      { description: { contains: filters.q, mode: "insensitive" } },
    ];
  }

  if (filters.category) where.category = { slug: filters.category };
  if (filters.tag)      where.tags     = { some: { slug: filters.tag } };

  if (filters.minPrice || filters.maxPrice) {
    where.price = {
      ...(filters.minPrice && { gte: filters.minPrice }),
      ...(filters.maxPrice && { lte: filters.maxPrice }),
    };
  }

  // inStock: al menos una variante con stock > 0
  // Si no tiene variantes, el producto siempre aparece
  if (filters.inStock) {
    where.OR = [
      ...((where.OR as Prisma.ProductWhereInput[]) ?? []),
      { variants: { none: {} } },
      { variants: { some: { stock: { gt: 0 } } } },
    ];
  }

  return where;
}

function buildOrderBy(orderBy: ProductFilters["orderBy"]): Prisma.ProductOrderByWithRelationInput {
  const map: Record<string, Prisma.ProductOrderByWithRelationInput> = {
    price_asc:  { price: "asc"  },
    price_desc: { price: "desc" },
    newest:     { createdAt: "desc" },
    name:       { name: "asc"  },
  };
  return map[orderBy] ?? { createdAt: "desc" };
}

// Busca o crea tags por nombre — los tags se crean al vuelo
async function upsertTags(tagNames: string[]) {
  return Promise.all(
    tagNames.map((name) =>
      prisma.tag.upsert({
        where:  { slug: name.toLowerCase().replace(/\s+/g, "-") },
        update: {},
        create: {
          name,
          slug: name.toLowerCase().replace(/\s+/g, "-"),
        },
      })
    )
  );
}

// ── Servicio público (tienda) ──────────────────────────────
export async function getProducts(filters: ProductFilters) {
  const where   = buildWhereClause(filters);
  const orderBy = buildOrderBy(filters.orderBy);
  const skip    = (filters.page - 1) * filters.limit;

  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({
      where, orderBy, skip,
      take:   filters.limit,
      select: publicProductSelect,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items,
    pagination: {
      total,
      page:       filters.page,
      limit:      filters.limit,
      totalPages: Math.ceil(total / filters.limit),
      hasNext:    filters.page < Math.ceil(total / filters.limit),
      hasPrev:    filters.page > 1,
    },
  };
}

export async function getProductBySlug(slug: string) {
  const product = await prisma.product.findUnique({
    where:  { slug, published: true },
    select: publicProductSelect,
  });
  if (!product) throw new NotFoundError("Producto no encontrado", "PRODUCT_NOT_FOUND");
  return product;
}

// ── Servicio admin ─────────────────────────────────────────
export async function getAdminProducts(filters: ProductFilters) {
  const where   = buildWhereClause(filters, true);  // adminMode: ve borradores también
  const orderBy = buildOrderBy(filters.orderBy);
  const skip    = (filters.page - 1) * filters.limit;

  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({
      where, orderBy, skip,
      take:   filters.limit,
      select: publicProductSelect,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items,
    pagination: {
      total,
      page:       filters.page,
      limit:      filters.limit,
      totalPages: Math.ceil(total / filters.limit),
      hasNext:    filters.page < Math.ceil(total / filters.limit),
      hasPrev:    filters.page > 1,
    },
  };
}

export async function createProduct(input: CreateProductInput) {
  const slugExists = await prisma.product.findUnique({ where: { slug: input.slug } });
  if (slugExists) throw new ConflictError("Ya existe un producto con ese slug", "SLUG_TAKEN");

  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) throw new NotFoundError("Categoría no encontrada", "CATEGORY_NOT_FOUND");

  // comparePrice debe ser mayor que price para tener sentido
  if (input.comparePrice && input.comparePrice <= input.price) {
    throw new ValidationError(
      "El precio de comparación debe ser mayor al precio actual",
      "INVALID_COMPARE_PRICE"
    );
  }

  const tags = input.tags ? await upsertTags(input.tags) : [];

  return prisma.product.create({
    data: {
      name:         input.name,
      slug:         input.slug,
      description:  input.description,
      price:        input.price,
      comparePrice: input.comparePrice,
      published:    input.published ?? false,
      categoryId:   input.categoryId,
      tags:         { connect: tags.map((t) => ({ id: t.id })) },
      variants: input.variants
        ? { create: input.variants }
        : undefined,
      images: input.images
        ? { create: input.images }
        : undefined,
    },
    select: publicProductSelect,
  });
}

export async function updateProduct(id: number, input: UpdateProductInput) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new NotFoundError("Producto no encontrado", "PRODUCT_NOT_FOUND");

  if (input.slug && input.slug !== product.slug) {
    const slugExists = await prisma.product.findUnique({ where: { slug: input.slug } });
    if (slugExists) throw new ConflictError("Slug ya en uso", "SLUG_TAKEN");
  }

  if (input.comparePrice && input.price && input.comparePrice <= input.price) {
    throw new ValidationError(
      "El precio de comparación debe ser mayor al precio actual",
      "INVALID_COMPARE_PRICE"
    );
  }

  const tags = input.tags ? await upsertTags(input.tags) : undefined;

  return prisma.product.update({
    where: { id },
    data: {
      ...input,
      tags: tags ? { set: tags.map((t) => ({ id: t.id })) } : undefined,
    },
    select: publicProductSelect,
  });
}

export async function deleteProduct(id: number) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new NotFoundError("Producto no encontrado", "PRODUCT_NOT_FOUND");

  // Cascade en el schema borra variantes e imágenes automáticamente
  await prisma.product.delete({ where: { id } });
}

// ── Variantes ──────────────────────────────────────────────
export async function addVariant(productId: number, input: CreateVariantInput) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new NotFoundError("Producto no encontrado", "PRODUCT_NOT_FOUND");

  const skuExists = await prisma.variant.findUnique({ where: { sku: input.sku } });
  if (skuExists) throw new ConflictError("El SKU ya está en uso", "SKU_TAKEN");

  return prisma.variant.create({
    data: { ...input, productId },
  });
}

export async function updateVariant(variantId: number, input: UpdateVariantInput) {
  const variant = await prisma.variant.findUnique({ where: { id: variantId } });
  if (!variant) throw new NotFoundError("Variante no encontrada", "VARIANT_NOT_FOUND");

  if (input.sku && input.sku !== variant.sku) {
    const skuExists = await prisma.variant.findUnique({ where: { sku: input.sku } });
    if (skuExists) throw new ConflictError("El SKU ya está en uso", "SKU_TAKEN");
  }

  return prisma.variant.update({ where: { id: variantId }, data: input });
}

export async function deleteVariant(variantId: number) {
  const variant = await prisma.variant.findUnique({ where: { id: variantId } });
  if (!variant) throw new NotFoundError("Variante no encontrada", "VARIANT_NOT_FOUND");
  await prisma.variant.delete({ where: { id: variantId } });
}

// ── Imágenes ───────────────────────────────────────────────
export async function addImage(productId: number, input: CreateImageInput) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new NotFoundError("Producto no encontrado", "PRODUCT_NOT_FOUND");

  return prisma.productImage.create({
    data: { ...input, productId },
  });
}

export async function deleteImage(imageId: number) {
  const image = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!image) throw new NotFoundError("Imagen no encontrada", "IMAGE_NOT_FOUND");

  if (image.publicId) {
    await deleteFromCloudinary(image.publicId);
  }

  await prisma.productImage.delete({ where: { id: imageId } });
}

export async function reorderImages(productId: number, imageIds: number[]) {
  const product = await prisma.product.findUnique({
    where:   { id: productId },
    include: { images: true },
  });
  if (!product) throw new NotFoundError("Producto no encontrado", "PRODUCT_NOT_FOUND");

  // Actualiza la posición de cada imagen según el orden del array
  await prisma.$transaction(
    imageIds.map((id, index) =>
      prisma.productImage.update({
        where: { id },
        data:  { position: index },
      })
    )
  );
}