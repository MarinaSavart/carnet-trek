import { z } from 'zod'
import { DIFFICULTIES } from '../models/Trek.js'

// Stats d'une étape : facultatives quand un GPX est fourni (il les calcule),
// obligatoires sinon — la règle est appliquée par le service, qui connaît les fichiers.
const optionalStat = (max: number) => z.number().min(0).max(max).nullish()

export const etapeInputSchema = z.object({
  name: z.string().trim().min(1, "Le nom de l'étape est obligatoire").max(200),
  description: z.string().trim().max(5000).default(''),
  difficulty: z.enum(DIFFICULTIES),
  distanceKm: optionalStat(1000),
  elevationGain: optionalStat(20_000),
  elevationLoss: optionalStat(20_000),
  durationMin: optionalStat(60 * 24 * 7),
})

export const trekInputSchema = z.object({
  name: z.string().trim().min(1, 'Le nom du trek est obligatoire').max(200),
  region: z.string().trim().max(200).default(''),
  description: z.string().trim().max(10_000).default(''),
  etapes: z.array(etapeInputSchema).min(1, 'Ajoute au moins une étape').max(50),
})

export type EtapeInput = z.infer<typeof etapeInputSchema>
export type TrekInput = z.infer<typeof trekInputSchema>
