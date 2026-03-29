import { prisma } from "../../../../lib/prisma.js";
import { NotFoundError, ConflictError } from "../../../config/errors.js";
import type { CreateCategoryInput, UpdateCategoryInput } from "./category.schema.js";

// Selección reutilizable — no exponer campos innecesarios
const categorySelect = {
  id: true, name: true, slug: true,
  description: true, imageUrl: true, parentId: true,
  createdAt: true,
  children: { select: { id: true, name: true, slug: true } },
} as const;

export async function getAllCategories() {
  // Solo las categorías raíz con sus hijos — árbol de 2 niveles
  return prisma.category.findMany({
    where:   { parentId: null },
    select:  categorySelect,
    orderBy: { name: "asc" },
  });
}

export async function getCategoryBySlug(slug: string) {
  const category = await prisma.category.findUnique({
    where:  { slug },
    select: { ...categorySelect,
      _count: { select: { products: { where: { published: true } } } },
    },
  });
  if (!category) throw new NotFoundError("Categoría no encontrada", "CATEGORY_NOT_FOUND");
  return category;
}

export async function createCategory(input: CreateCategoryInput) {
  const exists = await prisma.category.findUnique({ where: { slug: input.slug } });
  if (exists) throw new ConflictError("Ya existe una categoría con ese slug", "SLUG_TAKEN");

  return prisma.category.create({ data: input, select: categorySelect });
}

export async function updateCategory(id: number, input: UpdateCategoryInput) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw new NotFoundError("Categoría no encontrada", "CATEGORY_NOT_FOUND");

  if (input.slug && input.slug !== category.slug) {
    const slugExists = await prisma.category.findUnique({ where: { slug: input.slug } });
    if (slugExists) throw new ConflictError("Slug ya en uso", "SLUG_TAKEN");
  }

  return prisma.category.update({ where: { id }, data: input, select: categorySelect });
}

export async function deleteCategory(id: number) {
  const category = await prisma.category.findUnique({
    where:   { id },
    include: { _count: { select: { products: true } } },
  });
  if (!category) throw new NotFoundError("Categoría no encontrada", "CATEGORY_NOT_FOUND");

  // No borrar si tiene productos — evita huérfanos en la DB
  if (category._count.products > 0) {
    throw new ConflictError(
      `No puedes borrar una categoría con ${category._count.products} producto(s)`,
      "CATEGORY_HAS_PRODUCTS"
    );
  }

  await prisma.category.delete({ where: { id } });
}