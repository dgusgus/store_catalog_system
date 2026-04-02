// src/services/cloudinary.service.ts
//
// Llama a la API de Cloudinary para borrar imágenes por su public_id.
// No usa el SDK oficial para evitar problemas de ESM — usa fetch + crypto nativo.
//
// ¿Por qué firmamos la request?
// Cloudinary exige que las operaciones destructivas (borrar) vengan firmadas
// con tu API_SECRET. Así nadie puede borrar imágenes sin esa clave.

import crypto from "node:crypto";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

interface CloudinaryDeleteResult {
  result: "ok" | "not found";
}

/**
 * Borra una imagen de Cloudinary usando su public_id.
 *
 * @param publicId - El ID de Cloudinary, ej: "store-catalog/abc123xyz"
 * @returns true si se borró, false si no existía (no tira error — es idempotente)
 */
export async function deleteFromCloudinary(publicId: string): Promise<boolean> {
  const timestamp = Math.floor(Date.now() / 1000).toString();

  // La firma se calcula sobre los parámetros ordenados alfabéticamente + el secret
  // Documentación: https://cloudinary.com/documentation/authentication_signatures
  const signature = generateSignature({ public_id: publicId, timestamp });

  const formData = new URLSearchParams({
    public_id: publicId,
    timestamp,
    api_key:   env.CLOUDINARY_API_KEY,
    signature,
  });

  const url = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/destroy`;

  try {
    const response = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    formData.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error({ publicId, status: response.status, body: text }, "Error al borrar imagen de Cloudinary");
      return false;
    }

    const data = await response.json() as CloudinaryDeleteResult;

    if (data.result === "not found") {
      // La imagen ya no existía en Cloudinary — lo tratamos como éxito
      // para que la DB igual se limpie
      logger.warn({ publicId }, "Imagen no encontrada en Cloudinary — ya fue borrada o nunca existió");
      return true;
    }

    logger.info({ publicId }, "Imagen borrada de Cloudinary");
    return true;

  } catch (error) {
    // Error de red — no bloqueamos el borrado en la DB
    logger.error({ error, publicId }, "Fallo de red al borrar imagen de Cloudinary");
    return false;
  }
}

/**
 * Genera la firma HMAC-SHA1 requerida por la API de Cloudinary.
 * Los parámetros deben ir ordenados alfabéticamente antes de firmar.
 */
function generateSignature(params: Record<string, string>): string {
  // 1. Ordenar parámetros alfabéticamente y armar el string a firmar
  const toSign = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  // 2. Concatenar el API_SECRET al final (sin separador)
  const stringToSign = `${toSign}${env.CLOUDINARY_API_SECRET}`;

  // 3. SHA1 del resultado
  return crypto
    .createHash("sha1")
    .update(stringToSign)
    .digest("hex");
}