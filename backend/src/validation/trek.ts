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

const objectId = z.string().regex(/^[0-9a-f]{24}$/i, 'Identifiant invalide')

// Modification : chaque étape envoyée est soit une étape existante (`_id`), soit une
// nouvelle. Les étapes existantes absentes de la liste sont supprimées ; l'ordre de la
// liste devient l'ordre des étapes.
export const etapeUpdateSchema = etapeInputSchema.extend({
  _id: objectId.optional(),
  /** Retire la trace GPX actuelle (sans en envoyer de nouvelle) */
  removeGpx: z.boolean().default(false),
  /** Photos existantes à conserver ; les autres sont supprimées. Absent : toutes conservées */
  keepPhotoIds: z.array(objectId).optional(),
})

export const trekUpdateSchema = trekInputSchema.extend({
  etapes: z.array(etapeUpdateSchema).min(1, 'Ajoute au moins une étape').max(50),
})

export type EtapeInput = z.infer<typeof etapeInputSchema>
export type TrekInput = z.infer<typeof trekInputSchema>
export type TrekUpdateInput = z.infer<typeof trekUpdateSchema>
