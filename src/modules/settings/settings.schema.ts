// src/modules/settings/settings.schema.ts
 
import { z } from 'zod'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
 
extendZodWithOpenApi(z)
 
// Regex: solo dígitos, entre 7 y 15 caracteres (estándar E.164 sin el +)
const phoneRegex = /^\d{7,15}$/
 
export const updateSettingsSchema = z.object({
  whatsappNumber: z
    .string()
    .regex(phoneRegex, 'Número inválido: solo dígitos, sin + ni espacios (ej: 59171234567)')
    .nullable()
    .optional(),
 
  storeName: z
    .string()
    .min(2)
    .max(80)
    .optional(),
 
  storeDescription: z
    .string()
    .max(300)
    .nullable()
    .optional(),
}).openapi('UpdateSettingsInput')
 
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>