import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import { HttpError } from '../lib/errors.js'
import { requireAuth } from '../middleware/auth.js'
import { createVariante, deleteVariante, listVariantes } from '../services/varianteService.js'
import { varianteInputSchema } from '../validation/variante.js'

// Monté sous /api/treks/:trekId/variantes. Lecture publique ; créer ou supprimer un
// découpage demande d'être connecté.
const router = Router({ mergeParams: true })

// :trekId vient du routeur parent (mergeParams), qu'Express ne sait pas typer ici
function trekIdParam(req: { params: object }): string {
  const id = String((req.params as { trekId?: string }).trekId)
  if (!isValidObjectId(id)) throw new HttpError(404, 'Trek introuvable')
  return id
}

router.get('/', async (req, res) => {
  res.json(await listVariantes(trekIdParam(req), req.user?._id))
})

router.post('/', requireAuth, async (req, res) => {
  const input = varianteInputSchema.parse(req.body)
  const { created, variante } = await createVariante(trekIdParam(req), input, req.user!._id)
  res.status(created ? 201 : 200).json(variante)
})

router.delete('/:varianteId', requireAuth, async (req, res) => {
  const varianteId = String(req.params.varianteId)
  if (!isValidObjectId(varianteId)) throw new HttpError(404, 'Découpage introuvable')
  await deleteVariante(trekIdParam(req), varianteId, req.user!._id)
  res.status(204).send()
})

export default router
