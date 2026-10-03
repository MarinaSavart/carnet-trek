import { z } from 'zod'

const objectId = z.string().regex(/^[0-9a-f]{24}$/i, 'Identifiant invalide')

// La cohérence avec les étapes du trek (toutes présentes, dans l'ordre) est vérifiée par
// le service, qui connaît le trek
export const varianteInputSchema = z.object({
  groups: z.array(z.array(objectId).min(1, 'Groupe vide')).min(1, 'Au moins une étape').max(60),
  /** Nuits au milieu d'une étape : identifiant de l'étape et position (km sur sa trace) */
  cuts: z
    .array(z.object({ etape: objectId, km: z.number().positive().max(1000) }))
    .max(100)
    .default([]),
})

export type VarianteInput = z.infer<typeof varianteInputSchema>
