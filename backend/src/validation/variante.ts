import { z } from 'zod'

const objectId = z.string().regex(/^[0-9a-f]{24}$/i, 'Identifiant invalide')

// La cohérence avec les étapes du trek (toutes présentes, dans l'ordre) est vérifiée par
// le service, qui connaît le trek
export const varianteInputSchema = z.object({
  groups: z.array(z.array(objectId).min(1, 'Groupe vide')).min(1, 'Au moins une étape').max(60),
})

export type VarianteInput = z.infer<typeof varianteInputSchema>
