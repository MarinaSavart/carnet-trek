import { Router } from 'express'
import { Trek } from '../models/Trek.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const treks = await Trek.find().sort({ date: -1 })
    res.json(treks)
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des randos' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const trek = await Trek.findById(req.params.id)
    if (!trek) return res.status(404).json({ error: 'Rando introuvable' })
    res.json(trek)
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération de la rando' })
  }
})

router.post('/', async (req, res) => {
  try {
    const trek = await Trek.create(req.body)
    res.status(201).json(trek)
  } catch (err) {
    res.status(400).json({ error: 'Données invalides' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await Trek.findByIdAndDelete(req.params.id)
    res.status(204).send()
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la suppression' })
  }
})

export default router
