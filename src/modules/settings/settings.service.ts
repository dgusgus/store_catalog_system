// src/modules/settings/settings.service.ts

import { prisma } from '../../../lib/prisma.js'
import type { UpdateSettingsInput } from './settings.schema.js'

// Siempre trabaja con id=1 — singleton pattern
const SETTINGS_ID = 1

/**
 * Devuelve la configuración de la tienda.
 * Si por alguna razón no existe, la crea con valores vacíos.
 */
export async function getSettings() {
  return prisma.storeSettings.upsert({
    where:  { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  })
}

/**
 * Actualiza solo los campos enviados (PATCH parcial).
 * Siempre trabaja sobre el registro con id=1.
 */
export async function updateSettings(input: UpdateSettingsInput) {
  return prisma.storeSettings.upsert({
    where:  { id: SETTINGS_ID },
    update: input,
    create: { id: SETTINGS_ID, ...input },
  })
}