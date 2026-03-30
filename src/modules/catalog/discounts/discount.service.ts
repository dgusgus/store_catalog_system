import { prisma } from "../../../../lib/prisma.js";
import { NotFoundError, ConflictError, ValidationError } from "../../../config/errors.js";
import type { CreateDiscountInput, ValidateDiscountInput } from "./discount.schema.js";

export async function createDiscount(input: CreateDiscountInput) {
  const exists = await prisma.discount.findUnique({ where: { code: input.code } });
  if (exists) throw new ConflictError("El código ya existe", "DISCOUNT_CODE_TAKEN");

  if (input.type === "PERCENT" && input.value > 100) {
    throw new ValidationError("Un descuento porcentual no puede superar el 100%", "INVALID_PERCENT");
  }

  return prisma.discount.create({ data: input });
}

export async function getAllDiscounts() {
  return prisma.discount.findMany({ orderBy: { createdAt: "desc" } });
}

export async function toggleDiscount(id: number) {
  const discount = await prisma.discount.findUnique({ where: { id } });
  if (!discount) throw new NotFoundError("Descuento no encontrado", "DISCOUNT_NOT_FOUND");

  return prisma.discount.update({
    where: { id },
    data:  { active: !discount.active },
  });
}

export async function deleteDiscount(id: number) {
  const discount = await prisma.discount.findUnique({ where: { id } });
  if (!discount) throw new NotFoundError("Descuento no encontrado", "DISCOUNT_NOT_FOUND");
  await prisma.discount.delete({ where: { id } });
}

export async function validateDiscount(input: ValidateDiscountInput) {
  const discount = await prisma.discount.findUnique({ where: { code: input.code } });

  // Mismo mensaje para todos los casos — no revelamos si el código existe
  const invalid = new ValidationError("Código de descuento inválido o expirado", "INVALID_DISCOUNT");

  if (!discount || !discount.active)                         throw invalid;
  if (discount.expiresAt && discount.expiresAt < new Date()) throw invalid;
  if (discount.maxUses && discount.usedCount >= discount.maxUses) throw invalid;
  if (discount.minAmount && input.cartAmount < Number(discount.minAmount)) {
    throw new ValidationError(
      `Monto mínimo para este código: $${discount.minAmount}`,
      "BELOW_MIN_AMOUNT"
    );
  }

  // Calcula el monto final según el tipo
  const discountAmount = discount.type === "PERCENT"
    ? (input.cartAmount * Number(discount.value)) / 100
    : Math.min(Number(discount.value), input.cartAmount); // FIXED no puede superar el total

  return {
    valid:          true,
    code:           discount.code,
    type:           discount.type,
    value:          discount.value,
    discountAmount: Math.round(discountAmount * 100) / 100, // redondea a 2 decimales
    finalAmount:    Math.round((input.cartAmount - discountAmount) * 100) / 100,
  };
}